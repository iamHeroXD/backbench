"use client";


export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart2 } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

type PollWithOptions = {
  id: string;
  question: string;
  expires_at: string;
  anonymous_votes: boolean;
  created_at: string;
  total_votes: number;
  options: { id: string; text: string; position: number; vote_count: number }[];
  user_voted_option: string | null;
};

export default function PollsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchPolls = useCallback(
    async (userId?: string) => {
      const { data: pollData } = await supabase
        .from("polls")
        .select(
          `id, question, expires_at, anonymous_votes, created_at,
        poll_options(id, text, position, poll_votes(count))`
        )
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);

      if (!pollData) {
        setLoading(false);
        return;
      }

      let userVotes: { option_id: string; poll_id: string }[] = [];
      if (userId && pollData.length > 0) {
        const { data: votes } = await supabase
          .from("poll_votes")
          .select("option_id, poll_id")
          .eq("voter_id", userId)
          .in(
            "poll_id",
            pollData.map((p) => p.id)
          );
        userVotes = votes ?? [];
      }

      const processed = pollData.map((poll) => {
        const options = (poll.poll_options ?? [])
          .map((opt) => ({
            id: opt.id,
            text: opt.text,
            position: opt.position,
            vote_count: Array.isArray(opt.poll_votes) ? opt.poll_votes.length : 0,
          }))
          .sort((a, b) => a.position - b.position);

        const total = options.reduce((s, o) => s + o.vote_count, 0);
        const userVote = userVotes.find((v) => v.poll_id === poll.id);

        return {
          id: poll.id,
          question: poll.question,
          expires_at: poll.expires_at,
          anonymous_votes: poll.anonymous_votes,
          created_at: poll.created_at,
          total_votes: total,
          options,
          user_voted_option: userVote?.option_id ?? null,
        };
      });

      setPolls(processed);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      await fetchPolls(user?.id);
    }
    init();
  }, [supabase, fetchPolls]);

  async function vote(pollId: string, optionId: string) {
    if (!currentUserId) {
      toast.error("Sign in to vote.");
      return;
    }

    const poll = polls.find((p) => p.id === pollId);
    if (poll?.user_voted_option) {
      toast("You already voted.");
      return;
    }

    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      option_id: optionId,
      voter_id: currentUserId,
    });

    if (error) {
      toast.error("Vote failed.");
      return;
    }

    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        return {
          ...p,
          total_votes: p.total_votes + 1,
          user_voted_option: optionId,
          options: p.options.map((o) =>
            o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o
          ),
        };
      })
    );
    toast.success("Voted!");
  }

  return (
    <div className="pt-2 px-3">
      <div className="mb-3"><BackButton fallback="/explore" /></div>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={16} className="text-[#4a7aa8]" />
        <h1 className="text-[#f0f0f0] font-medium">active polls</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="shimmer h-40 rounded-xl" />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-12">
          <BarChart2 size={28} className="text-[#333] mx-auto mb-3" />
          <p className="text-[#444] text-sm">no active polls right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {polls.map((poll, pi) => (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pi * 0.06 }}
              className="bb-card px-4 py-4"
            >
              <p className="text-[#f0f0f0] text-sm font-medium mb-3">
                {poll.question}
              </p>

              <div className="space-y-2">
                {poll.options.map((opt) => {
                  const pct =
                    poll.total_votes > 0
                      ? Math.round((opt.vote_count / poll.total_votes) * 100)
                      : 0;
                  const isVoted = poll.user_voted_option === opt.id;
                  const hasVoted = !!poll.user_voted_option;

                  return (
                    <button
                      key={opt.id}
                      onClick={() => !hasVoted && vote(poll.id, opt.id)}
                      disabled={hasVoted}
                      className={`relative w-full text-left rounded-lg overflow-hidden border transition-colors
                        ${
                          isVoted
                            ? "border-[#4a7aa8]"
                            : hasVoted
                            ? "border-[#2a2a2a]"
                            : "border-[#2a2a2a] hover:border-[#333]"
                        }`}
                    >
                      {hasVoted && (
                        <div
                          className="absolute inset-y-0 left-0 bg-[#1a2f44]/50 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative flex items-center justify-between px-3 py-2.5">
                        <span
                          className={`text-sm ${
                            isVoted
                              ? "text-[#4a7aa8] font-medium"
                              : "text-[#d0d0d0]"
                          }`}
                        >
                          {opt.text}
                        </span>
                        {hasVoted && (
                          <span className="text-[#666] text-xs">{pct}%</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-[#444] text-xs">
                  {poll.total_votes} votes
                </span>
                <span className="text-[#444] text-xs">
                  ends {formatRelativeTime(poll.expires_at)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
