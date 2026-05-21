import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const reactionSchema = z.object({
  type: z.enum(["fire", "skull", "lol", "sob", "brain", "zap"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId } = await params;
  const body = await request.json();
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });

  const { type } = parsed.data;

  // Toggle reaction
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .eq("type", type)
    .single();

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed" });
  } else {
    await supabase.from("reactions").insert({
      user_id: user.id,
      post_id: postId,
      type,
    });

    // Notify post author (not self)
    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .single();

    if (post && post.author_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: post.author_id,
        actor_id: user.id,
        type: "reaction",
        post_id: postId,
      });
    }

    return NextResponse.json({ action: "added" });
  }
}
