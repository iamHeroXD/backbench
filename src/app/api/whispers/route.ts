import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scanContent } from "@/lib/moderation";
import { z } from "zod";

const whisperSchema = z.object({
  content: z.string().min(10).max(1000),
  imageUrl: z.string().url().optional(),
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

  await supabase.from("whispers").insert({
    content,
    image_url: imageUrl ?? null,
    status: "pending",
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
