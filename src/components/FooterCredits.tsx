"use client";

import React from "react";
import { useLang } from "@/lib/language-context";
import { t } from "@/lib/translations";

const LINK_RE = /(\d{10})|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

/** Render a text string with phone numbers as tel: links and emails as mailto: links */
function Linkified({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LINK_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const val = match[0];
    if (match[1]) {
      // Phone number
      parts.push(
        <a key={match.index} href={`tel:+91${val}`} className="underline underline-offset-2 hover:text-[var(--maroon)]">{val}</a>
      );
    } else {
      // Email
      parts.push(
        <a key={match.index} href={`mailto:${val}`} className="underline underline-offset-2 hover:text-[var(--maroon)]">{val}</a>
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function FooterCredits({ className }: { className?: string }) {
  const { lang } = useLang();
  return (
    <div className={`text-center ${className || ""}`}>
      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        <Linkified text={t("footer_attribution", lang)} />
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
        <Linkified text={t("footer_support", lang)} />
      </p>
    </div>
  );
}
