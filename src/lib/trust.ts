import { createServiceClient } from "@/lib/supabase/server";

export const TRUST_DELTAS = {
  FIRST_POST: +5,
  DAILY_ACTIVE: +1,
  RECEIVED_POSITIVE_REACTION: +1,
  INVITED_TRUSTED_USER: +10,
  ACCOUNT_AGE_7_DAYS: +5,
  ACCOUNT_AGE_30_DAYS: +10,
  REPORTED_CONFIRMED: -15,
  SPAM_DETECTED: -20,
  HARASSMENT_CONFIRMED: -25,
  INVITE_ABUSE: -30,
  MASS_POSTING: -10,
  TOXIC_INTERACTION: -10,
  SHADOWBAN_LIFTED: -5,
} as const;

export async function adjustTrustScore(
  userId: string,
  delta: number,
  reason: string
): Promise<void> {
  const supabase = await createServiceClient();

  await supabase.from("trust_events").insert({
    user_id: userId,
    delta,
    reason,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("trust_score")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const newScore = Math.max(0, Math.min(100, profile.trust_score + delta));
  const updates: Record<string, unknown> = { trust_score: newScore };
  if (newScore < 20) updates.is_suspicious = true;
  if (newScore < 30) updates.can_invite = false;

  await supabase.from("profiles").update(updates).eq("id", userId);
}

export async function detectSuspiciousActivity(userId: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const { count: recentPosts } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", oneHourAgo);

  const { count: recentReports } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("reported_user", userId)
    .gte("created_at", oneHourAgo);

  const isSuspicious = (recentPosts ?? 0) > 20 || (recentReports ?? 0) > 3;

  if (isSuspicious) {
    await supabase
      .from("profiles")
      .update({ is_suspicious: true })
      .eq("id", userId);

    await adjustTrustScore(userId, TRUST_DELTAS.SPAM_DETECTED, "Suspicious activity detected");
  }

  return isSuspicious;
}
