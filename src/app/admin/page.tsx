"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users, FileText, Flag, Radio, AlertTriangle, Key,
  Shield, CheckCircle, Lock, Unlock, ScrollText, VolumeX, Volume2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/utils";
import ConfirmModal from "@/components/ui/ConfirmModal";

type Stats = {
  totalUsers: number;
  totalPosts: number;
  pendingReports: number;
  pendingWhispers: number;
  suspiciousAccounts: number;
  isLocked: boolean;
};

type User = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_banned: boolean;
  is_shadowbanned: boolean;
  is_muted: boolean;
  is_suspicious: boolean;
  trust_score: number;
  aura_score: number;
  created_at: string;
  class_name: string | null;
};

type Report = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  reported_user: string | null;
  post_id: string | null;
  profiles: { username: string; display_name: string } | null;
};

type Whisper = {
  id: string;
  content: string;
  image_url: string | null;
  status: string;
  created_at: string;
};

type Invite = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  used_at: string | null;
  profiles: { username: string } | null;
};

type ModLog = {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, unknown> | null;
  profiles: { username: string } | null;
};

type SpottedPost = {
  id: string;
  content: string;
  created_at: string;
  is_approved: boolean;
};

type Tab = "overview" | "users" | "reports" | "whispers" | "spotted" | "invites" | "logs";

type ConfirmState = { title: string; description: string; fn: () => void } | null;

async function adminAction(action: object) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [spotted, setSpotted] = useState<SpottedPost[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [logs, setLogs] = useState<ModLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [inviteCount, setInviteCount] = useState(5);
  const [newInvites, setNewInvites] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const loadTab = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      if (t === "overview") {
        const res = await fetch("/api/admin?section=stats");
        const d = await res.json();
        setStats(d.stats);
        setIsLocked(d.stats?.isLocked ?? false);
      } else if (t === "users") {
        const res = await fetch("/api/admin?section=users");
        const d = await res.json();
        setUsers(d.users ?? []);
      } else if (t === "reports") {
        const res = await fetch("/api/admin?section=reports");
        const d = await res.json();
        setReports(d.reports ?? []);
      } else if (t === "whispers") {
        const res = await fetch("/api/whispers");
        const d = await res.json();
        setWhispers(d.whispers ?? []);
      } else if (t === "spotted") {
        const res = await fetch("/api/admin?section=spotted");
        const d = await res.json();
        setSpotted(d.spotted ?? []);
      } else if (t === "invites") {
        const res = await fetch("/api/admin?section=invites");
        const d = await res.json();
        setInvites(d.invites ?? []);
      } else if (t === "logs") {
        const res = await fetch("/api/admin?section=logs");
        const d = await res.json();
        setLogs(d.logs ?? []);
      }
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  async function generateInvites() {
    try {
      const data = await adminAction({ action: "generate_invite", count: inviteCount });
      toast.success(`Generated ${inviteCount} invite codes.`);
      setNewInvites(data.codes ?? []);
      loadTab("invites");
      setTab("invites");
    } catch {
      toast.error("Failed to generate invites.");
    }
  }

  function confirmBan(userId: string, type: "temporary" | "permanent" | "shadowban") {
    const reason = window.prompt(`Ban reason for ${type} ban:`);
    if (reason === null) return; // cancelled
    const banReason = reason.trim() || "Admin action";

    const label = type === "shadowban" ? "shadowban" : type + " ban";
    setConfirm({
      title: `Confirm ${label}`,
      description: `This will ${label} the user. Reason: "${banReason}"`,
      fn: async () => {
        setConfirm(null);
        try {
          await adminAction({ action: "ban", userId, type, reason: banReason });
          toast.success(`User ${type === "shadowban" ? "shadowbanned" : "banned"}.`);
          setUsers((prev) => prev.map((u) => u.id === userId ? {
            ...u,
            is_banned: type !== "shadowban",
            is_shadowbanned: type === "shadowban",
          } : u));
        } catch {
          toast.error("Action failed.");
        }
      },
    });
  }

  async function unbanUser(userId: string) {
    try {
      await adminAction({ action: "unban", userId });
      toast.success("User unbanned.");
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_banned: false, is_shadowbanned: false } : u));
    } catch {
      toast.error("Action failed.");
    }
  }

  async function toggleMute(userId: string, isMuted: boolean) {
    try {
      await adminAction({ action: isMuted ? "unmute" : "mute", userId });
      toast.success(isMuted ? "User unmuted." : "User muted.");
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_muted: !isMuted } : u));
    } catch {
      toast.error("Action failed.");
    }
  }

  function confirmLockdown() {
    setConfirm({
      title: isLocked ? "Lift lockdown?" : "Activate emergency lockdown?",
      description: isLocked
        ? "This will restore normal access for all students."
        : "This will block all non-admin users from accessing Backbench.",
      fn: async () => {
        setConfirm(null);
        try {
          await adminAction({ action: "lockdown", enabled: !isLocked });
          setIsLocked(!isLocked);
          toast.success(isLocked ? "Lockdown lifted." : "Lockdown activated.");
        } catch {
          toast.error("Action failed.");
        }
      },
    });
  }

  async function resolveReport(reportId: string) {
    try {
      await adminAction({ action: "resolve_report", reportId, resolution: "Reviewed by admin" });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      toast.success("Report resolved.");
    } catch {
      toast.error("Action failed.");
    }
  }

  async function handleWhisper(whisperId: string, status: "reviewed" | "dismissed") {
    try {
      await adminAction({ action: "review_whisper", whisperId, status });
      setWhispers((prev) => prev.map((w) => w.id === whisperId ? { ...w, status } : w));
      toast.success("Whisper updated.");
    } catch {
      toast.error("Action failed.");
    }
  }

  async function approveSpotted(spotId: string) {
    try {
      await adminAction({ action: "approve_spotted", spotId });
      setSpotted((prev) => prev.map((s) => s.id === spotId ? { ...s, is_approved: true } : s));
      toast.success("Spotted post approved.");
    } catch {
      toast.error("Action failed.");
    }
  }

  async function rejectSpotted(spotId: string) {
    try {
      await adminAction({ action: "reject_spotted", spotId });
      setSpotted((prev) => prev.filter((s) => s.id !== spotId));
      toast.success("Spotted post rejected.");
    } catch {
      toast.error("Action failed.");
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "overview", icon: <Shield size={13} /> },
    { id: "users", label: "users", icon: <Users size={13} /> },
    { id: "reports", label: "reports", icon: <Flag size={13} /> },
    { id: "whispers", label: "whispers", icon: <Radio size={13} /> },
    { id: "spotted", label: "spotted", icon: <Sparkles size={13} /> },
    { id: "invites", label: "invites", icon: <Key size={13} /> },
    { id: "logs", label: "logs", icon: <ScrollText size={13} /> },
  ];

  return (
    <div>
      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            title={confirm.title}
            description={confirm.description}
            onConfirm={confirm.fn}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors
              ${tab === t.id ? "bg-[#1e1e1e] text-[#f0f0f0]" : "text-[#555] hover:text-[#888]"}`}
          >
            {t.icon}
            {t.label}
            {t.id === "reports" && stats?.pendingReports ? (
              <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 rounded-full">{stats.pendingReports}</span>
            ) : null}
            {t.id === "whispers" && stats?.pendingWhispers ? (
              <span className="bg-[#1a2f44] text-[#4a7aa8] text-[10px] px-1.5 rounded-full">{stats.pendingWhispers}</span>
            ) : null}
          </button>
        ))}

        {/* Emergency lockdown */}
        <button
          onClick={confirmLockdown}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors
            ${isLocked
              ? "border-red-500/40 text-red-400 bg-red-500/10"
              : "border-[#2a2a2a] text-[#555] hover:border-[#333] hover:text-[#888]"}`}
        >
          {isLocked ? <><Lock size={12} /> locked down</> : <><Unlock size={12} /> lockdown</>}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="shimmer h-14 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {tab === "overview" && stats && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { label: "users", value: stats.totalUsers, icon: Users },
                  { label: "posts", value: stats.totalPosts, icon: FileText },
                  { label: "reports", value: stats.pendingReports, icon: Flag, warn: stats.pendingReports > 0 },
                  { label: "whispers", value: stats.pendingWhispers, icon: Radio },
                  { label: "suspicious", value: stats.suspiciousAccounts, icon: AlertTriangle, warn: stats.suspiciousAccounts > 0 },
                ].map(({ label, value, icon: Icon, warn }) => (
                  <div key={label} className={`bb-card px-4 py-4 ${warn ? "border-red-500/20" : ""}`}>
                    <Icon size={14} className={warn ? "text-red-400" : "text-[#4a7aa8]"} />
                    <p className="text-[#f0f0f0] text-xl font-semibold mt-2">{value}</p>
                    <p className="text-[#555] text-xs">{label}</p>
                  </div>
                ))}
              </div>

              <div className="bb-card px-4 py-4">
                <p className="text-[#888] text-xs uppercase tracking-wider mb-3">quick actions</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <p className="text-[#666] text-xs">generate invites</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={inviteCount}
                        onChange={(e) => setInviteCount(Number(e.target.value))}
                        className="bb-input flex-1 text-sm py-1.5"
                      />
                      <button
                        onClick={generateInvites}
                        className="px-3 py-1.5 bg-[#4a7aa8] text-white text-xs rounded-lg hover:bg-[#5a8ab8] transition-colors"
                      >
                        generate
                      </button>
                    </div>
                    {newInvites.length > 0 && (
                      <div className="space-y-1 mt-2">
                        <p className="text-[#555] text-[10px] uppercase tracking-wider">generated codes</p>
                        {newInvites.map((code) => (
                          <button
                            key={code}
                            onClick={() => { navigator.clipboard.writeText(code); toast.success("Code copied!"); }}
                            className="block text-[#4a7aa8] text-xs font-mono hover:text-[#5a8ab8] transition-colors"
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="space-y-1">
                {users.map((user) => (
                  <div key={user.id} className="bb-card px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[#d0d0d0] text-sm font-medium">{user.display_name}</p>
                        <span className="text-[#555] text-xs">@{user.username}</span>
                        {user.role !== "student" && (
                          <span className="px-1.5 py-0.5 bg-[#1a2f44] text-[#4a7aa8] text-[10px] rounded-full border border-[#2a4a68]">{user.role}</span>
                        )}
                        {user.is_banned && <span className="text-red-400 text-[10px]">banned</span>}
                        {user.is_shadowbanned && <span className="text-orange-400/70 text-[10px]">shadowban</span>}
                        {user.is_muted && <span className="text-yellow-400/70 text-[10px]">muted</span>}
                        {user.is_suspicious && <span className="text-yellow-400/70 text-[10px]">⚠</span>}
                      </div>
                      <p className="text-[#444] text-xs mt-0.5">
                        trust: {user.trust_score} · aura: {user.aura_score} · {user.class_name ?? "no class"} · joined {formatRelativeTime(user.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                      {user.is_banned ? (
                        <button
                          onClick={() => unbanUser(user.id)}
                          className="px-2 py-1 text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
                        >
                          unban
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => confirmBan(user.id, "shadowban")}
                            className="px-2 py-1 text-[10px] bg-[#1e1e1e] border border-[#2a2a2a] text-[#777] rounded-lg hover:border-orange-500/30 hover:text-orange-400/70 transition-colors"
                          >
                            shadow
                          </button>
                          <button
                            onClick={() => confirmBan(user.id, "permanent")}
                            className="px-2 py-1 text-[10px] bg-[#1e1e1e] border border-[#2a2a2a] text-[#777] rounded-lg hover:border-red-500/30 hover:text-red-400 transition-colors"
                          >
                            ban
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleMute(user.id, user.is_muted)}
                        className={`px-2 py-1 text-[10px] bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg transition-colors
                          ${user.is_muted ? "text-yellow-400 hover:text-green-400 hover:border-green-500/30" : "text-[#777] hover:text-yellow-400/70 hover:border-yellow-500/30"}`}
                        title={user.is_muted ? "Unmute" : "Mute"}
                      >
                        {user.is_muted ? <Volume2 size={10} /> : <VolumeX size={10} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* REPORTS */}
          {tab === "reports" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {reports.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle size={28} className="text-[#333] mx-auto mb-3" />
                  <p className="text-[#444] text-sm">no pending reports</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => (
                    <div key={report.id} className="bb-card px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Flag size={12} className="text-red-400" />
                            <span className="text-[#d0d0d0] text-sm font-medium capitalize">{report.reason.replace(/_/g, " ")}</span>
                            <span className="text-[#444] text-xs">{formatRelativeTime(report.created_at)}</span>
                          </div>
                          {report.details && <p className="text-[#888] text-xs mb-1">{report.details}</p>}
                          <p className="text-[#555] text-xs">
                            reported by: {(report.profiles as unknown as { display_name: string } | null)?.display_name ?? "unknown"}
                          </p>
                        </div>
                        <button
                          onClick={() => resolveReport(report.id)}
                          className="px-3 py-1.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#888] text-xs rounded-lg hover:border-green-500/30 hover:text-green-400 transition-colors ml-3"
                        >
                          resolve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* WHISPERS */}
          {tab === "whispers" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {whispers.length === 0 ? (
                <div className="text-center py-12">
                  <Radio size={28} className="text-[#333] mx-auto mb-3" />
                  <p className="text-[#444] text-sm">no whispers</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {whispers.map((w) => (
                    <div key={w.id} className={`bb-card px-4 py-4 ${w.status === "pending" ? "border-[#2a4a68]" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-[#d0d0d0] text-sm leading-relaxed">{w.content}</p>
                          {w.image_url && (
                            <a href={w.image_url} target="_blank" rel="noopener noreferrer" className="text-[#4a7aa8] text-xs mt-1 block hover:underline">
                              view attached image
                            </a>
                          )}
                          <p className="text-[#444] text-xs mt-1.5">{formatRelativeTime(w.created_at)} · {w.status}</p>
                        </div>
                        {w.status === "pending" && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleWhisper(w.id, "reviewed")}
                              className="px-2 py-1 bg-[#1a2f44] text-[#4a7aa8] text-xs rounded-lg hover:bg-[#1a3f58] transition-colors border border-[#2a4a68]"
                            >
                              noted
                            </button>
                            <button
                              onClick={() => handleWhisper(w.id, "dismissed")}
                              className="px-2 py-1 bg-[#1e1e1e] text-[#555] text-xs rounded-lg hover:text-[#888] transition-colors"
                            >
                              dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* SPOTTED */}
          {tab === "spotted" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {spotted.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles size={28} className="text-[#333] mx-auto mb-3" />
                  <p className="text-[#444] text-sm">no spotted posts pending</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {spotted.map((s) => (
                    <div key={s.id} className={`bb-card px-4 py-4 ${!s.is_approved ? "border-[#2a4a68]" : "border-green-500/10"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-[#d0d0d0] text-sm leading-relaxed">{s.content}</p>
                          <p className="text-[#444] text-xs mt-1.5">
                            {formatRelativeTime(s.created_at)} · {s.is_approved ? "approved" : "pending"}
                          </p>
                        </div>
                        {!s.is_approved && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => approveSpotted(s.id)}
                              className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/20 transition-colors"
                            >
                              approve
                            </button>
                            <button
                              onClick={() => rejectSpotted(s.id)}
                              className="px-2 py-1 bg-[#1e1e1e] text-[#555] text-xs rounded-lg hover:text-red-400 transition-colors"
                            >
                              reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* INVITES */}
          {tab === "invites" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {newInvites.length > 0 && (
                <div className="bb-card px-4 py-3 mb-3 border-[#2a4a68]">
                  <p className="text-[#4a7aa8] text-xs font-medium mb-2">recently generated</p>
                  <div className="flex flex-wrap gap-2">
                    {newInvites.map((code) => (
                      <button
                        key={code}
                        onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied!"); }}
                        className="text-[#4a7aa8] text-sm font-mono bg-[#1a2f44] px-2 py-1 rounded hover:bg-[#1a3f58] transition-colors"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {invites.map((invite) => (
                  <div key={invite.id} className="bb-card px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[#d0d0d0] text-sm font-mono tracking-wider">{invite.code}</p>
                      <p className="text-[#444] text-xs mt-0.5">
                        by @{(invite.profiles as unknown as { username: string } | null)?.username ?? "admin"} · {formatRelativeTime(invite.created_at)}
                        {invite.used_at && ` · used ${formatRelativeTime(invite.used_at)}`}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border
                      ${invite.status === "active" ? "text-green-400 bg-green-500/10 border-green-500/20" :
                        invite.status === "used" ? "text-[#555] bg-[#1e1e1e] border-[#2a2a2a]" :
                        "text-red-400 bg-red-500/10 border-red-500/20"}`}
                    >
                      {invite.status}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* LOGS */}
          {tab === "logs" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <ScrollText size={28} className="text-[#333] mx-auto mb-3" />
                  <p className="text-[#444] text-sm">no moderation logs</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log) => (
                    <div key={log.id} className="bb-card px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#d0d0d0] text-sm font-medium capitalize">{log.action.replace(/_/g, " ")}</span>
                            <span className="text-[#444] text-xs">{formatRelativeTime(log.created_at)}</span>
                          </div>
                          <p className="text-[#555] text-xs mt-0.5">
                            by @{(log.profiles as unknown as { username: string } | null)?.username ?? "system"}
                          </p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <p className="text-[#444] text-xs mt-0.5 font-mono">
                              {JSON.stringify(log.details).slice(0, 80)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
