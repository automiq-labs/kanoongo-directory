"use client";

interface InitialsAvatarProps {
  name: string;
  nameEn?: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  deceased?: boolean;
}

const SIZES = {
  sm: "h-10 w-10 text-lg",
  md: "h-14 w-14 text-xl",
  lg: "h-[88px] w-[88px] text-3xl",
} as const;

function getInitials(nameEn?: string | null, name?: string): string {
  const src = (nameEn || name || "").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function InitialsAvatar({
  name,
  nameEn,
  photoUrl,
  size = "lg",
  deceased = false,
}: InitialsAvatarProps) {
  const dim = SIZES[size];
  const ringClass = deceased
    ? "border-[1.5px] border-[var(--gold)] opacity-70"
    : "border-[1.5px] border-[var(--gold)]";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${dim} rounded-full object-cover ${ringClass} ${deceased ? "saturate-[.55]" : ""}`}
      />
    );
  }

  const initials = getInitials(nameEn, name);

  return (
    <div
      className={`flex ${dim} items-center justify-center rounded-full bg-[var(--cream-panel)] font-display font-bold text-[var(--maroon)] ${ringClass}`}
    >
      {initials}
    </div>
  );
}
