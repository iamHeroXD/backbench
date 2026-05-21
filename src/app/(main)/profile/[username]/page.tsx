import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .single();

  if (!profile || profile.is_banned) notFound();

  const { data: currentProfile } = user ? await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single() : { data: null };

  // Follow status
  let isFollowing = false;
  if (user) {
    const { data: follow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .single();
    isFollowing = !!follow;
  }

  // Counts
  const [followersRes, followingRes, postsRes] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("author_id", profile.id).eq("is_deleted", false),
  ]);

  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles!author_id(id, username, display_name, avatar_url, is_shadowbanned), reactions(id, user_id, type)")
    .eq("author_id", profile.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <ProfileClient
      profile={profile}
      currentUserId={user?.id ?? null}
      isAdmin={["admin", "moderator"].includes(currentProfile?.role ?? "")}
      isFollowing={isFollowing}
      followerCount={followersRes.count ?? 0}
      followingCount={followingRes.count ?? 0}
      postCount={postsRes.count ?? 0}
      initialPosts={(posts ?? []) as never}
    />
  );
}
