import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

/**
 * Contact photo as a circular avatar when one is set; otherwise the initials
 * bubble, tinted with a hue derived from the contact's email.
 */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email" | "photo">;
  size?: keyof typeof SIZES;
}) {
  if (contact.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- base64 data URL; next/image adds nothing here
      <img
        src={contact.photo}
        alt="" // decorative: the contact's name is always rendered beside the avatar
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={`inline-block shrink-0 select-none rounded-full bg-secondary object-cover shadow-sm ring-1 ring-border ${SIZES[size]}`}
      />
    );
  }

  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-semibold ring-1 ring-inset ring-foreground/10 ${SIZES[size]}`}
    >
      {initials(contact)}
    </span>
  );
}
