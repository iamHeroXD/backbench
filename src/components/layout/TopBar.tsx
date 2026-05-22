"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const PAGE_TITLES: Record<string, string> = {
  "/feed": "backbench",
  "/explore": "explore",
  "/search": "search",
  "/notifications": "notifications",
  "/settings": "settings",
  "/tomorrow": "tomorrow",
  "/spotted": "spotted",
  "/polls": "polls",
  "/whispers": "whispers",
  "/bookmarks": "saved",
  "/community": "community",
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const isFeed = pathname === "/feed";
  const title = PAGE_TITLES[pathname]
    ?? (pathname.startsWith("/post/") ? "post" : null)
    ?? (pathname.startsWith("/profile/") ? "profile" : null)
    ?? "backbench";

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch initial unread count
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnreadCount(count ?? 0);

      // Subscribe to THIS user's notifications only
      channel = supabase
        .channel(`topbar-notifs-${user.id}`)
        .on(
          "postgres_changes" as never,
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => setUnreadCount((n) => n + 1)
        )
        .on(
          "postgres_changes" as never,
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            const { count: c } = await supabase
              .from("notifications")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("is_read", false);
            setUnreadCount(c ?? 0);
          }
        )
        .subscribe();
    }

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]); // supabase is a stable singleton from createBrowserClient

  // Reset unread count when notifications page is visited
  useEffect(() => {
    if (pathname === "/notifications" && userId) {
      setUnreadCount(0);
    }
  }, [pathname, userId]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#1a1a1a]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between"
           style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {/* Logo / Title */}
        <div className="flex items-center gap-2">
          {isFeed ? (
            <Link href="/feed" className="flex items-center gap-2">
              <div className="w-6 h-6 relative flex-shrink-0">
                <Image
                  src="/logoofbackbench.png"
                  alt="Backbench"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-[#e8e8e8] font-semibold text-[15px] tracking-tight">
                backbench
              </span>
            </Link>
          ) : (
            <span className="text-[#e8e8e8] font-medium text-[15px] tracking-tight capitalize">
              {title}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => router.push("/search")}
            className="w-9 h-9 flex items-center justify-center text-[#666] hover:text-[#aaa] transition-colors rounded-md hover:bg-[#181818]"
            aria-label="Search"
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => router.push("/notifications")}
            className="relative w-9 h-9 flex items-center justify-center text-[#666] hover:text-[#aaa] transition-colors rounded-md hover:bg-[#181818]"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#4a7aa8] rounded-full" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
