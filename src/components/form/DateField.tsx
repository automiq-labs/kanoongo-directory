"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface DateFieldProps {
  value: string;
  onChange: (isoString: string) => void;
  label?: string;
  placeholder?: string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseISO(v: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplay(v: string): string {
  const parsed = parseISO(v);
  if (!parsed) return v || "";
  return `${parsed.day} ${MONTH_NAMES[parsed.month]} ${parsed.year}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function DateField({
  value,
  onChange,
  label,
  placeholder = "Select date",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [yearInput, setYearInput] = useState(false);

  const parsed = parseISO(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setYearInput(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setYearInput(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Focus year input when opened
  useEffect(() => {
    if (yearInput && yearInputRef.current) {
      yearInputRef.current.focus();
      yearInputRef.current.select();
    }
  }, [yearInput]);

  const handleOpen = useCallback(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
    setOpen(true);
  }, [parsed]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDay(day: number) {
    onChange(toISO(viewYear, viewMonth, day));
    setOpen(false);
    setYearInput(false);
  }

  function handleYearSubmit(yearStr: string) {
    const y = Number(yearStr);
    if (y >= 1900 && y <= 2100) {
      setViewYear(y);
    }
    setYearInput(false);
  }

  // Build grid
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const displayText = formatDisplay(value);

  return (
    <div className="relative border-b border-[var(--hairline)] py-2 last:border-0" ref={containerRef}>
      {label && (
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex min-h-[48px] w-full items-center rounded-[var(--r)] border border-[#ECE0C8] bg-white px-3 py-2 text-left text-base text-[var(--maroon-deep)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 focus:outline-none"
      >
        <span className={displayText ? "" : "text-[var(--muted)]"}>
          {displayText || placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="ml-auto h-5 w-5 shrink-0 text-[var(--muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar popover */}
      {open && (
        <div
          className="absolute left-0 z-50 mt-1 w-full min-w-[280px] rounded-[var(--r-lg)] border border-[#ECE0C8] bg-[var(--raised)] shadow-[var(--shadow-lift)] motion-safe:animate-[fadeIn_var(--dur-fast)_var(--ease-out)]"
          role="dialog"
          aria-modal="true"
          aria-label="Date picker"
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-[var(--r-lg)] bg-[var(--maroon)] px-3 py-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--gold)] hover:bg-[var(--maroon-deep)]"
              aria-label="Previous month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-semibold text-[var(--ivory)]">
                {MONTH_NAMES_FULL[viewMonth]}
              </span>
              {yearInput ? (
                <input
                  ref={yearInputRef}
                  type="number"
                  defaultValue={viewYear}
                  min={1900}
                  max={2100}
                  onBlur={(e) => handleYearSubmit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleYearSubmit((e.target as HTMLInputElement).value);
                  }}
                  className="w-16 rounded bg-[var(--maroon-deep)] px-1.5 py-0.5 text-center text-sm font-semibold text-[var(--ivory)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setYearInput(true)}
                  className="rounded px-1.5 py-0.5 font-display text-sm font-semibold text-[var(--gold)] hover:bg-[var(--maroon-deep)]"
                >
                  {viewYear}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--gold)] hover:bg-[var(--maroon-deep)]"
              aria-label="Next month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 border-b border-[var(--hairline)] px-2 py-1.5">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5 px-2 py-2">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`e${i}`} />;
              }
              const isSelected =
                parsed &&
                parsed.year === viewYear &&
                parsed.month === viewMonth &&
                parsed.day === day;
              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`flex h-9 w-9 mx-auto items-center justify-center rounded-full text-sm motion-safe:transition-colors motion-safe:duration-[var(--dur-fast)] ${
                    isSelected
                      ? "bg-[var(--gold)] font-bold text-white"
                      : isToday
                        ? "border border-[var(--gold)] font-medium text-[var(--maroon-deep)]"
                        : "text-[var(--maroon-deep)] hover:bg-[var(--cream-panel)]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
