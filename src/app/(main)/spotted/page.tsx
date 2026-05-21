"use client";


export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import type { SpottedPost } from "@/lib/types/database";

export default function SpottedPage() {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<SpottedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchSpotted = useCallback(async () => {
    const { data } = await supabase
      .from("spotted_posts")
      .select("*")
      .eq("is_approved", true)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(30);
    setPosts(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSpotted();
  }, [fetchSpotted]);

  async function submitSpotted() {
    if (!content.trim() || content.trim().length < 10) {
      toast.error("Message too short (min 10 chars).");
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/spotted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success("Submitted for review. If approved, it'll appear here.");
      setContent("");
      setShowForm(false);
    } catch {
      toast.error("Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-2 px-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[#f0f0f0] font-medium text-base flex items-center gap-2">
            <Sparkles size={16} className="text-[#4a7aa8]" />
            spotted
          </h1>
          <p className="text-[#555] text-xs mt-0.5">
            anonymous compliments &amp; confessions
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#888] text-xs rounded-lg hover:border-[#333] transition-colors"
        >
          <Send size={13} /> confess
        </button>
      </div>

      <div className="bb-card px-4 py-3 mb-4 flex items-start gap-2.5">
        <AlertTriangle size={14} className="text-[#666] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[#888] text-xs font-medium">community rules</p>
          <p className="text-[#555] text-xs mt-1 leading-relaxed">
            Only positive content. No targeting, no harassment, no creepy
            behavior. All posts are reviewed before appearing. Violations =
            account action.
          </p>
        </div>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bb-card p-4 mb-4"
        >
          <p className="text-[#777] text-xs mb-2">
            your identity will NOT be shared.
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="spotted someone doing something kind? compliment? share it..."
            className="bb-input w-full resize-none h-20 text-sm mb-2"
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <span className="text-[#333] text-xs">{content.length}/500</span>
            <button
              onClick={submitSpotted}
              disabled={submitting || content.trim().length < 10}
              className="px-4 py-1.5 bg-[#4a7aa8] text-white text-sm rounded-lg disabled:opacity-40 hover:bg-[#5a8ab8] transition-colors"
            >
              {submitting ? "sending..." : "submit"}
            </button>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-20 rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles size={28} className="text-[#333] mx-auto mb-3" />
          <p className="text-[#444] text-sm">nothing here yet.</p>
          <p className="text-[#333] text-xs mt-1">
            be the first to post something kind.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bb-card px-4 py-4"
            >
              <p className="text-[#d0d0d0] text-sm leading-relaxed">
                {post.content}
              </p>
              <p className="text-[#333] text-xs mt-2">
                {formatRelativeTime(post.created_at)}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
