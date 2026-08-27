import { Download } from "lucide-react";
import QRCode from "qrcode";
import { buttonClasses } from "@/components/ui/Button";
import { contactToVCard, vcardFileName } from "@/lib/contacts/vcard";
import type { Contact } from "@/lib/contacts/types";

/**
 * "Save to phone": a QR code that phone cameras recognise as a contact card,
 * plus a `.vcf` download. Rendered entirely on the server — the QR becomes an
 * inline SVG data URL and the download is a plain `data:` anchor, so the card
 * ships no client JavaScript.
 *
 * The QR payload deliberately drops the photo and notes: QR codes top out
 * around 3 KB, so the compact card keeps the code coarse enough to scan.
 * The download carries the full card, photo included.
 */
export default async function SaveToPhoneCard({ contact }: { contact: Contact }) {
  let qrSrc: string | null = null;
  try {
    const svg = await QRCode.toString(
      contactToVCard(contact, { includePhoto: false, includeNotes: false }),
      {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      },
    );
    qrSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    // Payload too large for a QR code (e.g. very long field values):
    // hide the code and keep the download, which has no such limit.
  }

  const vcfHref = `data:text/vcard;charset=utf-8,${encodeURIComponent(contactToVCard(contact))}`;

  return (
    <section
      aria-labelledby="save-to-phone"
      className="flex flex-wrap items-center gap-5 rounded-lg border border-border bg-card px-4 py-4 sm:px-5"
    >
      {qrSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL; next/image adds nothing here
        <img
          src={qrSrc}
          alt={`QR code with ${contact.full_name}'s contact card`}
          width={132}
          height={132}
          className="shrink-0 rounded-md border border-border"
        />
      ) : null}

      <div className="min-w-48 flex-1 space-y-1">
        <h2 id="save-to-phone" className="font-display text-sm font-semibold text-foreground">
          Save to phone
        </h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {qrSrc
            ? "Point your phone camera at the code to add this contact — every address included."
            : "Download the contact card and open it on your phone — every address included."}
        </p>
        <div className="pt-2">
          <a
            href={vcfHref}
            download={vcardFileName(contact)}
            className={buttonClasses("secondary", "sm")}
          >
            <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Download .vcf
          </a>
        </div>
      </div>
    </section>
  );
}
