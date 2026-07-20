/**
 * Transliteration proxy — keeps CORS out of the browser.
 *
 * Provider chain: Google Input Tools primary (AI4Bharat xlit-api unreachable
 * as of 2026-07-18, kept as fallback so it self-heals if their service returns).
 *
 * Response contract: { result: string[] } on success, { result: null } on failure.
 */

import { NextResponse } from "next/server";

const SUCCESS_CACHE = {
  "Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=86400",
};
const FAIL_CACHE = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string; word: string }> },
) {
  const { lang, word } = await params;

  if (!/^[a-z]{2}$/.test(lang) || !word || word.length > 70) {
    return NextResponse.json({ result: null }, { status: 400 });
  }

  /* ── PRIMARY: Google Input Tools (Hindi only) ─────────────────────── */
  if (lang === "hi") {
    try {
      const gc = new AbortController();
      const gt = setTimeout(() => gc.abort(), 4000);
      const gRes = await fetch(
        `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=hi-t-i0-und&num=3`,
        {
          signal: gc.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
          },
        },
      );
      clearTimeout(gt);

      if (gRes.ok) {
        const j = await gRes.json();
        const ok = Array.isArray(j) && j[0] === "SUCCESS";
        const suggestions: unknown = ok ? j?.[1]?.[0]?.[1] : null;
        if (
          Array.isArray(suggestions) &&
          suggestions.length > 0 &&
          suggestions.every((s) => typeof s === "string")
        ) {
          return NextResponse.json(
            { result: suggestions as string[] },
            { headers: SUCCESS_CACHE },
          );
        }
      }
    } catch {
      // Google failed — fall through to AI4Bharat
    }
  }

  /* ── FALLBACK: AI4Bharat xlit-api ─────────────────────────────────── */
  try {
    const ac = new AbortController();
    const at = setTimeout(() => ac.abort(), 2500);
    const aRes = await fetch(
      `https://xlit-api.ai4bharat.org/tl/${lang}/${encodeURIComponent(word)}`,
      {
        signal: ac.signal,
        headers: {
          "User-Agent":
            "KanoongoDirectory/1.0 (family directory; contact shreyansh@automiqlabs.com)",
        },
      },
    );
    clearTimeout(at);

    if (aRes.ok) {
      const json = (await aRes.json()) as { result?: string[] | string };
      const raw = json.result;
      // Normalize to string[]
      const result = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? [raw]
          : null;
      if (result && result.length > 0) {
        return NextResponse.json({ result }, { headers: SUCCESS_CACHE });
      }
    }
  } catch {
    // AI4Bharat also failed
  }

  /* ── BOTH FAILED ──────────────────────────────────────────────────── */
  return NextResponse.json(
    { result: null },
    { status: 502, headers: FAIL_CACHE },
  );
}
