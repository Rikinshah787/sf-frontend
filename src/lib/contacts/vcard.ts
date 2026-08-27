import { addressLine } from "./format";
import { isSafeImageDataUrl } from "./schema";
import type { Address, Contact } from "./types";

/**
 * vCard 3.0 (RFC 2426) export, used by the "Save to phone" card: the QR code
 * carries a compact card (no photo or notes, so it stays scannable) while the
 * `.vcf` download embeds everything, photo included.
 */

const CRLF = "\r\n";

/** Escape a text value per RFC 2426 §4: backslash, semicolon, comma, newline. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Octets a code point occupies once UTF-8 encoded (RFC 3629). */
function utf8Size(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

/**
 * Fold a content line at 75 UTF-8 octets with a space-prefixed continuation
 * (RFC 2426 §2.6). Counting octets per code point means a fold can land
 * between characters but never inside a multi-byte UTF-8 sequence.
 */
function foldLine(line: string): string {
  const folded: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = utf8Size(char.codePointAt(0) ?? 0);
    if (octets + size > 75) {
      folded.push(current);
      current = " "; // continuation lines start with one space (one octet)
      octets = 1;
    }
    current += char;
    octets += size;
  }
  folded.push(current);
  return folded.join(CRLF);
}

/** `ADR` component order: PO box, extended, street, locality, region, postal, country. */
function addressProperty(addr: Address): string {
  const components = ["", "", addr.address, addr.city, addr.state, addr.postal_code, addr.country]
    .map((component) => escapeText(component ?? ""))
    .join(";");
  return `ADR;TYPE=${addr.type.toUpperCase()}:${components}`;
}

/** `PHOTO;ENCODING=b;TYPE=JPEG:...` from a validated base64 data URL, else null. */
function photoProperty(photo: string): string | null {
  if (!isSafeImageDataUrl(photo)) return null;
  const commaAt = photo.indexOf(",");
  const mediaType = photo.slice("data:".length, photo.indexOf(";")).trim().toLowerCase();
  const subtype = mediaType.slice("image/".length).toUpperCase();
  return `PHOTO;ENCODING=b;TYPE=${subtype}:${photo.slice(commaAt + 1)}`;
}

export type VCardOptions = {
  /** Embed the contact photo. Default true; the QR payload turns it off. */
  includePhoto?: boolean;
  /** Include the notes field. Default true; the QR payload turns it off. */
  includeNotes?: boolean;
};

/** Serialise a contact as vCard 3.0 text (CRLF line endings, folded lines). */
export function contactToVCard(contact: Contact, options: VCardOptions = {}): string {
  const { includePhoto = true, includeNotes = true } = options;

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeText(contact.last_name)};${escapeText(contact.first_name)};;;`,
    `FN:${escapeText(contact.full_name)}`,
    `EMAIL;TYPE=INTERNET:${escapeText(contact.email)}`,
  ];

  if (contact.phone) lines.push(`TEL;TYPE=VOICE:${escapeText(contact.phone)}`);
  if (contact.company) lines.push(`ORG:${escapeText(contact.company)}`);
  if (contact.job_title) lines.push(`TITLE:${escapeText(contact.job_title)}`);

  for (const addr of contact.addresses) {
    // Skip rows with no postal content, the same test the detail page uses.
    if (addressLine(addr)) lines.push(addressProperty(addr));
  }

  if (includeNotes && contact.notes) lines.push(`NOTE:${escapeText(contact.notes)}`);

  if (includePhoto && contact.photo) {
    const photo = photoProperty(contact.photo);
    if (photo) lines.push(photo);
  }

  const revision = new Date(contact.updated_at);
  if (!Number.isNaN(revision.getTime())) lines.push(`REV:${revision.toISOString()}`);

  lines.push("END:VCARD");
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/**
 * The "My card" page builds a vCard for the app's owner rather than a stored
 * contact: a QR of this card is what you show at an event, and whoever scans
 * it gets your details, your LinkedIn as a URL property, and a "Met at …"
 * note so the meeting place travels with the card.
 */
export type MyCard = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
  linkedin: string;
  event: string;
};

/**
 * Normalise a user-typed web address: strip whitespace and control characters
 * (which could otherwise inject extra vCard lines), default to https:// when
 * no scheme was typed, and return null for anything the URL parser rejects.
 * http(s) only — a vCard URL is a link, not a launcher.
 */
export function normalizeWebUrl(value: string): string | null {
  const cleaned = value.replace(/[\s\u0000-\u001f\u007f]+/g, "");
  if (!cleaned) return null;
  // A typed scheme other than http(s) is rejected outright — prepending
  // https:// to something like "ftp://…" would still parse, just wrongly.
  const isHttp = /^https?:\/\//i.test(cleaned);
  if (!isHttp && /^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return null;
  try {
    return new URL(isHttp ? cleaned : `https://${cleaned}`).toString();
  } catch {
    return null;
  }
}

/** Serialise the owner's card as vCard 3.0. Blank fields are simply omitted. */
export function myCardToVCard(card: MyCard): string {
  const first = card.first_name.trim();
  const last = card.last_name.trim();
  const fullName = [first, last].filter(Boolean).join(" ");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeText(last)};${escapeText(first)};;;`,
    `FN:${escapeText(fullName)}`,
  ];

  const email = card.email.trim();
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeText(email)}`);
  const phone = card.phone.trim();
  if (phone) lines.push(`TEL;TYPE=VOICE:${escapeText(phone)}`);
  const company = card.company.trim();
  if (company) lines.push(`ORG:${escapeText(company)}`);
  const jobTitle = card.job_title.trim();
  if (jobTitle) lines.push(`TITLE:${escapeText(jobTitle)}`);

  // URL is a uri-typed value (RFC 2426 §3.6.8), so it is not text-escaped;
  // normalizeWebUrl already removed every character that could break a line.
  const linkedin = normalizeWebUrl(card.linkedin);
  if (linkedin) lines.push(`URL;TYPE=WORK:${linkedin}`);

  const event = card.event.trim();
  if (event) lines.push(`NOTE:${escapeText(`Met at ${event}`)}`);

  lines.push("END:VCARD");
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** "ada-lovelace.vcf"-style download name, with a stable fallback. */
export function vcardFileName(contact: Contact): string {
  const slug = contact.full_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || `contact-${contact.id}`}.vcf`;
}
