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

  // Rate limit: max 10 comments per 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: recentComments } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("author_id", user.id)
    .gte("created_at", fiveMinAgo);
  if ((recentComments ?? 0) >= 10) {
    return NextResponse.json({ error: "Commenting too fast. Please slow down." }, { status: 429 });
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

  // Detect @mentions in comment
  const mentionRegex = /@([a-z0-9_]+)/gi;
  const mentionedUsernames = [...content.matchAll(mentionRegex)].map((m) => m[1]);
  if (mentionedUsernames.length > 0) {
    const { data: mentionedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .in("username", mentionedUsernames.slice(0, 5));
    if (mentionedProfiles) {
      const mentionNotifs = mentionedProfiles
        .filter((p) => p.id !== user.id)
        .map((p) => ({ user_id: p.id, actor_id: user.id, type: "mention" as const, post_id: postId, comment_id: comment.id }));
      if (mentionNotifs.length > 0) {
        await supabase.from("notifications").insert(mentionNotifs);
      }
    }
  }

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
