"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Sun, Bookmark, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";

const navItems = [
  { href: "/feed",      icon: Home,     label: "feed"     },
  { href: "/explore",   icon: Compass,  label: "explore"  },
  { href: "/tomorrow",  icon: Sun,      label: "tomorrow" },
  { href: "/bookmarks", icon: Bookmark, label: "saved"    },
];

export default function BottomNav() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [username, setUsername] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("username").eq("id", user.id).single()
        .then(({ data }) => { if (data) setUsername(data.username); });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profileHref = username ? `/profile/${username}` : "/settings";
  const isProfile = pathname.startsWith("/profile");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-[#1a1a1a] bottom-nav">
      <div className="max-w-2xl mx-auto px-1 h-14 flex items-center justify-around">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/feed" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 group"
            >
              <div className={`p-1.5 rounded-md transition-colors duration-150 ${
                isActive ? "text-[#e8e8e8] bg-[#181818]" : "text-[#444] group-hover:text-[#777]"
              }`}>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className={`text-[9px] font-medium transition-colors duration-150 ${
                isActive ? "text-[#666]" : "text-[#333]"
              }`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* Profile link */}
        <Link
          href={profileHref}
          className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 group"
        >
          <div className={`p-1.5 rounded-md transition-colors duration-150 ${
            isProfile ? "text-[#e8e8e8] bg-[#181818]" : "text-[#444] group-hover:text-[#777]"
          }`}>
            <User size={19} strokeWidth={isProfile ? 2.5 : 1.8} />
          </div>
          <span className={`text-[9px] font-medium transition-colors duration-150 ${
            isProfile ? "text-[#666]" : "text-[#333]"
          }`}>
            you
          </span>
        </Link>
      </div>
    </nav>
  );
}
