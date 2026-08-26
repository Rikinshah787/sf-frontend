"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { CONTROL } from "@/components/ui/Field";
import { ADDRESS_FIELDS } from "@/lib/contacts/schema";
import {
  ADDRESS_TYPES,
  MAX_ADDRESSES,
  type AddressFormRow,
} from "@/lib/contacts/types";

type Row = AddressFormRow & { key: number };

const EMPTY_ROW: AddressFormRow = {
  type: "home",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

/**
 * Repeating address rows for the contact form. Controls are named
 * `addresses.<index>.<field>` and reconstructed server-side by
 * `formDataToAddresses`, so submission stays a plain form POST.
 * React keys stay with a row when one above it is removed, so typed
 * values survive re-indexing.
 */
export default function AddressesEditor({
  initial,
}: {
  initial: AddressFormRow[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((row, index) => ({ ...row, key: index })),
  );
  const [nextKey, setNextKey] = useState(initial.length);

  function addRow() {
    setRows((current) => [...current, { ...EMPTY_ROW, key: nextKey }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">
          No addresses yet. Add a home, work, or other address below.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div
          key={row.key}
          className="space-y-4 rounded-lg border border-border bg-card/50 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              Type
              <select
                name={`addresses.${index}.type`}
                defaultValue={row.type}
                className={`${CONTROL} w-auto border-border capitalize focus:border-primary`}
              >
                {ADDRESS_TYPES.map((type) => (
                  <option key={type} value={type} className="capitalize">
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove address ${index + 1}`}
              onClick={() => removeRow(row.key)}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Remove
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ADDRESS_FIELDS.map((field) => {
              const id = `address-${row.key}-${field.name}`;
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
                    type="text"
                    name={`addresses.${index}.${field.name}`}
                    defaultValue={row[field.name]}
                    maxLength={field.maxLength}
                    placeholder={field.placeholder}
                    className={`${CONTROL} border-border focus:border-primary`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addRow}
        disabled={rows.length >= MAX_ADDRESSES}
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Add address
      </Button>
    </div>
  );
}
