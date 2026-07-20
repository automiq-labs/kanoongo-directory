/**
 * English → Hindi transliteration via AI4Bharat API + local dictionary.
 * No npm dependencies — uses native fetch + AbortController.
 *
 * Also exports useAutoHindi() — a React hook for silent auto-fill of
 * Hindi fields from English counterparts (debounced, non-blocking).
 */

import { useEffect, useRef, useCallback } from "react";

/* ─── Local dictionary (checked BEFORE the API) ─────────────────────── */

export const HI_DICTIONARY: Record<string, string> = {
  // Occupations
  farmer: "किसान",
  housewife: "गृहिणी",
  doctor: "डॉक्टर",
  engineer: "इंजीनियर",
  business: "व्यवसाय",
  businessman: "व्यवसायी",
  advocate: "अधिवक्ता",
  lawyer: "वकील",
  retired: "सेवानिवृत्त",
  student: "विद्यार्थी",
  service: "नौकरी",
  shop: "दुकान",
  shopkeeper: "दुकानदार",
  agriculture: "कृषि",
  "government service": "सरकारी नौकरी",
  "private job": "निजी नौकरी",
  "private service": "निजी नौकरी",
  accountant: "लेखाकार",
  clerk: "लिपिक",
  nurse: "नर्स",
  pharmacist: "फार्मासिस्ट",
  contractor: "ठेकेदार",
  mechanic: "मैकेनिक",
  tailor: "दर्जी",
  carpenter: "बढ़ई",
  painter: "चित्रकार",
  driver: "ड्राइवर",
  police: "पुलिस",
  army: "सेना",
  // Education
  "b.a.": "बी.ए.",
  "m.a.": "एम.ए.",
  "b.sc.": "बी.एससी.",
  "m.sc.": "एम.एससी.",
  "b.com.": "बी.कॉम.",
  "m.com.": "एम.कॉम.",
  "b.tech.": "बी.टेक.",
  "m.tech.": "एम.टेक.",
  "b.e.": "बी.ई.",
  "m.b.b.s.": "एम.बी.बी.एस.",
  mbbs: "एम.बी.बी.एस.",
  "ph.d.": "पीएच.डी.",
  phd: "पीएच.डी.",
  ba: "बी.ए.",
  ma: "एम.ए.",
  bsc: "बी.एससी.",
  msc: "एम.एससी.",
  bcom: "बी.कॉम.",
  mcom: "एम.कॉम.",
  btech: "बी.टेक.",
  mtech: "एम.टेक.",
  "10th": "10वीं",
  "12th": "12वीं",
  "8th": "8वीं",
  "5th": "5वीं",
  graduate: "स्नातक",
  "post graduate": "स्नातकोत्तर",
  postgraduate: "स्नातकोत्तर",
  illiterate: "अशिक्षित",
  literate: "साक्षर",
  diploma: "डिप्लोमा",
  // Cities / geography
  jaipur: "जयपुर",
  delhi: "दिल्ली",
  mumbai: "मुंबई",
  kota: "कोटा",
  ajmer: "अजमेर",
  udaipur: "उदयपुर",
  jodhpur: "जोधपुर",
  bikaner: "बीकानेर",
  alwar: "अलवर",
  bharatpur: "भरतपुर",
  sikar: "सीकर",
  nagaur: "नागौर",
  tonk: "टोंक",
  bundi: "बूंदी",
  chittorgarh: "चित्तौड़गढ़",
  bhilwara: "भीलवाड़ा",
  india: "भारत",
  rajasthan: "राजस्थान",
  "madhya pradesh": "मध्य प्रदेश",
  "uttar pradesh": "उत्तर प्रदेश",
  gujarat: "गुजरात",
  maharashtra: "महाराष्ट्र",
  haryana: "हरियाणा",
  punjab: "पंजाब",
  // Marital / family
  married: "विवाहित",
  unmarried: "अविवाहित",
  divorced: "तलाकशुदा",
  // General
  none: "कोई नहीं",
  nil: "शून्य",
  na: "लागू नहीं",
  "not applicable": "लागू नहीं",
};

/* ─── Honorific prefixes (mapped directly, no API call) ──────────────── */

const HONORIFICS: Record<string, string> = {
  shri: "श्री",
  shree: "श्री",
  sri: "श्री",
  smt: "श्रीमती",
  "smt.": "श्रीमती",
  late: "स्वर्गीय",
  "late.": "स्वर्गीय",
  dr: "डॉ.",
  "dr.": "डॉ.",
  mr: "श्री",
  "mr.": "श्री",
  mrs: "श्रीमती",
  "mrs.": "श्रीमती",
  ms: "सुश्री",
  "ms.": "सुश्री",
};

/* ─── Devanagari detection ───────────────────────────────────────────── */

const DEVANAGARI_RE = /[\u0900-\u097F]/;

/* ─── In-memory cache ────────────────────────────────────────────────── */

const cache = new Map<string, string | null>();

/* ─── Single-word transliteration ────────────────────────────────────── */

export async function transliterateWord(word: string): Promise<string | null> {
  const key = word.toLowerCase().trim();
  if (!key) return null;

  // Devanagari pass-through
  if (DEVANAGARI_RE.test(key)) return word;

  // Honorific
  if (HONORIFICS[key]) return HONORIFICS[key];

  // Cache hit
  if (cache.has(key)) return cache.get(key) ?? null;

  // Dictionary hit
  if (HI_DICTIONARY[key]) {
    cache.set(key, HI_DICTIONARY[key]);
    return HI_DICTIONARY[key];
  }

  // API call (proxied through our own route to avoid CORS blocks)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `/api/transliterate/hi/${encodeURIComponent(key)}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) {
      // Server error — do NOT cache (transient), allow retry next call
      return null;
    }
    const json = (await res.json()) as { result?: string[] | string };
    const raw = json.result;
    const result = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
    // Only cache when the API actually responded — null here means "no suggestion"
    cache.set(key, result);
    return result;
  } catch {
    // Network/timeout error — do NOT cache (transient), allow retry next call
    return null;
  }
}

/* ─── Phrase transliteration ─────────────────────────────────────────── */

export async function transliteratePhrase(phrase: string): Promise<string | null> {
  const trimmed = phrase.trim();
  if (!trimmed) return null;

  // Full-phrase dictionary lookup first (lowercase)
  const lower = trimmed.toLowerCase();
  if (HI_DICTIONARY[lower]) return HI_DICTIONARY[lower];

  const words = trimmed.split(/\s+/);
  const results = await Promise.all(words.map((w) => transliterateWord(w)));

  // If ANY word failed, return null
  if (results.some((r) => r === null)) return null;

  return results.join(" ");
}

/* ─── React hook: useAutoHindi ───────────────────────────────────────── */

/**
 * Silently auto-fills a Hindi field from its English counterpart.
 *
 * - Fires on 800ms debounce after englishValue changes (or on blur via the
 *   returned `onBlurEnglish` callback).
 * - Never overwrites a Hindi value the user hand-edited.
 * - Tracks the last auto-filled value so a re-edit of English refreshes it
 *   only if Hindi still matches the previous auto-fill.
 * - `setHindi(value)` should update the form state for the Hindi field.
 * - `setFilling(busy)` is an optional callback to show a shimmer.
 *
 * Returns `{ onBlurEnglish }` to attach to the English input.
 */
export function useAutoHindi(
  englishValue: string,
  hindiValue: string,
  setHindi: (v: string) => void,
  setFilling?: (busy: boolean) => void,
) {
  const lastAutoRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(false);
  const seqRef = useRef(0); // monotonically increasing sequence for race prevention

  const doFill = useCallback(
    async (enVal: string) => {
      const trimmed = enVal.trim();
      if (!trimmed) return;
      const mySeq = ++seqRef.current;
      setFilling?.(true);
      abortRef.current = false;
      const result = await transliteratePhrase(trimmed);
      // Only apply if this is still the latest request and component is alive
      if (abortRef.current || mySeq !== seqRef.current) { setFilling?.(false); return; }
      if (result) {
        lastAutoRef.current = result;
        setHindi(result);
      }
      setFilling?.(false);
    },
    [setHindi, setFilling],
  );

  // Debounced auto-fill when English value changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const enTrimmed = englishValue.trim();
    const hiTrimmed = hindiValue.trim();

    // Nothing to fill if English is empty
    if (!enTrimmed) return;

    // Hindi is non-empty and was NOT auto-filled (user typed it) → don't touch
    if (hiTrimmed && hiTrimmed !== lastAutoRef.current) return;

    // Hindi is empty OR still matches the last auto-fill → (re)fill after debounce
    timerRef.current = setTimeout(() => {
      doFill(enTrimmed);
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [englishValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /** Call this on the English input's onBlur to fill immediately. */
  const onBlurEnglish = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const enTrimmed = englishValue.trim();
    const hiTrimmed = hindiValue.trim();
    if (!enTrimmed) return;
    if (hiTrimmed && hiTrimmed !== lastAutoRef.current) return;
    doFill(enTrimmed);
  }, [englishValue, hindiValue, doFill]);

  return { onBlurEnglish };
}

/* ─── Pre-save sweep ─────────────────────────────────────────────────── */

/**
 * Fill any still-empty Hindi fields before save. Non-blocking: if the API
 * fails, the pair is skipped (Hindi stays empty). Returns updated edits.
 *
 * @param edits       current form values (Record<string, string>)
 * @param pairs       array of [hindiKey, englishKey] tuples
 */
export async function sweepAutoHindi(
  edits: Record<string, string>,
  pairs: [string, string][],
): Promise<Record<string, string>> {
  const updated = { ...edits };
  const pending: Promise<void>[] = [];

  for (const [hiKey, enKey] of pairs) {
    const enVal = (updated[enKey] || "").trim();
    const hiVal = (updated[hiKey] || "").trim();
    if (enVal && !hiVal) {
      pending.push(
        transliteratePhrase(enVal).then((result) => {
          if (result) updated[hiKey] = result;
        }),
      );
    }
  }

  await Promise.all(pending);
  return updated;
}
