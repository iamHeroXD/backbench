"use client";


export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { createClient } from "@/lib/supabase/client";
import { getAvatarFallback } from "@/lib/utils";

type SearchResult = {
  users: { id: string; username: string; display_name: string; avatar_url: string | null; class_name: string | null }[];
  posts: { id: string; content: string; author: string }[];
};

export default function SearchPage() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults({ users: [], posts: [] }); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const q = query.trim().toLowerCase();

      const [usersRes, postsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, class_name")
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
          .eq("is_banned", false)
          .limit(8),
        supabase
          .from("posts")
          .select("id, content, is_anonymous, profiles!author_id(display_name)")
          .ilike("content", `%${q}%`)
          .eq("is_deleted", false)
          .limit(5),
      ]);

      setResults({
        users: usersRes.data ?? [],
        posts: ((postsRes.data ?? []) as unknown as { id: string; content: string | null; is_anonymous: boolean; profiles: { display_name: string } | null }[]).map((p) => ({
          id: p.id,
          content: p.is_anonymous ? "[anonymous post]" : p.content?.slice(0, 100) ?? "",
          author: p.is_anonymous ? "anonymous" : p.profiles?.display_name ?? "unknown",
        })),
      });
      setLoading(false);
    }, 300);
  }, [query, supabase]);

  const hasResults = results.users.length > 0 || results.posts.length > 0;

  return (
    <div className="pt-2 px-3">
      <div className="mb-3"><BackButton fallback="/feed" /></div>
      {/* Search input */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search people, posts..."
          className="bb-input w-full pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-4 h-4 border border-[#333] border-t-[#888] rounded-full animate-spin" />
        </div>
      )}

      <AnimatePresence>
        {!loading && query && !hasResults && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[#444] text-sm text-center py-8"
          >
            no results for &ldquo;{query}&rdquo;
          </motion.p>
        )}

        {!loading && hasResults && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Users */}
            {results.users.length > 0 && (
              <div>
                <p className="text-[#555] text-xs uppercase tracking-wider mb-2">people</p>
                <div className="space-y-1">
                  {results.users.map((user) => (
                    <a
                      key={user.id}
                      href={`/profile/${user.username}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#161616] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#222] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {user.avatar_url ? (
                          <Image src={user.avatar_url} alt="" width={36} height={36} className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-xs text-[#888]">{getAvatarFallback(user.display_name)}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-[#e0e0e0] text-sm font-medium">{user.display_name}</p>
                        <p className="text-[#555] text-xs">@{user.username}{user.class_name ? ` · ${user.class_name}` : ""}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Posts */}
            {results.posts.length > 0 && (
              <div>
                <p className="text-[#555] text-xs uppercase tracking-wider mb-2">posts</p>
                <div className="space-y-1">
                  {results.posts.map((post) => (
                    <a key={post.id} href={`/post/${post.id}`} className="bb-card px-4 py-3 block hover:border-[#333] transition-colors">
                      <p className="text-[#d0d0d0] text-sm truncate">{post.content}</p>
                      <p className="text-[#555] text-xs mt-1">by {post.author}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!query && (
        <div className="text-center py-12">
          <p className="text-[#333] text-sm">type to search</p>
        </div>
      )}
    </div>
  );
}
