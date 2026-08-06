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

/**
 * A candidate token is a run starting with an alphanumeric and continuing through
 * alphanumerics and dots — so the dictionary's abbreviations ("b.a.", "m.b.b.s.")
 * survive tokenisation. Everything else is a separator.
 */
const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9.]*/g;

/**
 * ...but a token has to contain a Latin letter to count as a *word*. A run of
 * digits is not English awaiting transliteration; it is a number, and the
 * register writes numbers in Latin digits inside Devanagari text. 271 of the 448
 * stored address values do exactly that, against 5 in Devanagari
 * ("ए-38,कृष्णा नगर-2"), and S21 already ruled that Latin digits stay in the
 * printed book. Without this test "90/1" transliterated to "९०/१".
 *
 * Digit-only runs are simply not consumed by the tokeniser, so they stay in the
 * surrounding separator run and pass through verbatim.
 *
 * No `g` flag — this is a predicate, and a sticky lastIndex would make it
 * answer differently on identical input.
 */
const LATIN_LETTER_RE = /[A-Za-z]/;

export async function transliteratePhrase(phrase: string): Promise<string | null> {
  const trimmed = phrase.trim();
  if (!trimmed) return null;

  // Full-phrase dictionary lookup first (lowercase)
  const lower = trimmed.toLowerCase();
  if (HI_DICTIONARY[lower]) return HI_DICTIONARY[lower];

  /*
   * S22: this used to split on whitespace and hand every resulting chunk to the
   * API, then return null if ANY chunk failed. Two consequences, both seen in
   * production:
   *
   *   * "Founder - Automiq Labs" contains a bare "-", which no transliteration
   *     service will render, so the whole phrase was abandoned and the field's
   *     corrupt Hindi value survived every save.
   *   * "Madhyam Marg, Mansarovar" came back as "माध्यम मार्ग मानसरोवर" — the
   *     chunks were rejoined with single spaces, silently dropping the comma
   *     (and any other attached punctuation).
   *
   * Tokenising into words and separators fixes both: separators pass through
   * verbatim and can no longer fail, and only real words are sent to the API.
   * Devanagari input falls into the separator class and passes through unchanged,
   * which is the same result the old per-word Devanagari check produced.
   */
  const words: string[] = [];
  const separators: string[] = [];
  let cursor = 0;
  TOKEN_RE.lastIndex = 0;
  for (let m = TOKEN_RE.exec(trimmed); m; m = TOKEN_RE.exec(trimmed)) {
    // Digits and dots only — leave the token where it is. `cursor` does not move,
    // so the run is absorbed into the next separator slice (or into `tail`) and
    // is emitted unchanged.
    if (!LATIN_LETTER_RE.test(m[0])) continue;
    separators.push(trimmed.slice(cursor, m.index));
    words.push(m[0]);
    cursor = m.index + m[0].length;
  }
  const tail = trimmed.slice(cursor);

  // Nothing to transliterate — already Devanagari, or a pure number like "90/1".
  // Hand it back as-is.
  if (words.length === 0) return trimmed;

  const results = await Promise.all(words.map((w) => transliterateWord(w)));

  // A genuine word failing still fails the phrase: a half-transliterated value
  // would put Latin back into a Hindi column, which is the thing we are fixing.
  if (results.some((r) => r === null)) return null;

  return words.map((_, i) => separators[i] + results[i]).join("") + tail;
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

    // Hindi is non-empty, was NOT auto-filled (user typed it), and is actually
    // Hindi → don't touch. Latin residue with no Devanagari beside it is not
    // user-authored Hindi however it got there, so it stays eligible for refill
    // (S22). Digits alone are not residue — see isNotHindi.
    if (hiTrimmed && hiTrimmed !== lastAutoRef.current && !isNotHindi(hiTrimmed)) return;

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
    if (hiTrimmed && hiTrimmed !== lastAutoRef.current && !isNotHindi(hiTrimmed)) return;
    doFill(enTrimmed);
  }, [englishValue, hindiValue, doFill]);

  return { onBlurEnglish };
}

/* ─── Pre-save sweep ─────────────────────────────────────────────────── */

/**
 * True when a Hindi column holds something that cannot be Hindi: a Latin letter,
 * and no Devanagari anywhere to go with it.
 *
 * This is the check that catches the S22 corruption class. Until S22 the sweep
 * only filled *empty* Hindi fields, so a Hindi column left holding "D" survived
 * every subsequent save — both this sweep and useAutoHindi treat a non-empty
 * value as user-authored and refuse to touch it. Latin with no Devanagari beside
 * it was never user-authored Hindi, so it is safe to re-derive from English.
 *
 * A value with no Latin letter in it is NOT evidence of corruption, even with no
 * Devanagari: "90/1" is a house number, and a house number is written in Latin
 * digits in the Hindi column by the register's own convention (see
 * LATIN_LETTER_RE above). Two consequences of getting this wrong, both real:
 * a legitimate digit-only address would be clobbered by whatever the English
 * column holds, and — since transliteratePhrase now returns digit-only input
 * unchanged — the sweep could never converge on it, re-deriving the same value
 * on every save forever.
 *
 * The cost is that a digit-only value that IS residue can no longer be
 * distinguished from a genuine house number, so it is left alone. That is the
 * right way round: it repairs on the next real edit to the field.
 */
function isNotHindi(value: string): boolean {
  return LATIN_LETTER_RE.test(value) && !DEVANAGARI_RE.test(value);
}

/**
 * Fill Hindi fields before save. Non-blocking: if the API fails the pair is
 * skipped and the existing value is left alone. Returns updated edits.
 *
 * A Hindi field is (re)filled when it is empty OR when it holds Latin with no
 * Devanagari beside it, while the English side has content — see isNotHindi above.
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
    if (enVal && (!hiVal || isNotHindi(hiVal))) {
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

/**
 * The reverse leg: copy the Hindi value verbatim into an English field that is
 * empty, or that holds the truncated residue of the pre-S22 per-keystroke
 * mirror (see setEditVal in family-card-client).
 *
 * Deliberately verbatim rather than transliterated — there is no Hindi→Latin
 * service here, and a verbatim Devanagari value in `_en` still renders through
 * bi()'s fallback, whereas a single stray character does not.
 *
 * Synchronous: no network involved.
 */
export function fillMissingEnglish(
  edits: Record<string, string>,
  pairs: [string, string][],
): Record<string, string> {
  const updated = { ...edits };
  for (const [hiKey, enKey] of pairs) {
    const hiVal = (updated[hiKey] || "").trim();
    const enVal = (updated[enKey] || "").trim();
    if (!hiVal) continue;
    // Empty, or a strict prefix shorter than the Hindi it was mirrored from —
    // the exact signature of the first-character bug.
    const isTruncatedMirror = enVal !== "" && enVal.length < hiVal.length && hiVal.startsWith(enVal);
    if (!enVal || isTruncatedMirror) updated[enKey] = hiVal;
  }
  return updated;
}
