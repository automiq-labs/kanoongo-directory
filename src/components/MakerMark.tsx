export function MakerMark() {
  return (
    <div className="border-t border-[var(--border-warm)] bg-[var(--cream-panel)] py-3 text-center">
      <p className="text-[11px] tracking-wide text-[var(--gold-deep)]">
        Built by Automiq Labs ·{" "}
        <a href="https://www.automiqlabs.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--maroon)]">
          automiqlabs.com
        </a>
      </p>
    </div>
  );
}
