"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { useEffect, useState } from "react";
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
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [unreadCount, setUnreadCount] = useState(0);

  const isFeed = pathname === "/feed";
  const title = PAGE_TITLES[pathname]
    ?? (pathname.startsWith("/post/") ? "post" : null)
    ?? (pathname.startsWith("/profile/") ? "profile" : null)
    ?? "backbench";

  useEffect(() => {
    async function fetchUnread() {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      setUnreadCount(count ?? 0);
    }
    fetchUnread();

    const channel = supabase
      .channel("notifications-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => fetchUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-sm border-b border-[#1e1e1e]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo / Title */}
        <div className="flex items-center gap-2">
          {isFeed ? (
            <Link href="/feed" className="flex items-center gap-2">
              <div className="w-7 h-7 relative">
                <Image
                  src="/logoofbackbench.png"
                  alt="Backbench"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-[#f0f0f0] font-semibold text-[15px] tracking-tight">
                backbench
              </span>
            </Link>
          ) : (
            <span className="text-[#f0f0f0] font-medium text-[15px] tracking-tight capitalize">
              {title}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push("/search")}
            className="w-9 h-9 flex items-center justify-center text-[#888] hover:text-[#f0f0f0] transition-colors rounded-lg hover:bg-[#1e1e1e]"
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => router.push("/notifications")}
            className="relative w-9 h-9 flex items-center justify-center text-[#888] hover:text-[#f0f0f0] transition-colors rounded-lg hover:bg-[#1e1e1e]"
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
