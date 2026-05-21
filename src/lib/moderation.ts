const BLOCKED_PATTERNS = [
  /\b(\+91|0)?[6-9]\d{9}\b/g, // Indian phone numbers
  /\b\d{10,12}\b/g, // Generic phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
  /\b(kill|murder|rape|suicide|bomb|attack)\s+(yourself|him|her|them|you)\b/gi, // Direct threats
  /doxx(ing)?/gi,
];

const SPAM_PHRASES = [
  "click here",
  "buy now",
  "free money",
  "make money fast",
  "telegram",
  "whatsapp group",
  "instagram follow",
];

export function scanContent(text: string): {
  isBlocked: boolean;
  isFlagged: boolean;
  cleanedText: string;
  reasons: string[];
} {
  let cleanedText = text;
  const reasons: string[] = [];
  let isBlocked = false;
  let isFlagged = false;

  // Check hard-blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      isBlocked = true;
      reasons.push("Contains blocked content");
      cleanedText = cleanedText.replace(pattern, "[removed]");
    }
    pattern.lastIndex = 0;
  }

  // Check spam phrases
  const lowerText = text.toLowerCase();
  for (const phrase of SPAM_PHRASES) {
    if (lowerText.includes(phrase)) {
      isFlagged = true;
      reasons.push(`Contains spam-like phrase: "${phrase}"`);
    }
  }

  // Check excessive caps
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.6 && text.length > 20) {
    isFlagged = true;
    reasons.push("Excessive capitalization");
  }

  // Check repetitive characters
  if (/(.)\1{5,}/.test(text)) {
    isFlagged = true;
    reasons.push("Repetitive characters detected");
  }

  return { isBlocked, isFlagged, cleanedText, reasons };
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Only JPEG, PNG, WebP, and GIF images are allowed." };
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: "Image must be under 5MB." };
  }

  return { valid: true };
}

export function sanitizeUsername(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function validateInviteCode(code: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}
