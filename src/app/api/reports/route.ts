import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const reportSchema = z.object({
  reportedUser: z.string().uuid().optional(),
  postId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  reason: z.enum(["harassment", "bullying", "spam", "fake_account", "creepy_behavior", "doxxing", "impersonation", "other"]),
  details: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 });

  const { reportedUser, postId, commentId, reason, details } = parsed.data;

  // Prevent duplicate reports in 24h
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const conditions = [
    reportedUser ? `reported_user.eq.${reportedUser}` : "",
    postId ? `post_id.eq.${postId}` : "",
    commentId ? `comment_id.eq.${commentId}` : "",
  ].filter(Boolean);

  if (conditions.length > 0) {
    const existing = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("is_resolved", false)
      .gte("created_at", dayAgo)
      .or(conditions.join(","));

    if ((existing.data?.length ?? 0) > 0) {
      return NextResponse.json({ success: true, message: "Already reported." });
    }
  }

  await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_user: reportedUser ?? null,
    post_id: postId ?? null,
    comment_id: commentId ?? null,
    reason,
    details: details ?? null,
  });

  return NextResponse.json({ success: true });
}
