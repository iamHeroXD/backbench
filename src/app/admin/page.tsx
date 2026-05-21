"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, FileText, Flag, Radio, AlertTriangle, Key,
  Shield, Eye, Trash2, Ban, CheckCircle, RefreshCw,
  Lock, Unlock, ChevronRight, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/utils";
import { generateInviteCode } from "@/lib/utils";

type Stats = {
  totalUsers: number;
  totalPosts: number;
  pendingReports: number;
  pendingWhispers: number;
  suspiciousAccounts: number;
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

type Tab = "overview" | "users" | "reports" | "whispers" | "invites" | "logs";

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
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [inviteCount, setInviteCount] = useState(5);
  const [newInvites, setNewInvites] = useState<string[]>([]);

  useEffect(() => {
    loadTab(tab);
  }, [tab]);

  async function loadTab(t: Tab) {
    setLoading(true);
    try {
      if (t === "overview") {
        const res = await fetch("/api/admin?section=stats");
        const d = await res.json();
        setStats(d.stats);
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
      } else if (t === "invites") {
        const res = await fetch("/api/admin?section=invites");
        const d = await res.json();
        setInvites(d.invites ?? []);
      }
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  async function generateInvites() {
    try {
      await adminAction({ action: "generate_invite", count: inviteCount });
      toast.success(`Generated ${inviteCount} invite codes.`);
      loadTab("invites");
      setTab("invites");
    } catch {
      toast.error("Failed to generate invites.");
    }
  }

  async function banUser(userId: string, type: "temporary" | "permanent" | "shadowban") {
    try {
      await adminAction({ action: "ban", userId, type, reason: "Admin action" });
      toast.success(`User ${type}banned.`);
      loadTab("users");
    } catch {
      toast.error("Action failed.");
    }
  }

  async function unbanUser(userId: string) {
    try {
      await adminAction({ action: "unban", userId });
      toast.success("User unbanned.");
      loadTab("users");
    } catch {
      toast.error("Action failed.");
    }
  }

  async function toggleLockdown() {
    try {
      await adminAction({ action: "lockdown", enabled: !isLocked });
      setIsLocked(!isLocked);
      toast.success(isLocked ? "Lockdown lifted." : "Lockdown activated.");
    } catch {
      toast.error("Action failed.");
    }
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "overview", icon: <Shield size={13} /> },
    { id: "users", label: "users", icon: <Users size={13} /> },
    { id: "reports", label: "reports", icon: <Flag size={13} /> },
    { id: "whispers", label: "whispers", icon: <Radio size={13} /> },
    { id: "invites", label: "invites", icon: <Key size={13} /> },
  ];

  return (
    <div>
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
          onClick={toggleLockdown}
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

              {/* Quick actions */}
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
                      <div className="space-y-1">
                        {newInvites.map((code) => (
                          <p key={code} className="text-[#4a7aa8] text-xs font-mono">{code}</p>
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
                      <div className="flex items-center gap-2">
                        <p className="text-[#d0d0d0] text-sm font-medium">{user.display_name}</p>
                        <span className="text-[#555] text-xs">@{user.username}</span>
                        {user.role !== "student" && (
                          <span className="px-1.5 py-0.5 bg-[#1a2f44] text-[#4a7aa8] text-[10px] rounded-full border border-[#2a4a68]">{user.role}</span>
                        )}
                        {user.is_banned && <span className="text-red-400 text-[10px]">banned</span>}
                        {user.is_shadowbanned && <span className="text-orange-400/70 text-[10px]">shadowban</span>}
                        {user.is_suspicious && <span className="text-yellow-400/70 text-[10px]">⚠</span>}
                      </div>
                      <p className="text-[#444] text-xs mt-0.5">
                        trust: {user.trust_score} · aura: {user.aura_score} · {user.class_name ?? "no class"} · joined {formatRelativeTime(user.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
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
                            onClick={() => banUser(user.id, "shadowban")}
                            className="px-2 py-1 text-[10px] bg-[#1e1e1e] border border-[#2a2a2a] text-[#777] rounded-lg hover:border-orange-500/30 hover:text-orange-400/70 transition-colors"
                          >
                            shadow
                          </button>
                          <button
                            onClick={() => banUser(user.id, "permanent")}
                            className="px-2 py-1 text-[10px] bg-[#1e1e1e] border border-[#2a2a2a] text-[#777] rounded-lg hover:border-red-500/30 hover:text-red-400 transition-colors"
                          >
                            ban
                          </button>
                        </>
                      )}
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

          {/* INVITES */}
          {tab === "invites" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
        </>
      )}
    </div>
  );
}
