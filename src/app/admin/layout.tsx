import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import Link from "next/link";
import Image from "next/image";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = rawProfile as Profile | null;

  if (!profile || !["admin", "moderator"].includes(profile.role)) {
    redirect("/feed");
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="border-b border-[#1a1a1a] bg-[#080808] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/feed" className="flex items-center gap-2">
              <div className="w-5 h-5 relative">
                <Image
                  src="/logoofbackbench.png"
                  alt="Backbench"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-[#f0f0f0] text-sm font-medium">
                backbench
              </span>
            </Link>
            <span className="text-[#333] text-xs">/</span>
            <span className="text-[#666] text-xs">admin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#555] text-xs">@{profile.username}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                profile.role === "admin"
                  ? "bg-[#1a2f44] text-[#4a7aa8] border border-[#2a4a68]"
                  : "bg-[#1e1e1e] text-[#888] border border-[#2a2a2a]"
              }`}
            >
              {profile.role}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
