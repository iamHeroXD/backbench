import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const storySchema = z.object({
  type: z.enum(["image", "text"]),
  content: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, is_muted, class_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_banned) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
  if (profile.is_muted) return NextResponse.json({ error: "Account muted." }, { status: 403 });

  const body = await request.json();
  const parsed = storySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { type, content, imageUrl, bgColor } = parsed.data;

  if (type === "text" && !content?.trim()) {
    return NextResponse.json({ error: "Text story needs content." }, { status: 400 });
  }
  if (type === "image" && !imageUrl) {
    return NextResponse.json({ error: "Image URL required." }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  const { data: story, error } = await supabase
    .from("stories")
    .insert({
      author_id: user.id,
      type,
      content: content ?? null,
      image_url: imageUrl ?? null,
      bg_color: bgColor ?? null,
      class_name: profile.class_name ?? null,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create story." }, { status: 500 });

  return NextResponse.json({ success: true, story });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("id");
  if (!storyId) return NextResponse.json({ error: "Story ID required." }, { status: 400 });

  const { data: story } = await supabase.from("stories").select("author_id").eq("id", storyId).single();
  if (!story) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = ["admin", "moderator"].includes((profile as { role: string } | null)?.role ?? "");

  if (story.author_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  await supabase.from("stories").delete().eq("id", storyId);
  return NextResponse.json({ success: true });
}
