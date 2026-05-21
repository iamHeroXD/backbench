"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Bell, Heart, MessageSquare, UserPlus, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime, getAvatarFallback } from "@/lib/utils";
import type { Notification } from "@/lib/types/database";

type NotifWithActor = Notification & {
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
};

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  comment: <MessageSquare size={14} className="text-[#4a7aa8]" />,
  reply: <MessageSquare size={14} className="text-[#4a7aa8]" />,
  mention: <MessageSquare size={14} className="text-[#888]" />,
  follow: <UserPlus size={14} className="text-[#4a7aa8]" />,
  reaction: <span className="text-sm">🔥</span>,
  announcement: <Megaphone size={14} className="text-[#4a7aa8]" />,
  invite_accepted: <UserPlus size={14} className="text-green-500/70" />,
};

const NOTIF_TEXT: Record<string, (actor: string, msg?: string | null) => string> = {
  comment: (a) => `${a} commented on your post`,
  reply: (a) => `${a} replied to your comment`,
  mention: (a) => `${a} mentioned you`,
  follow: (a) => `${a} started following you`,
  reaction: (a) => `${a} reacted to your post`,
  announcement: (_, m) => m ?? "New announcement",
  invite_accepted: (_, m) => m ?? "Your invite was accepted",
};

export default function NotificationsPage() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<NotifWithActor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    markAllRead();
  }, []);

  async function fetchNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*, profiles!actor_id(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as NotifWithActor[]);
    setLoading(false);
  }

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);
  }

  return (
    <div className="pt-2 px-3">
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="shimmer h-16 rounded-xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={28} className="text-[#333] mx-auto mb-3" />
          <p className="text-[#444] text-sm">no notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif, i) => {
            const actor = notif.profiles;
            const actorName = actor?.display_name ?? "someone";
            const text = NOTIF_TEXT[notif.type]?.(actorName, notif.message) ?? notif.message ?? "New notification";

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-colors
                  ${!notif.is_read ? "bg-[#141414]" : "hover:bg-[#111]"}`}
              >
                {/* Actor avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-[#222] overflow-hidden flex items-center justify-center">
                    {actor?.avatar_url ? (
                      <Image src={actor.avatar_url} alt="" width={36} height={36} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-xs text-[#888]">
                        {actor ? getAvatarFallback(actor.display_name) : "?"}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#0a0a0a] rounded-full flex items-center justify-center">
                    {NOTIF_ICONS[notif.type] ?? <Bell size={10} className="text-[#888]" />}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[#d0d0d0] text-sm leading-snug">{text}</p>
                  <p className="text-[#444] text-xs mt-0.5">{formatRelativeTime(notif.created_at)}</p>
                </div>

                {/* Unread dot */}
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
