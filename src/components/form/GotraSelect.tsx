"use client";

import { useState } from "react";
import { GOTRAS } from "@/lib/form-options";

const OTHER_SENTINEL = "__other__";

interface GotraSelectProps {
  valueHi: string;
  valueEn: string;
  onChange: (hi: string, en: string) => void;
  label?: string;
}

export default function GotraSelect({
  valueHi,
  valueEn,
  onChange,
  label,
}: GotraSelectProps) {
  // Determine if current value matches a known gotra
  const matchIdx = GOTRAS.findIndex(
    (g) =>
      (valueEn && g.en.toLowerCase() === valueEn.toLowerCase()) ||
      (valueHi && g.hi === valueHi)
  );
  const hasValue = !!(valueHi || valueEn);
  const isKnownGotra = matchIdx >= 0;

  // Local flag: user explicitly picked "Other" from dropdown
  const [userChoseOther, setUserChoseOther] = useState(false);

  // Show Other inputs if user chose Other OR incoming value doesn't match the list
  const showOther = userChoseOther || (hasValue && !isKnownGotra);

  function handleSelect(val: string) {
    if (val === OTHER_SENTINEL) {
      setUserChoseOther(true);
      onChange("", "");
    } else if (val === "") {
      setUserChoseOther(false);
      onChange("", "");
    } else {
      setUserChoseOther(false);
      const g = GOTRAS[Number(val)];
      onChange(g.hi, g.en);
    }
  }

  const selectValue = showOther
    ? OTHER_SENTINEL
    : isKnownGotra
      ? String(matchIdx)
      : "";

  return (
    <div className="border-b border-[var(--hairline)] py-2 last:border-0">
      {label && (
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </label>
      )}

      <select
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
        className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
      >
        <option value="">— Select —</option>
        {GOTRAS.map((g, i) => (
          <option key={i} value={String(i)}>
            {g.en} — {g.hi}
          </option>
        ))}
        <option value={OTHER_SENTINEL}>Other — type your own</option>
      </select>

      {showOther && (
        <div className="mt-2 space-y-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Gotra (English)
            </label>
            <input
              type="text"
              value={valueEn}
              onChange={(e) => onChange(valueHi, e.target.value)}
              placeholder="Type gotra in English"
              className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              गोत्र (हिंदी)
            </label>
            <input
              type="text"
              value={valueHi}
              onChange={(e) => onChange(e.target.value, valueEn)}
              placeholder="गोत्र हिंदी में लिखें"
              className="min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
