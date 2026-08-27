import type { Metadata } from "next";
import MyCardBuilder from "@/components/contacts/MyCardBuilder";

export const metadata: Metadata = {
  title: "My card",
  description: "A scannable QR code of your own contact card for events.",
};

/**
 * Your side of the address book: fill in your details once, keep the QR on
 * your phone, and whoever scans it at an event saves you straight to their
 * contacts — LinkedIn and meeting place included. Nothing here touches the
 * API; the card lives entirely in the QR code.
 */
export default function MyCardPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          My card
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your details never leave this page — the QR code itself is the card.
        </p>
      </div>

      <MyCardBuilder />
    </div>
  );
}
