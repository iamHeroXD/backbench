"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Bell, MessageSquare, UserPlus, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime, getAvatarFallback } from "@/lib/utils";
import BackButton from "@/components/ui/BackButton";
import type { Notification } from "@/lib/types/database";

type NotifWithActor = Notification & {
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
};

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  comment:        <MessageSquare size={12} className="text-[#4a7aa8]" />,
  reply:          <MessageSquare size={12} className="text-[#4a7aa8]" />,
  mention:        <span className="text-xs font-bold text-[#888]">@</span>,
  follow:         <UserPlus size={12} className="text-[#4a7aa8]" />,
  reaction:       <span className="text-xs">🔥</span>,
  announcement:   <Megaphone size={12} className="text-[#4a7aa8]" />,
  invite_accepted: <UserPlus size={12} className="text-green-500/70" />,
};

const NOTIF_TEXT: Record<string, (actor: string, msg?: string | null) => string> = {
  comment:         (a) => `${a} commented on your post`,
  reply:           (a) => `${a} replied to your comment`,
  mention:         (a) => `${a} mentioned you`,
  follow:          (a) => `${a} started following you`,
  reaction:        (a) => `${a} reacted to your post`,
  announcement:    (_, m) => m ?? "New announcement",
  invite_accepted: (_, m) => m ?? "Your invite was accepted",
};

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<NotifWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*, profiles!actor_id(username, display_name, avatar_url)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as NotifWithActor[]);
    setLoading(false);
  }, [supabase]);

  const markAllRead = useCallback(async (uid: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", uid)
      .eq("is_read", false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchNotifications(user.id);
      markAllRead(user.id);
    });
  }, [supabase, fetchNotifications, markAllRead]);

  // Real-time: new notifications pushed immediately
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifs-page-${userId}`)
      .on("postgres_changes" as never, {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, () => fetchNotifications(userId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId, fetchNotifications]);

  if (loading) {
    return (
      <div className="pt-2 px-3">
        <div className="flex items-center gap-3 mb-5">
          <BackButton fallback="/feed" />
        </div>
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="shimmer h-14 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 px-3">
      <div className="mb-4">
        <BackButton fallback="/feed" />
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={24} className="text-[#2a2a2a] mx-auto mb-3" />
          <p className="text-[#444] text-sm">no notifications yet.</p>
          <p className="text-[#333] text-xs mt-1">when someone reacts or comments, it shows here.</p>
        </div>
      ) : (
        <div>
          {notifications.map((notif, i) => {
            const actor = notif.profiles;
            const actorName = actor?.display_name ?? "someone";
            const text = NOTIF_TEXT[notif.type]?.(actorName, notif.message) ?? notif.message ?? "New notification";

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.03, 0.15) }}
                className={`flex items-start gap-3 px-3 py-3 rounded-lg transition-colors mb-0.5 ${
                  !notif.is_read ? "bg-[#111]" : "hover:bg-[#0e0e0e]"
                }`}
              >
                {/* Actor avatar */}
                <div className="relative flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-[#1a1a1a] overflow-hidden flex items-center justify-center">
                    {actor?.avatar_url ? (
                      <Image src={actor.avatar_url} alt="" width={32} height={32} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-[10px] text-[#666]">
                        {actor ? getAvatarFallback(actor.display_name) : "?"}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#0a0a0a] rounded-full flex items-center justify-center">
                    {NOTIF_ICONS[notif.type] ?? <Bell size={9} className="text-[#555]" />}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[#c8c8c8] text-sm leading-snug">{text}</p>
                  <p className="text-[#3a3a3a] text-xs mt-0.5">{formatRelativeTime(notif.created_at)}</p>
                </div>

                {!notif.is_read && (
                  <div className="w-1.5 h-1.5 bg-[#4a7aa8] rounded-full mt-2 flex-shrink-0" />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
