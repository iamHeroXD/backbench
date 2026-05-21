import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scanContent } from "@/lib/moderation";
import { z } from "zod";

const commentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId } = await params;

  const { data: comments, error } = await supabase
    .from("comments")
    .select(`
      *,
      profiles!author_id (id, username, display_name, avatar_url)
    `)
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });

  return NextResponse.json({ comments: comments ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: postId } = await params;

  // Check ban
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, is_muted")
    .eq("id", user.id)
    .single();

  if (profile?.is_banned || profile?.is_muted) {
    return NextResponse.json({ error: "Cannot comment at this time." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid comment" }, { status: 400 });

  const { content, parentId } = parsed.data;

  const scan = scanContent(content);
  if (scan.isBlocked) {
    return NextResponse.json({ error: "Comment contains blocked content." }, { status: 400 });
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      content,
      parent_id: parentId ?? null,
      is_flagged: scan.isFlagged,
    })
    .select(`*, profiles!author_id (id, username, display_name, avatar_url)`)
    .single();

  if (error) return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });

  // Notify post author
  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (post && post.author_id !== user.id) {
    await supabase.from("notifications").insert({
      user_id: post.author_id,
      actor_id: user.id,
      type: "comment",
      post_id: postId,
      comment_id: comment.id,
    });
  }

  // Notify parent comment author if this is a reply
  if (parentId) {
    const { data: parentComment } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", parentId)
      .single();

    if (parentComment && parentComment.author_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: parentComment.author_id,
        actor_id: user.id,
        type: "reply",
        post_id: postId,
        comment_id: comment.id,
      });
    }
  }

  return NextResponse.json({ comment });
}
