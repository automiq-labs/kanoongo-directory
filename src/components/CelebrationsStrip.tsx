"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/language-context";
import { getCelebrations } from "@/lib/celebrations";

export default function CelebrationsStrip() {
  const { lang } = useLang();
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await getCelebrations(supabase, 7);
      if (!cancelled) {
        setCount(data.length);
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  if (!loaded || count === 0) return null;

  const label =
    lang === "en"
      ? `🎉 ${count} celebration${count === 1 ? "" : "s"} this week →`
      : `🎉 इस सप्ताह ${count} उत्सव →`;

  return (
    <Link
      href="/celebrations"
      className="mb-4 flex min-h-[44px] w-full items-center justify-center rounded-[var(--r)] border border-[var(--hairline)] bg-[var(--raised)] px-4 text-center text-sm font-medium text-[var(--maroon)] shadow-card motion-safe:transition-[transform,box-shadow] motion-safe:duration-[var(--dur)] hover:-translate-y-[1px] hover:shadow-lift active:scale-[.99]"
    >
      {label}
    </Link>
  );
}
