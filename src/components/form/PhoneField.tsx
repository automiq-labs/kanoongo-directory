"use client";

import { useState, useCallback } from "react";
import { COUNTRY_CODES } from "@/lib/form-options";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";

interface PhoneFieldProps {
  value: string;
  onChange: (fullValue: string) => void;
  label?: string;
}

function parsePhone(val: string): { codeIdx: number; number: string } {
  const trimmed = val.trim();
  if (!trimmed) return { codeIdx: 0, number: "" };

  // Try to match against known country codes (longest first to avoid +1 matching +1x)
  const sorted = COUNTRY_CODES.map((c, i) => ({ ...c, idx: i })).sort(
    (a, b) => b.code.length - a.code.length
  );

  for (const entry of sorted) {
    if (trimmed.startsWith(entry.code)) {
      return { codeIdx: entry.idx, number: trimmed.slice(entry.code.length).trim() };
    }
  }

  // No known code found — assume India (+91) and use whole string as number
  return { codeIdx: 0, number: trimmed };
}

export default function PhoneField({ value, onChange, label }: PhoneFieldProps) {
  const { lang } = useLang();
  const initial = parsePhone(value);
  const [codeIdx, setCodeIdx] = useState(initial.codeIdx);
  const [number, setNumber] = useState(initial.number);

  const emit = useCallback(
    (idx: number, num: string) => {
      const code = COUNTRY_CODES[idx].code;
      const clean = num.replace(/[^0-9]/g, "");
      onChange(clean ? `${code}${clean}` : "");
    },
    [onChange]
  );

  return (
    <div className="border-b border-[var(--hairline)] py-2 last:border-0">
      {label && (
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <select
          value={codeIdx}
          onChange={(e) => {
            const idx = Number(e.target.value);
            setCodeIdx(idx);
            emit(idx, number);
          }}
          className="min-h-[48px] w-[110px] shrink-0 rounded-[var(--r)] border border-[#ECE0C8] bg-white px-2 py-2 text-sm text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
        >
          {COUNTRY_CODES.map((c, i) => (
            <option key={i} value={i}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={number}
          onChange={(e) => {
            setNumber(e.target.value);
            emit(codeIdx, e.target.value);
          }}
          placeholder={t("phone_number", lang)}
          className="min-h-[48px] min-w-0 flex-1 rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
        />
      </div>
    </div>
  );
}
