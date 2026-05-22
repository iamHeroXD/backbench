import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/feed/PostCard";
import type { PostWithAuthor, Profile } from "@/lib/types/database";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: rawPost } = await supabase
    .from("posts")
    .select(`
      *,
      profiles!author_id (id, username, display_name, avatar_url, is_shadowbanned, class_name),
      reactions (id, user_id, type),
      post_tags (tag),
      polls (id, question, expires_at, anonymous_votes, poll_options (id, text, position, poll_votes(count)))
    `)
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (!rawPost) notFound();

  const post = rawPost as unknown as PostWithAuthor;

  // Anonymize if needed
  if (post.is_anonymous) {
    (post as { profiles: null }).profiles = null;
  }

  let currentUserId = "";
  let isAdmin = false;

  if (user) {
    currentUserId = user.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = ["admin", "moderator"].includes((profile as Pick<Profile, "role"> | null)?.role ?? "");
  }

  return (
    <div className="pt-4 max-w-2xl mx-auto">
      <PostCard
        post={post}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onDelete={() => {}}
      />
    </div>
  );
}
