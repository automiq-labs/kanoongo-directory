"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Lang } from "./translations";

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "hi",
  toggleLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("hi");

  // Restore persisted language on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kanoongo-lang");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted lang on mount, not a cascading render
      if (stored === "en" || stored === "hi") setLang(stored);
    } catch { /* private browsing */ }
  }, []);

  // Persist language + sync body class on every change
  useEffect(() => {
    try { localStorage.setItem("kanoongo-lang", lang); } catch { /* private browsing */ }
    document.body.classList.toggle("lang-en", lang === "en");
  }, [lang]);

  function toggleLang() {
    setLang((prev) => (prev === "hi" ? "en" : "hi"));
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
