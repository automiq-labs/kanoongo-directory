"use client";

import { useLang } from "@/lib/language-context";
import { useEffect } from "react";

export default function LanguageToggle() {
  const { lang, toggleLang } = useLang();

  useEffect(() => {
    document.body.classList.toggle("lang-en", lang === "en");
  }, [lang]);

  return (
    <button
      onClick={toggleLang}
      className="rounded-[20px] border border-[var(--gold)]/40 px-3 py-1 text-xs font-medium tracking-wide text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)]"
    >
      {lang === "hi" ? "English" : "हिंदी"}
    </button>
  );
}
