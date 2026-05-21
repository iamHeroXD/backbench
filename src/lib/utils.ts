import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return format(d, "MMM d");
}

export function formatFullDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMMM d, yyyy");
}

export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export const REACTION_EMOJIS: Record<string, string> = {
  fire: "🔥",
  skull: "💀",
  lol: "😂",
  sob: "😭",
  brain: "🧠",
  zap: "⚡",
};

export const REACTION_LABELS: Record<string, string> = {
  fire: "Fire",
  skull: "💀",
  lol: "Lol",
  sob: "Oof",
  brain: "Big brain",
  zap: "Facts",
};

export const CLASS_OPTIONS = [
  "12 Science A",
  "12 Science B",
  "11 Science A",
  "11 Science B",
  "12 Commerce A",
  "12 Commerce B",
  "11 Commerce A",
  "11 Commerce B",
];

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [4, 4, 4];
  return segments
    .map((len) =>
      Array.from({ length: len }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("")
    )
    .join("-");
}

export function sanitizeContent(text: string): string {
  // Remove phone numbers
  text = text.replace(/\b(\+91|0)?[6-9]\d{9}\b/g, "[number removed]");
  // Remove email-like patterns
  text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[email removed]");
  return text;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

export function getAvatarFallback(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAuraLabel(score: number): string {
  if (score >= 1000) return "legendary";
  if (score >= 500) return "iconic";
  if (score >= 200) return "rising";
  if (score >= 50) return "known";
  return "new";
}

export function getTrustLabel(score: number): string {
  if (score >= 80) return "trusted";
  if (score >= 60) return "good";
  if (score >= 40) return "neutral";
  if (score >= 20) return "low";
  return "flagged";
}
