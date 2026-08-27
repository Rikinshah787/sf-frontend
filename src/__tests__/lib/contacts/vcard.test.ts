import {
  contactToVCard,
  myCardToVCard,
  normalizeWebUrl,
  vcardFileName,
  type MyCard,
} from "@/lib/contacts/vcard";
import { makeContact } from "../../mocks/handlers";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function lines(vcard: string): string[] {
  return vcard.split("\r\n").filter(Boolean);
}

describe("contactToVCard", () => {
  it("wraps the card in BEGIN/VERSION/END with CRLF endings", () => {
    const vcard = contactToVCard(makeContact());

    expect(vcard.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(vcard.endsWith("END:VCARD\r\n")).toBe(true);
    expect(vcard).not.toMatch(/(?<!\r)\n/); // no bare LFs
  });

  it("maps name, email, phone, org and title", () => {
    const out = lines(contactToVCard(makeContact()));

    expect(out).toContain("N:Lovelace;Ada;;;");
    expect(out).toContain("FN:Ada Lovelace");
    expect(out).toContain("EMAIL;TYPE=INTERNET:ada@example.com");
    expect(out).toContain("TEL;TYPE=VOICE:+1-415-555-0101");
    expect(out).toContain("ORG:Analytical Engines");
    expect(out).toContain("TITLE:Mathematician");
  });

  it("emits one typed ADR per address in the RFC component order", () => {
    const contact = makeContact({
      addresses: [
        {
          id: 1,
          type: "work",
          address: "1 Market St",
          city: "San Francisco",
          state: "CA",
          postal_code: "94105",
          country: "USA",
        },
        { id: 2, type: "other", address: null, city: "Zurich", state: null, postal_code: "8001", country: null },
      ],
    });

    const out = lines(contactToVCard(contact));
    expect(out).toContain("ADR;TYPE=WORK:;;1 Market St;San Francisco;CA;94105;USA");
    expect(out).toContain("ADR;TYPE=OTHER:;;;Zurich;;8001;");
  });

  it("skips addresses with no postal content", () => {
    const contact = makeContact({
      addresses: [
        { id: 1, type: "home", address: null, city: null, state: null, postal_code: null, country: null },
      ],
    });

    expect(contactToVCard(contact)).not.toContain("ADR");
  });

  it("escapes backslashes, semicolons, commas and newlines", () => {
    const contact = makeContact({
      company: "Piano; Forte, Ltd\\Co",
      notes: "line one\nline two",
    });

    const out = lines(contactToVCard(contact));
    expect(out).toContain("ORG:Piano\\; Forte\\, Ltd\\\\Co");
    expect(out).toContain("NOTE:line one\\nline two");
  });

  it("embeds a valid photo and folds its long base64 line", () => {
    const longPhoto = `data:image/png;base64,${"A".repeat(200)}`;
    const vcard = contactToVCard(makeContact({ photo: longPhoto }));

    expect(vcard).toContain("PHOTO;ENCODING=b;TYPE=PNG:");
    const physical = vcard.split("\r\n");
    for (const line of physical) expect(line.length).toBeLessThanOrEqual(75);
    // Unfolding (dropping the leading space of continuations) restores the payload.
    expect(vcard.replace(/\r\n /g, "")).toContain("A".repeat(200));
  });

  it("folds long Unicode lines on UTF-8 octet boundaries", () => {
    // 'ü' is 2 octets in UTF-8, so 120 of them (240 octets) must fold without
    // ever splitting a character or exceeding 75 octets per physical line.
    const vcard = contactToVCard(makeContact({ notes: "ü".repeat(120) }));

    const encoder = new TextEncoder();
    for (const line of vcard.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(vcard.replace(/\r\n /g, "")).toContain(`NOTE:${"ü".repeat(120)}`);
  });

  it("omits the photo when asked, or when the data URL is not a safe image", () => {
    expect(
      contactToVCard(makeContact({ photo: PNG_DATA_URL }), { includePhoto: false }),
    ).not.toContain("PHOTO");
    expect(
      contactToVCard(makeContact({ photo: "data:image/svg+xml;base64,PHN2Zz4=" })),
    ).not.toContain("PHOTO");
  });

  it("omits notes when asked", () => {
    const contact = makeContact({ notes: "private" });
    expect(contactToVCard(contact, { includeNotes: false })).not.toContain("NOTE");
    expect(contactToVCard(contact)).toContain("NOTE:private");
  });

  it("records the update timestamp as REV and drops it when unparsable", () => {
    expect(contactToVCard(makeContact())).toContain("REV:2026-08-19T17:04:53.743Z");
    expect(contactToVCard(makeContact({ updated_at: "not-a-date" }))).not.toContain("REV:");
  });
});

function makeMyCard(overrides: Partial<MyCard> = {}): MyCard {
  return {
    first_name: "Rikin",
    last_name: "Shah",
    email: "rikin@example.com",
    phone: "",
    company: "",
    job_title: "",
    linkedin: "linkedin.com/in/rikin-shah",
    event: "GitHub HQ hackathon",
    ...overrides,
  };
}

describe("normalizeWebUrl", () => {
  it("defaults to https:// when no scheme was typed", () => {
    expect(normalizeWebUrl("linkedin.com/in/ada")).toBe("https://linkedin.com/in/ada");
    expect(normalizeWebUrl("http://example.com/x")).toBe("http://example.com/x");
  });

  it("strips whitespace and control characters before parsing", () => {
    expect(normalizeWebUrl("  linkedin.com/in/ada \r\nNOTE:injected")).toBe(
      "https://linkedin.com/in/adaNOTE:injected",
    );
    expect(normalizeWebUrl("\t \n")).toBeNull();
  });

  it("rejects unparsable values and non-http(s) schemes", () => {
    expect(normalizeWebUrl("https://")).toBeNull();
    expect(normalizeWebUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("myCardToVCard", () => {
  it("builds a minimal card with name, email, URL and the meeting note", () => {
    const out = lines(myCardToVCard(makeMyCard()));

    expect(out[0]).toBe("BEGIN:VCARD");
    expect(out).toContain("N:Shah;Rikin;;;");
    expect(out).toContain("FN:Rikin Shah");
    expect(out).toContain("EMAIL;TYPE=INTERNET:rikin@example.com");
    expect(out).toContain("URL;TYPE=WORK:https://linkedin.com/in/rikin-shah");
    expect(out).toContain("NOTE:Met at GitHub HQ hackathon");
    expect(out[out.length - 1]).toBe("END:VCARD");
  });

  it("omits blank fields entirely", () => {
    const vcard = myCardToVCard(
      makeMyCard({ email: " ", phone: "", company: "", job_title: "", linkedin: "", event: "  " }),
    );

    for (const property of ["EMAIL", "TEL", "ORG", "TITLE", "URL", "NOTE"]) {
      expect(vcard).not.toContain(property);
    }
  });

  it("escapes text fields but leaves the URL value un-escaped", () => {
    const out = lines(
      myCardToVCard(
        makeMyCard({
          company: "Piano; Forte, Ltd",
          event: "expo, hall B",
          linkedin: "https://example.com/a,b",
        }),
      ),
    );

    expect(out).toContain("ORG:Piano\\; Forte\\, Ltd");
    expect(out).toContain("NOTE:Met at expo\\, hall B");
    expect(out).toContain("URL;TYPE=WORK:https://example.com/a,b");
  });

  it("drops an invalid LinkedIn value instead of emitting a broken URL", () => {
    expect(myCardToVCard(makeMyCard({ linkedin: "ftp://example.com" }))).not.toContain("URL");
  });

  it("folds long lines like the contact export does", () => {
    const vcard = myCardToVCard(makeMyCard({ event: "ü".repeat(120) }));

    const encoder = new TextEncoder();
    for (const line of vcard.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(vcard.replace(/\r\n /g, "")).toContain(`NOTE:Met at ${"ü".repeat(120)}`);
  });
});

describe("vcardFileName", () => {
  it("slugs the full name", () => {
    expect(vcardFileName(makeContact())).toBe("ada-lovelace.vcf");
    expect(vcardFileName(makeContact({ full_name: "Dr. Grace Hopper Jr." }))).toBe(
      "dr-grace-hopper-jr.vcf",
    );
  });

  it("falls back to the contact id when the name has no usable characters", () => {
    expect(vcardFileName(makeContact({ id: 7, full_name: "···" }))).toBe("contact-7.vcf");
  });
});
