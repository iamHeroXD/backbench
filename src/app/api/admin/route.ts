import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ban"), userId: z.string().uuid(), reason: z.string(), type: z.enum(["temporary", "permanent", "shadowban"]), expiresAt: z.string().optional() }),
  z.object({ action: z.literal("unban"), userId: z.string().uuid() }),
  z.object({ action: z.literal("mute"), userId: z.string().uuid() }),
  z.object({ action: z.literal("unmute"), userId: z.string().uuid() }),
  z.object({ action: z.literal("delete_post"), postId: z.string().uuid() }),
  z.object({ action: z.literal("delete_comment"), commentId: z.string().uuid() }),
  z.object({ action: z.literal("pin_post"), postId: z.string().uuid() }),
  z.object({ action: z.literal("unpin_post"), postId: z.string().uuid() }),
  z.object({ action: z.literal("generate_invite"), count: z.number().min(1).max(50) }),
  z.object({ action: z.literal("revoke_invite"), inviteId: z.string().uuid() }),
  z.object({ action: z.literal("resolve_report"), reportId: z.string().uuid(), resolution: z.string() }),
  z.object({ action: z.literal("review_whisper"), whisperId: z.string().uuid(), status: z.enum(["reviewed", "reposted", "dismissed"]), note: z.string().optional() }),
  z.object({ action: z.literal("lockdown"), enabled: z.boolean(), message: z.string().optional() }),
  z.object({ action: z.literal("approve_spotted"), spotId: z.string().uuid() }),
  z.object({ action: z.literal("reject_spotted"), spotId: z.string().uuid() }),
]);

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, id").eq("id", user.id).single();
  if (!profile || !["admin", "moderator"].includes(profile.role)) return null;
  return profile;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const mod = await requireAdmin(supabase);
  if (!mod) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const data = parsed.data;

  switch (data.action) {
    case "ban": {
      await supabase.from("profiles").update({
        is_banned: data.type !== "shadowban",
        is_shadowbanned: data.type === "shadowban",
      }).eq("id", data.userId);

      await supabase.from("bans").insert({
        user_id: data.userId,
        type: data.type,
        reason: data.reason,
        issued_by: mod.id,
        expires_at: data.expiresAt ?? null,
      });

      await supabase.from("moderation_logs").insert({
        mod_id: mod.id,
        action: "ban",
        target_user: data.userId,
        details: { type: data.type, reason: data.reason },
      });
      break;
    }

    case "unban": {
      await supabase.from("profiles").update({ is_banned: false, is_shadowbanned: false }).eq("id", data.userId);
      await supabase.from("bans").update({ is_active: false, lifted_at: new Date().toISOString() }).eq("user_id", data.userId).eq("is_active", true);
      await supabase.from("moderation_logs").insert({ mod_id: mod.id, action: "unban", target_user: data.userId });
      break;
    }

    case "mute": {
      await supabase.from("profiles").update({ is_muted: true }).eq("id", data.userId);
      await supabase.from("moderation_logs").insert({ mod_id: mod.id, action: "mute", target_user: data.userId });
      break;
    }

    case "unmute": {
      await supabase.from("profiles").update({ is_muted: false }).eq("id", data.userId);
      await supabase.from("moderation_logs").insert({ mod_id: mod.id, action: "unmute", target_user: data.userId });
      break;
    }

    case "delete_post": {
      await supabase.from("posts").update({ is_deleted: true }).eq("id", data.postId);
      await supabase.from("moderation_logs").insert({ mod_id: mod.id, action: "delete_post", target_post: data.postId });
      break;
    }

    case "delete_comment": {
      await supabase.from("comments").update({ is_deleted: true }).eq("id", data.commentId);
      await supabase.from("moderation_logs").insert({ mod_id: mod.id, action: "delete_comment", details: { commentId: data.commentId } });
      break;
    }

    case "pin_post": {
      await supabase.from("posts").update({ is_pinned: true }).eq("id", data.postId);
      break;
    }

    case "unpin_post": {
      await supabase.from("posts").update({ is_pinned: false }).eq("id", data.postId);
      break;
    }

    case "generate_invite": {
      const { generateInviteCode } = await import("@/lib/utils");
      const invites = Array.from({ length: data.count }, () => ({
        code: generateInviteCode(),
        created_by: mod.id,
        status: "active" as const,
      }));
      await supabase.from("invites").insert(invites);
      return NextResponse.json({ success: true, codes: invites.map((i) => i.code) });
    }

    case "revoke_invite": {
      await supabase.from("invites").update({ status: "revoked" }).eq("id", data.inviteId);
      await supabase.from("moderation_logs").insert({ mod_id: mod.id, action: "revoke_invite", details: { inviteId: data.inviteId } });
      break;
    }

    case "resolve_report": {
      await supabase.from("reports").update({
        is_resolved: true,
        resolved_by: mod.id,
        resolution: data.resolution,
        resolved_at: new Date().toISOString(),
      }).eq("id", data.reportId);
      break;
    }

    case "review_whisper": {
      await supabase.from("whispers").update({
        status: data.status,
        admin_note: data.note ?? null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", data.whisperId);
      break;
    }

    case "lockdown": {
      await supabase.from("app_settings").update({
        emergency_lockdown: data.enabled,
        lockdown_message: data.message ?? "Backbench is temporarily unavailable.",
        updated_at: new Date().toISOString(),
      });
      await supabase.from("moderation_logs").insert({
        mod_id: mod.id,
        action: data.enabled ? "lockdown_on" : "lockdown_off",
        details: { message: data.message },
      });
      break;
    }

    case "approve_spotted": {
      await supabase.from("spotted_posts").update({ is_approved: true }).eq("id", data.spotId);
      break;
    }

    case "reject_spotted": {
      await supabase.from("spotted_posts").update({ is_deleted: true }).eq("id", data.spotId);
      break;
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const mod = await requireAdmin(supabase);
  if (!mod) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") ?? "stats";

  if (section === "stats") {
    const [users, posts, reports, whispers] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("is_deleted", false),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("is_resolved", false),
      supabase.from("whispers").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const suspicious = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_suspicious", true);

    return NextResponse.json({
      stats: {
        totalUsers: users.count ?? 0,
        totalPosts: posts.count ?? 0,
        pendingReports: reports.count ?? 0,
        pendingWhispers: whispers.count ?? 0,
        suspiciousAccounts: suspicious.count ?? 0,
      },
    });
  }

  if (section === "users") {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, role, is_banned, is_shadowbanned, is_muted, is_suspicious, trust_score, aura_score, created_at, class_name")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ users: data ?? [] });
  }

  if (section === "reports") {
    const { data } = await supabase
      .from("reports")
      .select("*, profiles!reporter_id(username, display_name)")
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(50);
    return NextResponse.json({ reports: data ?? [] });
  }

  if (section === "invites") {
    const { data } = await supabase
      .from("invites")
      .select("*, profiles!created_by(username)")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ invites: data ?? [] });
  }

  if (section === "logs") {
    const { data } = await supabase
      .from("moderation_logs")
      .select("*, profiles!mod_id(username)")
      .order("created_at", { ascending: false })
      .limit(100);
    return NextResponse.json({ logs: data ?? [] });
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}
