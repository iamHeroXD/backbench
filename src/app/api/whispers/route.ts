import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scanContent } from "@/lib/moderation";
import { z } from "zod";

const whisperSchema = z.object({
  content: z.string().min(10).max(1000),
  imageUrl: z.string().url().refine(
    (url) => { try { return new URL(url).hostname.endsWith(".supabase.co"); } catch { return false; } },
    { message: "Image must be from Backbench storage." }
  ).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = whisperSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { content, imageUrl } = parsed.data;
  const scan = scanContent(content);
  if (scan.isBlocked) {
    return NextResponse.json({ error: "Content not allowed." }, { status: 400 });
  }

  // Per-IP rate limit: max 5 whispers per hour
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const ipHash = createHash("sha256").update(ip + "bb-whisper-salt-2024").digest("hex").slice(0, 32);

  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("whispers")
    .select("*", { count: "exact", head: true })
    .eq("sender_ip_hash", ipHash)
    .gte("created_at", oneHourAgo);

  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json({ error: "You've sent too many whispers recently. Try again later." }, { status: 429 });
  }

  await supabase.from("whispers").insert({
    content,
    image_url: imageUrl ?? null,
    status: "pending",
    sender_ip_hash: ipHash,
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "moderator"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: whispers } = await supabase
    .from("whispers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ whispers: whispers ?? [] });
}
