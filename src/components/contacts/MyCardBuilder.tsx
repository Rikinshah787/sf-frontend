"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";
import Button, { buttonClasses } from "@/components/ui/Button";
import { CONTROL } from "@/components/ui/Field";
import { myCardToVCard, normalizeWebUrl, type MyCard } from "@/lib/contacts/vcard";

const EMPTY_CARD: MyCard = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company: "",
  job_title: "",
  linkedin: "",
  event: "",
};

const FIELDS: {
  name: keyof MyCard;
  label: string;
  placeholder: string;
  type?: "email" | "tel" | "url";
  autoComplete?: string;
  wide?: boolean;
}[] = [
  { name: "first_name", label: "First name", placeholder: "Ada", autoComplete: "given-name" },
  { name: "last_name", label: "Last name", placeholder: "Lovelace", autoComplete: "family-name" },
  { name: "email", label: "Email", placeholder: "ada@example.com", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone", placeholder: "+1-415-555-0101", type: "tel", autoComplete: "tel" },
  { name: "company", label: "Company", placeholder: "Analytical Engines", autoComplete: "organization" },
  { name: "job_title", label: "Job title", placeholder: "Mathematician", autoComplete: "organization-title" },
  {
    name: "linkedin",
    label: "LinkedIn",
    placeholder: "linkedin.com/in/ada-lovelace",
    type: "url",
    wide: true,
  },
  {
    name: "event",
    label: "Where are you right now?",
    placeholder: "GitHub HQ hackathon",
    wide: true,
  },
];

const QR_OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 2,
  color: { dark: "#000000", light: "#ffffff" },
} as const;

/**
 * Interactive builder for your own scannable card. Everything happens in the
 * browser: typing regenerates a QR code whose payload IS the vCard, so any
 * phone camera offers "add contact" — including your LinkedIn and a
 * "Met at …" note — with no server round trip and no upload anywhere.
 */
export default function MyCardBuilder() {
  const [card, setCard] = useState<MyCard>(EMPTY_CARD);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  const hasName = Boolean(card.first_name.trim() || card.last_name.trim());
  const linkedinInvalid = Boolean(card.linkedin.trim()) && !normalizeWebUrl(card.linkedin);

  useEffect(() => {
    if (!hasName) return;

    let cancelled = false;
    QRCode.toString(myCardToVCard(card), { ...QR_OPTIONS, type: "svg" })
      .then((svg) => {
        if (!cancelled) {
          setQrSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        // Payload too large for a QR code — hide it rather than show a stale one.
        if (!cancelled) setQrSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [card, hasName]);

  function update(name: keyof MyCard, value: string) {
    setCard((current) => ({ ...current, [name]: value }));
  }

  /** A large PNG suits a phone photo library better than an SVG data URL. */
  async function downloadPng() {
    try {
      const url = await QRCode.toDataURL(myCardToVCard(card), {
        ...QR_OPTIONS,
        width: 640,
      });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "my-card-qr.png";
      anchor.click();
    } catch {
      // Same overflow case as above; the button is hidden when qrSrc is null,
      // so this is only reachable in a race and safe to ignore.
    }
  }

  // The effect never clears state, so gate on the name here: clearing your
  // name hides the (now stale) code instead of leaving it on screen.
  const showQr = hasName ? qrSrc : null;

  const vcfHref = hasName
    ? `data:text/vcard;charset=utf-8,${encodeURIComponent(myCardToVCard(card))}`
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form noValidate className="grid content-start gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const id = `my-card-${field.name}`;
          const invalid = field.name === "linkedin" && linkedinInvalid;
          return (
            <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
              <label
                htmlFor={id}
                className="mb-1.5 block text-[13px] font-medium text-foreground"
              >
                {field.label}
              </label>
              <input
                id={id}
                type={field.type ?? "text"}
                value={card[field.name]}
                onChange={(event) => update(field.name, event.target.value)}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                maxLength={320}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${id}-error` : undefined}
                className={`${CONTROL} ${
                  invalid
                    ? "border-destructive focus:border-destructive"
                    : "border-border focus:border-primary"
                }`}
              />
              {invalid ? (
                <p id={`${id}-error`} className="mt-1.5 text-[13px] text-destructive">
                  That doesn&apos;t look like a web address — it will be left off the card.
                </p>
              ) : null}
            </div>
          );
        })}
      </form>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <section
          aria-label="Your QR code"
          className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-5 py-6 text-center"
        >
          {showQr ? (
            // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL; next/image adds nothing here
            <img
              src={showQr}
              alt="QR code with your contact card"
              width={208}
              height={208}
              className="rounded-md border border-border bg-white p-1"
            />
          ) : (
            <div className="flex h-52 w-52 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-muted-foreground">
              <QrCode className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
              <p className="px-6 text-[13px] leading-snug">
                {hasName
                  ? "This card is too long to fit in a QR code — trim a field or two."
                  : "Type your name and the code appears here."}
              </p>
            </div>
          )}

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Save the code to your phone. Anyone who scans it gets your card —
            LinkedIn and where you met included.
          </p>

          {showQr ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={downloadPng}>
                <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Save QR to phone
              </Button>
              {vcfHref ? (
                <a
                  href={vcfHref}
                  download="my-card.vcf"
                  className={buttonClasses("secondary")}
                >
                  Download .vcf
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
