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

/**
 * Fold a content line at 75 characters with a space-prefixed continuation.
 * Only ASCII lines are folded (in practice just the base64 photo, by far the
 * longest line) so a fold can never split a multi-byte UTF-8 sequence; parsers
 * accept the occasional long line, but not a broken character.
 */
function foldLine(line: string): string {
  if (line.length <= 75 || /[^\x20-\x7e]/.test(line)) return line;
  const chunks = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    chunks.push(` ${line.slice(i, i + 74)}`);
  }
  return chunks.join(CRLF);
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

/** "ada-lovelace.vcf"-style download name, with a stable fallback. */
export function vcardFileName(contact: Contact): string {
  const slug = contact.full_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || `contact-${contact.id}`}.vcf`;
}
