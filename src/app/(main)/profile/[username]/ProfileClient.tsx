"use client";

import { useState } from "react";
import Image from "next/image";
import { Settings, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getAvatarFallback, getAuraLabel, formatFullDate } from "@/lib/utils";
import PostCard from "@/components/feed/PostCard";
import type { Profile, PostWithAuthor } from "@/lib/types/database";

interface ProfileClientProps {
  profile: Profile;
  currentUserId: string | null;
  isAdmin: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  initialPosts: PostWithAuthor[];
}

export default function ProfileClient({
  profile,
  currentUserId,
  isAdmin,
  isFollowing: initialFollowing,
  followerCount: initialFollowers,
  followingCount,
  postCount,
  initialPosts,
}: ProfileClientProps) {
  const supabase = createClient();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowers);
  const [followLoading, setFollowLoading] = useState(false);
  const [posts, setPosts] = useState(initialPosts);

  const isOwn = currentUserId === profile.id;
  const auraLabel = getAuraLabel(profile.aura_score);

  async function toggleFollow() {
    if (!currentUserId || isOwn) return;
    setFollowLoading(true);

    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profile.id);
        setIsFollowing(false);
        setFollowerCount((c) => c - 1);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: profile.id });
        // Notify
        await supabase.from("notifications").insert({
          user_id: profile.id,
          actor_id: currentUserId,
          type: "follow",
        });
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch {
      toast.error("Action failed.");
    } finally {
      setFollowLoading(false);
    }
  }

  return (
    <div>
      {/* Profile header */}
      <div className="px-4 pt-4 pb-2">
        {/* Avatar + follow button */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-16 h-16 rounded-full bg-[#222] overflow-hidden flex items-center justify-center">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.display_name} width={64} height={64} className="object-cover w-full h-full" />
            ) : (
              <span className="text-xl font-medium text-[#888]">
                {getAvatarFallback(profile.display_name)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOwn ? (
              <a
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border border-[#2a2a2a] text-[#d0d0d0] rounded-xl text-sm hover:border-[#3a3a3a] transition-colors"
              >
                <Settings size={14} />
                edit
              </a>
            ) : currentUserId ? (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all duration-200
                  ${isFollowing
                    ? "bg-[#1e1e1e] border border-[#2a2a2a] text-[#888] hover:border-red-500/30 hover:text-red-400"
                    : "bg-[#4a7aa8] text-white hover:bg-[#5a8ab8]"
                  }`}
              >
                {isFollowing ? <><UserMinus size={14} /> unfollow</> : <><UserPlus size={14} /> follow</>}
              </button>
            ) : null}
          </div>
        </div>

        {/* Name */}
        <div className="mb-3">
          <h1 className="text-[#f0f0f0] font-semibold text-lg leading-tight">{profile.display_name}</h1>
          <p className="text-[#555] text-sm mt-0.5">@{profile.username}</p>
          {profile.class_name && (
            <p className="text-[#4a7aa8] text-xs mt-1">{profile.class_name}</p>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-[#a0a0a0] text-sm leading-relaxed mb-3">{profile.bio}</p>
        )}

        {/* Aura */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="px-2.5 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full">
            <span className="text-[#4a7aa8] text-xs font-medium">{profile.aura_score} aura</span>
          </div>
          <span className="text-[#444] text-xs">{auraLabel}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-[#f0f0f0] font-semibold text-sm">{postCount}</p>
            <p className="text-[#555] text-xs">posts</p>
          </div>
          <div className="text-center">
            <p className="text-[#f0f0f0] font-semibold text-sm">{followerCount}</p>
            <p className="text-[#555] text-xs">followers</p>
          </div>
          <div className="text-center">
            <p className="text-[#f0f0f0] font-semibold text-sm">{followingCount}</p>
            <p className="text-[#555] text-xs">following</p>
          </div>
        </div>

        <p className="text-[#333] text-xs">
          joined {formatFullDate(profile.created_at)}
        </p>
      </div>

      {/* Posts */}
      <div className="border-t border-[#1e1e1e] pt-3">
        {posts.length === 0 ? (
          <p className="text-[#444] text-sm text-center py-8">no posts yet.</p>
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId ?? ""}
                isAdmin={isAdmin}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
