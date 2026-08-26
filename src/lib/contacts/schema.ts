import { z } from "zod";
import {
  ADDRESS_TYPES,
  MAX_ADDRESSES,
  type AddressFormRow,
  type AddressInput,
  type ContactInput,
  type FlatContactField,
} from "./types";

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Matches the API's photo limit: ~1 MiB of image bytes once base64-decoded. */
export const PHOTO_MAX_LENGTH = 1_400_000;

/**
 * True when the value is a base64 data URL the API will accept: a non-SVG
 * `image/*` media type, the `;base64,` marker, and a non-empty well-formed
 * base64 payload. The media type is parsed the way MIME sniffing does — up to
 * the first `;`, surrounding HTTP whitespace stripped, lowercased — so tricks
 * like `data:image/svg+xml ;base64,` cannot sneak the scriptable type through.
 */
export function isSafeImageDataUrl(value: string): boolean {
  const match = /^data:([^;,]*);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const essence = match[1].trim().toLowerCase();
  return essence.startsWith("image/") && essence !== "image/svg+xml";
}

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

export const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES, "Choose Home, Work, or Other"),
  address: optionalText(300, "Street address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  addresses: z
    .array(addressInputSchema)
    .max(MAX_ADDRESSES, `A contact can have at most ${MAX_ADDRESSES} addresses`)
    .default([]),
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
  photo: z
    .string()
    .trim()
    .max(PHOTO_MAX_LENGTH, "Photo is too large — choose an image under 1 MB")
    .refine(
      // Mirrors the API: an image data URL, but never scriptable SVG.
      (value) => !value || isSafeImageDataUrl(value),
      "Photo must be a bitmap image file (SVG isn't supported)",
    )
    .transform((value) => value || null)
    .nullable()
    .default(null),
}) satisfies z.ZodType<ContactInput, unknown>;

export type ContactFormValues = z.input<typeof contactInputSchema>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof ContactInput, string>> {
  const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key as keyof ContactInput] = issue.message;
    }
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

export interface ContactFieldSpec {
  name: FlatContactField;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "photo";
  required?: boolean;
  maxLength: number;
  placeholder?: string;
  autoComplete?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
      {
        name: "photo",
        label: "Photo",
        type: "photo",
        maxLength: PHOTO_MAX_LENGTH,
        wide: true,
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** Per-address form controls, rendered by `AddressesEditor` for every row. */
export interface AddressFieldSpec {
  name: keyof AddressInput;
  label: string;
  maxLength: number;
  placeholder?: string;
  wide?: boolean;
}

export const ADDRESS_FIELDS: AddressFieldSpec[] = [
  {
    name: "address",
    label: "Street address",
    maxLength: 300,
    placeholder: "1 Market St, Suite 400",
    wide: true,
  },
  { name: "city", label: "City", maxLength: 120, placeholder: "San Francisco" },
  { name: "state", label: "State / region", maxLength: 120, placeholder: "CA" },
  { name: "postal_code", label: "Postal code", maxLength: 20, placeholder: "94105" },
  { name: "country", label: "Country", maxLength: 120, placeholder: "USA" },
];

/** Pull the flat contact fields out of a submitted form, as raw strings. */
export function formDataToValues(
  formData: FormData,
): Record<FlatContactField, string> {
  return Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field.name,
      String(formData.get(field.name) ?? ""),
    ]),
  ) as Record<FlatContactField, string>;
}

/**
 * Rebuild the address rows from a submitted form. `AddressesEditor` names its
 * controls `addresses.<row>.<field>`; rows removed in the UI simply never
 * submit, so the surviving indexes are compacted here.
 */
export function formDataToAddresses(formData: FormData): AddressFormRow[] {
  const rows: Partial<AddressFormRow>[] = [];
  for (const [key, value] of formData.entries()) {
    const match = /^addresses\.(\d+)\.(type|address|city|state|postal_code|country)$/.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    (rows[index] ??= {})[match[2] as keyof AddressInput] = String(value);
  }
  return rows.filter(Boolean).map((row) => ({
    type: row.type ?? "home",
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    postal_code: row.postal_code ?? "",
    country: row.country ?? "",
  }));
}
