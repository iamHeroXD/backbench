import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scanContent } from "@/lib/moderation";
import { z } from "zod";

const schema = z.object({
  content: z.string().min(10).max(500),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { content } = parsed.data;
  const scan = scanContent(content);
  if (scan.isBlocked) return NextResponse.json({ error: "Content not allowed." }, { status: 400 });

  // Rate limit: 3 spotted posts per day
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const { count } = await supabase
    .from("spotted_posts")
    .select("*", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", dayAgo);

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "Daily limit reached. Try again tomorrow." }, { status: 429 });
  }

  await supabase.from("spotted_posts").insert({
    sender_id: user.id,
    content,
    is_approved: false,
  });

  return NextResponse.json({ success: true });
}
