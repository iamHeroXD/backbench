"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";

type TrendingPost = {
  id: string;
  content: string;
  author: string;
  reactions: number;
  created_at: string;
};

type ActivePerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  class_name: string | null;
};

export default function ExplorePage() {
  const supabase = useMemo(() => createClient(), []);
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [activePeople, setActivePeople] = useState<ActivePerson[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExplore = useCallback(async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    const [postsRes, reactionsRes, peopleRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, content, created_at, author_id")
        .eq("is_deleted", false)
        .gte("created_at", twoDaysAgo)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("reactions").select("post_id").gte("created_at", twoDaysAgo),
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, class_name")
        .eq("is_banned", false)
        .eq("is_shadowbanned", false)
        .gte("last_active_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .limit(12),
    ]);

    type PostRow = { id: string; content: string | null; created_at: string; author_id: string };
    type ReactionRow = { post_id: string | null };
    type ProfileRow = { id: string; display_name: string };

    const posts = (postsRes.data ?? []) as PostRow[];
    const reactions = (reactionsRes.data ?? []) as ReactionRow[];

    const reactionMap: Record<string, number> = {};
    for (const r of reactions) {
      const key = r.post_id ?? "";
      reactionMap[key] = (reactionMap[key] ?? 0) + 1;
    }

    const authorIds = [...new Set(posts.map((p) => p.author_id))];
    const authorMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: authorsRaw } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", authorIds);
      for (const a of (authorsRaw ?? []) as ProfileRow[]) {
        authorMap[a.id] = a.display_name;
      }
    }

    const trending = posts
      .map((p) => ({
        id: p.id,
        content: (p.content ?? "").slice(0, 100),
        author: authorMap[p.author_id] ?? "unknown",
        reactions: reactionMap[p.id] ?? 0,
        created_at: p.created_at,
      }))
      .sort((a, b) => b.reactions - a.reactions)
      .slice(0, 5);

    setTrendingPosts(trending);
    setActivePeople((peopleRes.data ?? []) as ActivePerson[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadExplore();
  }, [loadExplore]);

  return (
    <div className="pt-2 px-3 space-y-5">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} className="text-[#4a7aa8]" />
          <h2 className="text-[#f0f0f0] text-sm font-medium">trending today</h2>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-16 rounded-xl" />
            ))}
          </div>
        ) : trendingPosts.length === 0 ? (
          <p className="text-[#444] text-sm">nothing trending yet.</p>
        ) : (
          <div className="space-y-2">
            {trendingPosts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bb-card px-4 py-3 flex items-center gap-3"
              >
                <span className="text-[#333] text-lg font-bold w-5 text-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[#d0d0d0] text-sm leading-snug truncate">
                    {post.content || "[image post]"}
                  </p>
                  <p className="text-[#555] text-xs mt-0.5">
                    {post.author} &middot; {formatRelativeTime(post.created_at)}
                  </p>
                </div>
                <span className="text-[#4a7aa8] text-xs">
                  {post.reactions} reactions
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-[#4a7aa8]" />
          <h2 className="text-[#f0f0f0] text-sm font-medium">active today</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {activePeople.map((person, i) => (
            <motion.a
              key={person.id}
              href={`/profile/${person.username}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bb-card px-3 py-3 flex items-center gap-2.5 hover:border-[#333] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-[#888]">
                  {person.display_name[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[#d0d0d0] text-xs font-medium truncate">
                  {person.display_name}
                </p>
                <p className="text-[#555] text-[10px] truncate">
                  {person.class_name ?? `@${person.username}`}
                </p>
              </div>
            </motion.a>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Hash size={15} className="text-[#4a7aa8]" />
          <h2 className="text-[#f0f0f0] text-sm font-medium">community</h2>
        </div>
        <a
          href="/polls"
          className="bb-card px-4 py-4 flex items-center justify-between hover:border-[#333] transition-colors block"
        >
          <div>
            <p className="text-[#d0d0d0] text-sm font-medium">community polls</p>
            <p className="text-[#555] text-xs mt-0.5">vote on what happens next</p>
          </div>
          <span className="text-[#4a7aa8] text-lg">{"->"}</span>
        </a>
      </section>
    </div>
  );
}
