"use client";

import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import CountryFlag from "@/components/common/CountryFlag";

export default function CountrySelect({
  defaultValue,
  className,
  required = false,
}: {
  defaultValue?: string | null;
  className?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <div className="flex items-center gap-2">
      <CountryFlag code={value} size={20} />
      <select
        name="country"
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={className}
      >
        <option value="">{required ? "Seçin" : "—"}</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
