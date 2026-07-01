"use client";

import { useState, useCallback, useMemo } from "react";
import { COUNTRIES, INDIA_STATES, INDIA_CITIES } from "@/lib/form-options";

const OTHER_SENTINEL = "__other__";

interface CountryStateCityProps {
  country: string;
  countryEn: string;
  state: string;
  stateEn: string;
  city: string;
  cityEn: string;
  onChange: (partial: {
    country?: string;
    countryEn?: string;
    state?: string;
    stateEn?: string;
    city?: string;
    cityEn?: string;
  }) => void;
}

const inputClass =
  "min-h-[48px] w-full rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]";

function findCountryIdx(hi: string, en: string): number {
  return COUNTRIES.findIndex(
    (c) =>
      (en && c.en.toLowerCase() === en.toLowerCase()) ||
      (hi && c.hi === hi)
  );
}

function findStateIdx(hi: string, en: string): number {
  return INDIA_STATES.findIndex(
    (s) =>
      (en && s.en.toLowerCase() === en.toLowerCase()) ||
      (hi && s.hi === hi)
  );
}

function findCityIdx(stEn: string, hi: string, en: string): number {
  const cities = INDIA_CITIES[stEn];
  if (!cities) return -1;
  return cities.findIndex(
    (c) =>
      (en && c.en.toLowerCase() === en.toLowerCase()) ||
      (hi && c.hi === hi)
  );
}

export default function CountryStateCity({
  country,
  countryEn,
  state,
  stateEn,
  city,
  cityEn,
  onChange,
}: CountryStateCityProps) {
  const countryIdx = findCountryIdx(country, countryEn);
  const isIndia =
    countryIdx === 0 ||
    (!country && !countryEn) ||
    countryEn?.toLowerCase() === "india" ||
    country === "भारत";

  const hasCountryValue = !!(country || countryEn);
  const countryIsKnown = countryIdx >= 0;

  const stateIdx = findStateIdx(state, stateEn);
  const hasStateValue = !!(state || stateEn);
  const stateIsKnown = stateIdx >= 0;

  const cityIdx = findCityIdx(stateEn, city, cityEn);
  const hasCityValue = !!(city || cityEn);
  const cityIsKnown = cityIdx >= 0;

  // Local flags for when user explicitly picks "Other" from a dropdown
  const [userChoseCountryOther, setUserChoseCountryOther] = useState(false);
  const [userChoseStateOther, setUserChoseStateOther] = useState(false);
  const [userChoseCityOther, setUserChoseCityOther] = useState(false);

  const countryOtherMode = userChoseCountryOther || (hasCountryValue && !countryIsKnown);
  const stateOtherMode = userChoseStateOther || (isIndia && hasStateValue && !stateIsKnown);
  const cityOtherMode = userChoseCityOther || (isIndia && stateEn && hasCityValue && !cityIsKnown);

  // Country select value
  const countrySelectVal = countryOtherMode
    ? OTHER_SENTINEL
    : countryIdx >= 0
      ? String(countryIdx)
      : "0"; // default India

  const handleCountryChange = useCallback(
    (val: string) => {
      if (val === OTHER_SENTINEL) {
        setUserChoseCountryOther(true);
        setUserChoseStateOther(false);
        setUserChoseCityOther(false);
        onChange({ country: "", countryEn: "", state: "", stateEn: "", city: "", cityEn: "" });
      } else {
        setUserChoseCountryOther(false);
        setUserChoseStateOther(false);
        setUserChoseCityOther(false);
        const c = COUNTRIES[Number(val)];
        onChange({ country: c.hi, countryEn: c.en, state: "", stateEn: "", city: "", cityEn: "" });
      }
    },
    [onChange]
  );

  // State select value
  const stateSelectVal = stateOtherMode
    ? OTHER_SENTINEL
    : stateIdx >= 0
      ? String(stateIdx)
      : "";

  const handleStateChange = useCallback(
    (val: string) => {
      if (val === OTHER_SENTINEL) {
        setUserChoseStateOther(true);
        setUserChoseCityOther(false);
        onChange({ state: "", stateEn: "", city: "", cityEn: "" });
      } else if (val === "") {
        setUserChoseStateOther(false);
        setUserChoseCityOther(false);
        onChange({ state: "", stateEn: "", city: "", cityEn: "" });
      } else {
        setUserChoseStateOther(false);
        setUserChoseCityOther(false);
        const s = INDIA_STATES[Number(val)];
        onChange({ state: s.hi, stateEn: s.en, city: "", cityEn: "" });
      }
    },
    [onChange]
  );

  // City list for selected state
  const cities = useMemo(
    () => (isIndia && stateEn ? INDIA_CITIES[stateEn] || [] : []),
    [isIndia, stateEn]
  );

  const citySelectVal = cityOtherMode
    ? OTHER_SENTINEL
    : cityIdx >= 0
      ? String(cityIdx)
      : "";

  const handleCityChange = useCallback(
    (val: string) => {
      if (val === OTHER_SENTINEL) {
        setUserChoseCityOther(true);
        onChange({ city: "", cityEn: "" });
      } else if (val === "") {
        setUserChoseCityOther(false);
        onChange({ city: "", cityEn: "" });
      } else {
        setUserChoseCityOther(false);
        const c = cities[Number(val)];
        onChange({ city: c.hi, cityEn: c.en });
      }
    },
    [onChange, cities]
  );

  const showIndiaSelects = isIndia && !countryOtherMode;

  return (
    <div className="space-y-2">
      {/* Country */}
      <div className="border-b border-[var(--hairline)] py-2 last:border-0">
        <label className={labelClass}>Country / देश</label>
        <select
          value={countrySelectVal}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={inputClass}
        >
          {COUNTRIES.map((c, i) => (
            <option key={i} value={String(i)}>
              {c.en} — {c.hi}
            </option>
          ))}
          <option value={OTHER_SENTINEL}>Other</option>
        </select>
        {countryOtherMode && (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={countryEn}
              onChange={(e) => onChange({ countryEn: e.target.value })}
              placeholder="Country (English)"
              className={inputClass}
            />
            <input
              type="text"
              value={country}
              onChange={(e) => onChange({ country: e.target.value })}
              placeholder="देश (हिंदी)"
              className={inputClass}
            />
          </div>
        )}
      </div>

      {/* State — India: select; others: free text */}
      {showIndiaSelects ? (
        <div className="border-b border-[var(--hairline)] py-2 last:border-0">
          <label className={labelClass}>State / राज्य</label>
          <select
            value={stateSelectVal}
            onChange={(e) => handleStateChange(e.target.value)}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {INDIA_STATES.map((s, i) => (
              <option key={i} value={String(i)}>
                {s.en} — {s.hi}
              </option>
            ))}
            <option value={OTHER_SENTINEL}>Other</option>
          </select>
          {stateOtherMode && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={stateEn}
                onChange={(e) => onChange({ stateEn: e.target.value })}
                placeholder="State (English)"
                className={inputClass}
              />
              <input
                type="text"
                value={state}
                onChange={(e) => onChange({ state: e.target.value })}
                placeholder="राज्य (हिंदी)"
                className={inputClass}
              />
            </div>
          )}
        </div>
      ) : (
        (countryOtherMode || (!isIndia && hasCountryValue)) && (
          <div className="border-b border-[var(--hairline)] py-2 last:border-0">
            <label className={labelClass}>State / राज्य</label>
            <input
              type="text"
              value={stateEn}
              onChange={(e) => onChange({ stateEn: e.target.value })}
              placeholder="State (English)"
              className={inputClass}
            />
            <input
              type="text"
              value={state}
              onChange={(e) => onChange({ state: e.target.value })}
              placeholder="राज्य (हिंदी)"
              className={`${inputClass} mt-2`}
            />
          </div>
        )
      )}

      {/* City — India with state selected: select; others: free text */}
      {showIndiaSelects && stateEn && !stateOtherMode ? (
        <div className="border-b border-[var(--hairline)] py-2 last:border-0">
          <label className={labelClass}>City / शहर</label>
          <select
            value={citySelectVal}
            onChange={(e) => handleCityChange(e.target.value)}
            className={inputClass}
          >
            <option value="">— Select —</option>
            {cities.map((c, i) => (
              <option key={i} value={String(i)}>
                {c.en} — {c.hi}
              </option>
            ))}
            <option value={OTHER_SENTINEL}>Other</option>
          </select>
          {cityOtherMode && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={cityEn}
                onChange={(e) => onChange({ cityEn: e.target.value })}
                placeholder="City (English)"
                className={inputClass}
              />
              <input
                type="text"
                value={city}
                onChange={(e) => onChange({ city: e.target.value })}
                placeholder="शहर (हिंदी)"
                className={inputClass}
              />
            </div>
          )}
        </div>
      ) : (
        (stateOtherMode || (!showIndiaSelects && (hasStateValue || countryOtherMode || (!isIndia && hasCountryValue)))) && (
          <div className="border-b border-[var(--hairline)] py-2 last:border-0">
            <label className={labelClass}>City / शहर</label>
            <input
              type="text"
              value={cityEn}
              onChange={(e) => onChange({ cityEn: e.target.value })}
              placeholder="City (English)"
              className={inputClass}
            />
            <input
              type="text"
              value={city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="शहर (हिंदी)"
              className={`${inputClass} mt-2`}
            />
          </div>
        )
      )}
    </div>
  );
}
