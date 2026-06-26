"use client";

import { useLang } from "@/lib/language-context";
import { useEffect } from "react";

export default function LanguageToggle({
  variant = "header",
}: {
  variant?: "header" | "page";
}) {
  const { lang, toggleLang } = useLang();

  useEffect(() => {
    document.body.classList.toggle("lang-en", lang === "en");
  }, [lang]);

  const cls =
    variant === "page"
      ? "min-h-[40px] rounded-[20px] border border-[var(--gold)] bg-[var(--maroon)] px-4 py-2 text-sm font-medium tracking-wide text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)] active:bg-[var(--maroon-deep)]"
      : "min-h-[36px] rounded-[20px] border border-[var(--gold)]/40 px-3 py-1.5 text-xs font-medium tracking-wide text-[var(--ivory)] transition-colors hover:bg-[var(--maroon-deep)] active:bg-[var(--maroon-deep)]";

  return (
    <button onClick={toggleLang} className={cls}>
      {lang === "hi" ? "English" : "हिंदी"}
    </button>
  );
}
