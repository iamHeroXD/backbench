"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, MessageSquare, Shield, Zap, ChevronUp, Plus, X, Loader } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import BackButton from "@/components/ui/BackButton";

type CommunityPoll = {
  id: string;
  title: string;
  description: string | null;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  options: { id: string; text: string; votes: number }[];
  user_vote: string | null;
  total_votes: number;
};

type AppStats = {
  totalUsers: number;
  totalPosts: number;
  activeSince: string;
};

const RULES = [
  "No bullying, harassment, or personal attacks.",
  "No doxxing — real names, numbers, or addresses.",
  "No spam, ads, or off-topic content.",
  "No explicit or illegal content.",
  "Respect anonymity — don't try to expose anon posts.",
  "Treat this space as your own — keep it clean.",
];

const CHANGELOG = [
  { version: "v2", date: "May 2026", notes: "Bookmarks, post permalinks, invite system, mentions, community page, security hardening." },
  { version: "v1", date: "May 2026", notes: "Initial launch — posts, stories, polls, whispers, spotted, tomorrow board." },
];

export default function CommunityPage() {
  const supabase = useMemo(() => createClient(), []);
  const [polls, setPolls] = useState<CommunityPoll[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showNewPoll, setShowNewPoll] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);

  const loadPolls = useCallback(async (uid?: string) => {
    const { data: pollData } = await supabase
      .from("community_polls")
      .select("id, title, description, ends_at, is_active, created_at, community_poll_options(id, text, votes)")
      .eq("is_active", true)
      .gt("ends_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    if (!pollData) return;

    let userVotes: { option_id: string; poll_id: string }[] = [];
    if (uid && pollData.length > 0) {
      const { data: votes } = await supabase
        .from("community_poll_votes")
        .select("option_id, poll_id")
        .eq("user_id", uid)
        .in("poll_id", pollData.map((p) => p.id));
      userVotes = votes ?? [];
    }

    const processed = pollData.map((poll) => {
      const opts = (poll.community_poll_options ?? []) as { id: string; text: string; votes: number }[];
      const total = opts.reduce((s, o) => s + (o.votes ?? 0), 0);
      const uv = userVotes.find((v) => v.poll_id === poll.id);
      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        ends_at: poll.ends_at,
        is_active: poll.is_active,
        created_at: poll.created_at,
        options: opts,
        user_vote: uv?.option_id ?? null,
        total_votes: total,
      };
    });

    setPolls(processed);
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setIsAdmin(["admin","moderator"].includes((profile as { role?: string } | null)?.role ?? ""));

      // Load stats
      const [usersRes, postsRes, oldestRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("is_deleted", false),
        supabase.from("profiles").select("created_at").order("created_at", { ascending: true }).limit(1),
      ]);
      setStats({
        totalUsers: usersRes.count ?? 0,
        totalPosts: postsRes.count ?? 0,
        activeSince: (oldestRes.data?.[0] as { created_at: string } | undefined)?.created_at ?? new Date().toISOString(),
      });

      await loadPolls(user.id);
      setLoading(false);
    }
    init();
  }, [supabase, loadPolls]);

  async function voteOnPoll(pollId: string, optionId: string) {
    if (!userId) return;
    const poll = polls.find((p) => p.id === pollId);
    if (poll?.user_vote) { toast("You already voted on this."); return; }

    const { error } = await supabase.from("community_poll_votes").insert({
      poll_id: pollId,
      user_id: userId,
      option_id: optionId,
    });

    if (error) { toast.error("Vote failed."); return; }

    // Increment counter
    await supabase.from("community_poll_options")
      .update({ votes: (polls.find(p=>p.id===pollId)?.options.find(o=>o.id===optionId)?.votes ?? 0) + 1 })
      .eq("id", optionId);

    setPolls((prev) => prev.map((p) => {
      if (p.id !== pollId) return p;
      return {
        ...p,
        user_vote: optionId,
        total_votes: p.total_votes + 1,
        options: p.options.map((o) => o.id === optionId ? { ...o, votes: o.votes + 1 } : o),
      };
    }));
    toast.success("Vote recorded.");
  }

  async function createPoll() {
    if (!isAdmin || !newTitle.trim()) return;
    const validOpts = newOptions.filter((o) => o.trim());
    if (validOpts.length < 2) { toast.error("Need at least 2 options."); return; }

    setSubmitting(true);
    try {
      const { data: poll } = await supabase.from("community_polls").insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        created_by: userId,
        ends_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      }).select().single();

      if (!poll) { toast.error("Failed to create poll."); return; }

      await supabase.from("community_poll_options").insert(
        validOpts.map((text) => ({ poll_id: poll.id, text: text.trim(), votes: 0 }))
      );

      toast.success("Community poll created.");
      setShowNewPoll(false);
      setNewTitle(""); setNewDesc(""); setNewOptions(["", ""]);
      await loadPolls(userId ?? undefined);
    } catch {
      toast.error("Failed to create poll.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="pt-2 px-3 space-y-3">
        <div className="mb-3"><BackButton fallback="/feed" /></div>
        {[1,2,3].map(i => <div key={i} className="shimmer h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="pt-2 px-3 space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <BackButton fallback="/feed" />
      </div>

      {/* Header */}
      <div>
        <h1 className="text-[#e8e8e8] font-semibold text-base">community</h1>
        <p className="text-[#444] text-xs mt-0.5">governance, rules, and platform direction</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users, label: "students", value: stats.totalUsers },
            { icon: MessageSquare, label: "posts", value: stats.totalPosts },
            { icon: Zap, label: "days active", value: Math.floor((Date.now() - new Date(stats.activeSince).getTime()) / 86400000) + 1 },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bb-card px-3 py-3 text-center">
              <Icon size={13} className="text-[#4a7aa8] mx-auto mb-1.5" />
              <p className="text-[#e8e8e8] font-semibold text-lg leading-none">{value}</p>
              <p className="text-[#444] text-[10px] mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Community polls */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="bb-section-label">community polls</p>
          {isAdmin && (
            <button
              onClick={() => setShowNewPoll(!showNewPoll)}
              className="flex items-center gap-1 text-[#4a7aa8] text-xs hover:text-[#5a8ab8] transition-colors"
            >
              <Plus size={12} /> new poll
            </button>
          )}
        </div>

        {isAdmin && showNewPoll && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bb-card p-4 mb-3 space-y-2"
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="poll question..."
              className="bb-input text-sm"
              maxLength={200}
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="description (optional)"
              className="bb-input text-sm"
              maxLength={500}
            />
            {newOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt}
                  onChange={(e) => { const n=[...newOptions]; n[i]=e.target.value; setNewOptions(n); }}
                  placeholder={`option ${i+1}`}
                  className="bb-input text-sm flex-1"
                  maxLength={100}
                />
                {newOptions.length > 2 && (
                  <button onClick={() => setNewOptions(newOptions.filter((_,j)=>j!==i))} className="text-[#555] hover:text-red-400 transition-colors">
                    <X size={14}/>
                  </button>
                )}
              </div>
            ))}
            {newOptions.length < 6 && (
              <button onClick={()=>setNewOptions([...newOptions,""])} className="text-[#4a7aa8] text-xs hover:text-[#5a8ab8] transition-colors">
                + add option
              </button>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={()=>{setShowNewPoll(false);setNewTitle("");setNewDesc("");setNewOptions(["",""]);}} className="bb-button-subtle flex-1">cancel</button>
              <button onClick={createPoll} disabled={submitting||!newTitle.trim()} className="bb-button-primary flex-1 flex items-center justify-center gap-1">
                {submitting ? <><Loader size={12} className="animate-spin"/> creating...</> : "create poll"}
              </button>
            </div>
          </motion.div>
        )}

        {polls.length === 0 ? (
          <div className="bb-card px-4 py-6 text-center">
            <ChevronUp size={20} className="text-[#2a2a2a] mx-auto mb-2" />
            <p className="text-[#444] text-sm">no active community polls.</p>
            {isAdmin && <p className="text-[#333] text-xs mt-1">create one above to get community input.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {polls.map((poll) => (
              <div key={poll.id} className="bb-card px-4 py-4">
                <p className="text-[#e8e8e8] text-sm font-medium mb-0.5">{poll.title}</p>
                {poll.description && <p className="text-[#555] text-xs mb-3">{poll.description}</p>}
                <div className="space-y-1.5 mb-3">
                  {poll.options.map((opt) => {
                    const pct = poll.total_votes > 0 ? Math.round((opt.votes / poll.total_votes) * 100) : 0;
                    const isVoted = poll.user_vote === opt.id;
                    const hasVoted = !!poll.user_vote;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !hasVoted && voteOnPoll(poll.id, opt.id)}
                        disabled={hasVoted}
                        className={`relative w-full text-left rounded-md overflow-hidden border transition-colors px-3 py-2 ${
                          isVoted ? "border-[#4a7aa8]" : hasVoted ? "border-[#1a1a1a]" : "border-[#1e1e1e] hover:border-[#2a2a2a]"
                        }`}
                      >
                        {hasVoted && (
                          <div className="absolute inset-y-0 left-0 bg-[#1a2f44]/40 transition-all duration-500" style={{ width: `${pct}%` }} />
                        )}
                        <div className="relative flex items-center justify-between">
                          <span className={`text-sm ${isVoted ? "text-[#4a7aa8] font-medium" : "text-[#c8c8c8]"}`}>{opt.text}</span>
                          {hasVoted && <span className="text-[#555] text-xs">{pct}%</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[#333] text-xs">
                  <span>{poll.total_votes} votes</span>
                  <span>ends {formatRelativeTime(poll.ends_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Community rules */}
      <section>
        <p className="bb-section-label mb-2">community rules</p>
        <div className="bb-card px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={13} className="text-[#4a7aa8]" />
            <p className="text-[#888] text-xs font-medium">backbench code of conduct</p>
          </div>
          {RULES.map((rule, i) => (
            <div key={i} className="flex items-start gap-2.5 bb-row py-1.5">
              <span className="text-[#333] text-xs font-mono mt-0.5 w-4 flex-shrink-0">{i+1}.</span>
              <span className="text-[#888] text-xs leading-relaxed">{rule}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Changelog */}
      <section>
        <p className="bb-section-label mb-2">changelog</p>
        <div className="space-y-1.5">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="bb-card px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#4a7aa8] text-xs font-mono font-semibold">{entry.version}</span>
                <span className="text-[#333] text-xs">{entry.date}</span>
              </div>
              <p className="text-[#666] text-xs leading-relaxed">{entry.notes}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
