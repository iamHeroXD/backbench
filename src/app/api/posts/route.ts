import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scanContent } from "@/lib/moderation";
import { z } from "zod";

const createPostSchema = z.object({
  type: z.enum(["text", "image", "poll"]),
  content: z.string().min(1).max(2000).optional(),
  imageUrl: z.string().url().refine(
    (url) => { try { return new URL(url).hostname.endsWith(".supabase.co"); } catch { return false; } },
    { message: "Image must be from Backbench storage." }
  ).optional(),
  isAnonymous: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  // For polls
  pollQuestion: z.string().max(300).optional(),
  pollOptions: z.array(z.string().max(100)).min(2).max(6).optional(),
  pollExpiresHours: z.number().min(1).max(168).default(24).optional(),
  pollAnonymous: z.boolean().default(false).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check ban/mute
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, is_muted, trust_score")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_banned) {
    return NextResponse.json({ error: "Account suspended." }, { status: 403 });
  }
  if (profile.is_muted) {
    return NextResponse.json({ error: "Account muted." }, { status: 403 });
  }

  // Rate limit: low trust = posting cooldown
  if (profile.trust_score < 30) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", user.id)
      .gte("created_at", fiveMinAgo);

    if ((count ?? 0) >= 2) {
      return NextResponse.json(
        { error: "Posting too fast. Please wait a few minutes." },
        { status: 429 }
      );
    }
  }

  const body = await request.json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { type, content, imageUrl, isAnonymous, tags, pollQuestion, pollOptions, pollExpiresHours, pollAnonymous } = parsed.data;

  // Content moderation
  if (content) {
    const scan = scanContent(content);
    if (scan.isBlocked) {
      return NextResponse.json(
        { error: "Your post contains content that isn't allowed here." },
        { status: 400 }
      );
    }
  }

  if (type === "text" && !content?.trim()) {
    return NextResponse.json({ error: "Post cannot be empty." }, { status: 400 });
  }
  if (type === "image" && !imageUrl) {
    return NextResponse.json({ error: "Image URL required." }, { status: 400 });
  }
  if (type === "poll" && (!pollQuestion || !pollOptions || pollOptions.length < 2)) {
    return NextResponse.json({ error: "Poll requires a question and at least 2 options." }, { status: 400 });
  }

  // Create post
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      type,
      content: content ?? null,
      image_url: imageUrl ?? null,
      is_anonymous: isAnonymous,
    })
    .select()
    .single();

  if (postError || !post) {
    console.error("[api/posts POST] insert error:", postError);
    return NextResponse.json({ error: "Failed to create post." }, { status: 500 });
  }

  // Detect @mentions and create notifications
  if (content) {
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
          .map((p) => ({ user_id: p.id, actor_id: user.id, type: "mention" as const, post_id: post.id }));
        if (mentionNotifs.length > 0) {
          await supabase.from("notifications").insert(mentionNotifs);
        }
      }
    }
  }

  // Add tags
  if (tags && tags.length > 0) {
    const tagInserts = tags.slice(0, 5).map((tag) => ({
      post_id: post.id,
      tag: tag.toLowerCase().slice(0, 30),
    }));
    await supabase.from("post_tags").insert(tagInserts);
  }

  // Create poll if needed
  if (type === "poll" && pollQuestion && pollOptions) {
    const expiresAt = new Date(
      Date.now() + (pollExpiresHours ?? 24) * 3600 * 1000
    ).toISOString();

    const { data: poll } = await supabase
      .from("polls")
      .insert({
        post_id: post.id,
        question: pollQuestion,
        anonymous_votes: pollAnonymous ?? false,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (poll) {
      await supabase.from("poll_options").insert(
        pollOptions.map((text, i) => ({
          poll_id: poll.id,
          text,
          position: i,
        }))
      );
    }
  }

  // Update aura
  const newAura = await supabase.rpc("compute_aura", { user_id: user.id });
  if (!newAura.error) {
    await supabase
      .from("profiles")
      .update({ aura_score: newAura.data })
      .eq("id", user.id);
  }

  // Award first_post achievement
  const { count: postCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("author_id", user.id)
    .eq("is_deleted", false);

  if ((postCount ?? 0) === 1) {
    await supabase.from("achievements").upsert(
      { user_id: user.id, type: "first_post" },
      { onConflict: "user_id,type", ignoreDuplicates: true }
    );
  }

  return NextResponse.json({ success: true, post });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const sort = searchParams.get("sort") ?? "for-you";

  let query = supabase
    .from("posts")
    .select(`
      *,
      profiles!author_id (id, username, display_name, avatar_url, is_shadowbanned, class_name),
      reactions (id, user_id, type),
      post_tags (tag),
      polls (id, question, expires_at, anonymous_votes, poll_options (id, text, position, poll_votes(count)))
    `)
    .eq("is_deleted", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  // For "latest" sort, skip pinned-first ordering and just show newest
  if (sort === "latest") {
    query = supabase
      .from("posts")
      .select(`
        *,
        profiles!author_id (id, username, display_name, avatar_url, is_shadowbanned, class_name),
        reactions (id, user_id, type),
        post_tags (tag),
        polls (id, question, expires_at, anonymous_votes, poll_options (id, text, position, poll_votes(count)))
      `)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;

  if (error) {
    console.error("[api/posts GET] fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch posts." }, { status: 500 });
  }

  // Filter shadowbanned posts (only show to themselves or admin)
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = currentProfile?.role === "admin" || currentProfile?.role === "moderator";

  const filtered = (posts ?? []).filter((post) => {
    const author = post.profiles as { is_shadowbanned: boolean; id: string } | null;
    if (!author) return false;
    if (author.is_shadowbanned && author.id !== user.id && !isAdmin) return false;
    return true;
  });

  // Sanitize: hide author identity for anonymous posts; strip is_shadowbanned for non-admins
  const sanitized = filtered.map((post) => {
    if (post.is_anonymous) return { ...post, profiles: null };
    if (!isAdmin && post.profiles) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { is_shadowbanned: _sb, ...safeProfile } = post.profiles as Record<string, unknown>;
      return { ...post, profiles: safeProfile };
    }
    return post;
  });

  const nextCursor = sanitized.length === limit
    ? sanitized[sanitized.length - 1]?.created_at
    : null;

  return NextResponse.json({ posts: sanitized, nextCursor });
}
