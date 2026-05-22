"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select(`
        created_at,
        posts (
          *,
          profiles!author_id (id, username, display_name, avatar_url, is_shadowbanned, class_name),
          reactions (id, user_id, type),
          post_tags (tag)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (bookmarks) {
      const extracted = bookmarks
        .map((b) => (b.posts as unknown) as PostWithAuthor | null)
        .filter((p): p is PostWithAuthor => p !== null && !p.is_deleted);
      setPosts(extracted);
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
      <div className="flex items-center gap-2 px-4 mb-4">
        <Bookmark size={16} className="text-[#4a7aa8]" />
        <h1 className="text-[#f0f0f0] font-medium">saved posts</h1>
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
