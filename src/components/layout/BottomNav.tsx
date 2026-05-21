"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Sun, Sparkles, User } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/feed", icon: Home, label: "feed" },
  { href: "/explore", icon: Compass, label: "explore" },
  { href: "/tomorrow", icon: Sun, label: "tomorrow" },
  { href: "/spotted", icon: Sparkles, label: "spotted" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const supabase = createClient();
  const [username, setUsername] = useState("");

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      if (data) setUsername(data.username);
    }
    fetchUser();
  }, [supabase]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#1e1e1e] bottom-nav">
      <div className="max-w-2xl mx-auto px-2 h-14 flex items-center justify-around">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center w-14 h-full gap-0.5"
            >
              <div className={`relative p-1.5 rounded-xl transition-colors duration-200 ${isActive ? "text-[#f0f0f0]" : "text-[#555]"}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-[#1e1e1e] rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
              </div>
              <span className={`text-[9px] font-medium transition-colors duration-200 ${isActive ? "text-[#888]" : "text-[#3a3a3a]"}`}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* Profile link */}
        <Link
          href={username ? `/profile/${username}` : "/settings"}
          className="relative flex flex-col items-center justify-center w-14 h-full gap-0.5"
        >
          <div className={`relative p-1.5 rounded-xl transition-colors duration-200 ${pathname.startsWith("/profile") ? "text-[#f0f0f0]" : "text-[#555]"}`}>
            <User size={20} strokeWidth={pathname.startsWith("/profile") ? 2.5 : 1.8} />
            {pathname.startsWith("/profile") && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute inset-0 bg-[#1e1e1e] rounded-xl -z-10"
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
          </div>
          <span className={`text-[9px] font-medium transition-colors duration-200 ${pathname.startsWith("/profile") ? "text-[#888]" : "text-[#3a3a3a]"}`}>
            you
          </span>
        </Link>
      </div>
    </nav>
  );
}
