"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import PostCard from "@/components/feed/PostCard";
import CreatePost from "@/components/feed/CreatePost";
import StoryBar from "@/components/stories/StoryBar";
import type { PostWithAuthor, Profile } from "@/lib/types/database";

interface FeedClientProps {
  currentUser: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "role">;
}

export default function FeedClient({ currentUser }: FeedClientProps) {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState<"for-you" | "latest">("for-you");
  const initialized = useRef(false);

  const { ref: loadMoreRef, inView } = useInView({ threshold: 0, rootMargin: "200px" });

  const isAdmin = currentUser.role === "admin" || currentUser.role === "moderator";

  const fetchPosts = useCallback(async (cursor?: string) => {
    try {
      const url = `/api/posts?limit=20${cursor ? `&cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      return await res.json();
    } catch {
      return { posts: [], nextCursor: null };
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchPosts(nextCursor);
    setPosts((prev) => [...prev, ...(data.posts ?? [])]);
    setNextCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
    setLoadingMore(false);
  }, [fetchPosts, nextCursor, loadingMore]);

  const refreshFeed = useCallback(async () => {
    setLoading(true);
    const data = await fetchPosts();
    setPosts(data.posts ?? []);
    setNextCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
    setLoading(false);
  }, [fetchPosts]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    refreshFeed();
  }, [refreshFeed]);

  useEffect(() => {
    if (inView && hasMore && !loadingMore && !loading && nextCursor) {
      loadMore();
    }
  }, [inView, hasMore, loadingMore, loading, nextCursor, loadMore]);

  function handleDeletePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="pt-2">
      <StoryBar currentUserId={currentUser.id} />

      <CreatePost
        userAvatar={currentUser.avatar_url}
        displayName={currentUser.display_name}
        onPostCreated={refreshFeed}
      />

      <div className="flex gap-1 mx-3 mb-3">
        {(["for-you", "latest"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs rounded-lg transition-colors capitalize
              ${tab === t ? "bg-[#1e1e1e] text-[#f0f0f0]" : "text-[#555] hover:text-[#888]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 px-6"
        >
          <p className="text-[#555] text-sm">nothing here yet.</p>
          <p className="text-[#333] text-xs mt-1">be the first to post.</p>
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
                currentUserId={currentUser.id}
                isAdmin={isAdmin}
                onDelete={handleDeletePost}
              />
            </motion.div>
          ))}

          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {loadingMore && (
              <div className="w-4 h-4 border border-[#333] border-t-[#888] rounded-full animate-spin" />
            )}
            {!hasMore && posts.length > 0 && (
              <p className="text-[#333] text-xs">you&apos;ve seen everything.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3 mx-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bb-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="shimmer w-8 h-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <div className="shimmer h-3 w-24 rounded" />
              <div className="shimmer h-2 w-16 rounded" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="shimmer h-3 w-full rounded" />
            <div className="shimmer h-3 w-5/6 rounded" />
            <div className="shimmer h-3 w-4/6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
