import {
  CONTACT_FIELDS,
  contactInputSchema,
  formDataToAddresses,
  formDataToValues,
  isSafeImageDataUrl,
  zodFieldErrors,
} from "@/lib/contacts/schema";

function values(overrides: Record<string, string> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    notes: "",
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
    });
  });

  it("accepts typed addresses and rejects unknown types", () => {
    const row = {
      type: "work",
      address: "500 Office Park",
      city: "Chicago",
      state: "",
      postal_code: "",
      country: "USA",
    };

    const parsed = contactInputSchema.parse({ ...values(), addresses: [row] });
    expect(parsed.addresses).toEqual([
      {
        type: "work",
        address: "500 Office Park",
        city: "Chicago",
        state: null,
        postal_code: null,
        country: "USA",
      },
    ]);

    const bad = contactInputSchema.safeParse({
      ...values(),
      addresses: [{ ...row, type: "vacation" }],
    });
    expect(zodFieldErrors(bad.error!).addresses).toBe(
      "Choose Home, Work, or Other",
    );
  });
});

describe("isSafeImageDataUrl", () => {
  it("accepts bitmap image data URLs", () => {
    expect(isSafeImageDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isSafeImageDataUrl("data:image/bmp;base64,Qk0=")).toBe(true);
    expect(isSafeImageDataUrl("data:IMAGE/PNG;base64,iVBORw0KGgo=")).toBe(true);
  });

  it("rejects SVG in any casing and with whitespace tricks", () => {
    expect(isSafeImageDataUrl("data:image/svg+xml;base64,PHN2Zy8+")).toBe(false);
    expect(isSafeImageDataUrl("data:image/SVG+XML;base64,PHN2Zy8+")).toBe(false);
    expect(isSafeImageDataUrl("data:image/svg+xml ;base64,PHN2Zy8+")).toBe(false);
    expect(isSafeImageDataUrl("data:image/svg+xml\t;base64,PHN2Zy8+")).toBe(false);
    expect(isSafeImageDataUrl("data: image/svg+xml;base64,PHN2Zy8+")).toBe(false);
  });

  it("rejects non-image and structureless values", () => {
    expect(isSafeImageDataUrl("data:text/html;base64,PGI+")).toBe(false);
    expect(isSafeImageDataUrl("data:image/png")).toBe(false);
    expect(isSafeImageDataUrl("http://example.com/a.png")).toBe(false);
  });

  it("rejects malformed base64 payloads, like the API does", () => {
    expect(isSafeImageDataUrl("data:image/png,rawbytes")).toBe(false); // no ;base64,
    expect(isSafeImageDataUrl("data:image/png;base64,")).toBe(false); // empty payload
    expect(isSafeImageDataUrl("data:image/png;base64,@@bad@@")).toBe(false);
    expect(isSafeImageDataUrl("data:image/png;base64,iVBORw0KG")).toBe(false); // bad padding
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      CONTACT_FIELDS.map((field) => field.name).sort(),
    );
  });
});

describe("formDataToAddresses", () => {
  it("rebuilds indexed rows and compacts the gaps removed rows leave", () => {
    const formData = new FormData();
    formData.set("addresses.0.type", "home");
    formData.set("addresses.0.city", "San Francisco");
    // Row 1 was removed in the UI; row 2 survives.
    formData.set("addresses.2.type", "work");
    formData.set("addresses.2.city", "Chicago");

    const rows = formDataToAddresses(formData);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "home", city: "San Francisco" });
    expect(rows[1]).toMatchObject({ type: "work", city: "Chicago" });
  });

  it("returns an empty list when no address controls were submitted", () => {
    expect(formDataToAddresses(new FormData())).toEqual([]);
  });
});
