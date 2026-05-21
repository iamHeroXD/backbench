"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";

export default function ExplorePage() {
  const supabase = createClient();
  const [trendingPosts, setTrendingPosts] = useState<{ id: string; content: string; author: string; reactions: number; created_at: string }[]>([]);
  const [activePeople, setActivePeople] = useState<{ id: string; username: string; display_name: string; avatar_url: string | null; class_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExplore() {
      const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

      // Trending posts by reaction count
      const { data: posts } = await supabase
        .from("posts")
        .select(`id, content, created_at, profiles!author_id(username, display_name), reactions(count)`)
        .eq("is_deleted", false)
        .gte("created_at", twoDaysAgo)
        .order("created_at", { ascending: false })
        .limit(20);

      if (posts) {
        const sorted = posts
          .map((p) => ({
            id: p.id,
            content: p.content?.slice(0, 100) ?? "",
            author: (p.profiles as { username: string; display_name: string } | null)?.display_name ?? "unknown",
            reactions: Array.isArray(p.reactions) ? p.reactions.length : 0,
            created_at: p.created_at,
          }))
          .sort((a, b) => b.reactions - a.reactions)
          .slice(0, 5);
        setTrendingPosts(sorted);
      }

      // Active users
      const { data: people } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, class_name")
        .eq("is_banned", false)
        .eq("is_shadowbanned", false)
        .gte("last_active_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .limit(12);

      if (people) setActivePeople(people);
      setLoading(false);
    }
    loadExplore();
  }, [supabase]);

  return (
    <div className="pt-2 px-3 space-y-5">
      {/* Trending */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} className="text-[#4a7aa8]" />
          <h2 className="text-[#f0f0f0] text-sm font-medium">trending today</h2>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="shimmer h-16 rounded-xl" />)}
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
                <span className="text-[#333] text-lg font-bold w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[#d0d0d0] text-sm leading-snug truncate">{post.content || "[image post]"}</p>
                  <p className="text-[#555] text-xs mt-0.5">
                    {post.author} · {formatRelativeTime(post.created_at)}
                  </p>
                </div>
                <span className="text-[#4a7aa8] text-xs">{post.reactions} 🔥</span>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Active people */}
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
                  {person.display_name[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[#d0d0d0] text-xs font-medium truncate">{person.display_name}</p>
                <p className="text-[#555] text-[10px] truncate">{person.class_name ?? "@" + person.username}</p>
              </div>
            </motion.a>
          ))}
        </div>
      </section>

      {/* Community polls teaser */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Hash size={15} className="text-[#4a7aa8]" />
          <h2 className="text-[#f0f0f0] text-sm font-medium">community</h2>
        </div>
        <a href="/polls" className="bb-card px-4 py-4 flex items-center justify-between hover:border-[#333] transition-colors block">
          <div>
            <p className="text-[#d0d0d0] text-sm font-medium">community polls</p>
            <p className="text-[#555] text-xs mt-0.5">vote on what happens next</p>
          </div>
          <span className="text-[#4a7aa8] text-lg">→</span>
        </a>
      </section>
    </div>
  );
}
