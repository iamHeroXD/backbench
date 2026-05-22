"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/ui/BackButton";
import PostCard from "@/components/feed/PostCard";
import type { PostWithAuthor } from "@/lib/types/database";

export default function BookmarksPage() {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchBookmarks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    setCurrentUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    setIsAdmin(["admin", "moderator"].includes((profileData as { role?: string } | null)?.role ?? ""));

    // Fetch bookmarks then separately fetch each post — avoids Supabase nested join issues
    const { data: bookmarkRows } = await supabase
      .from("bookmarks")
      .select("post_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!bookmarkRows || bookmarkRows.length === 0) { setLoading(false); return; }

    const postIds = bookmarkRows.map((b) => b.post_id);
    const { data: postsData } = await supabase
      .from("posts")
      .select(`
        *,
        profiles!author_id (id, username, display_name, avatar_url, is_shadowbanned, class_name),
        reactions (id, user_id, type),
        post_tags (tag)
      `)
      .in("id", postIds)
      .eq("is_deleted", false);

    if (postsData) {
      // Preserve bookmark order
      const postMap = new Map((postsData as PostWithAuthor[]).map((p) => [p.id, p]));
      const ordered = postIds
        .map((id) => postMap.get(id))
        .filter((p): p is PostWithAuthor => p !== undefined);
      // Anonymize anonymous posts
      setPosts(ordered.map((p) => p.is_anonymous ? { ...p, profiles: null } : p));
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  function handleDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="pt-2">
      <div className="px-4 py-2 mb-1 flex items-center gap-3">
        <BackButton fallback="/feed" />
        <div className="flex items-center gap-2">
          <Bookmark size={14} className="text-[#555]" />
          <span className="text-[#888] text-sm">saved posts</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 mx-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-32 rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 px-6"
        >
          <Bookmark size={28} className="text-[#333] mx-auto mb-3" />
          <p className="text-[#444] text-sm">no saved posts yet.</p>
          <p className="text-[#333] text-xs mt-1">
            tap the bookmark icon on any post to save it here.
          </p>
        </motion.div>
      ) : (
        <div>
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i < 5 ? i * 0.05 : 0 }}
            >
              <PostCard
                post={post}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onDelete={handleDelete}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
