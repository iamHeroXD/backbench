import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";

type AppSettings = {
  emergency_lockdown: boolean;
  lockdown_message: string | null;
  maintenance_mode: boolean;
};

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rawSettings } = await supabase
    .from("app_settings")
    .select("emergency_lockdown, lockdown_message, maintenance_mode")
    .single();

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("id, role, is_banned")
    .eq("id", user.id)
    .single();

  const settings = rawSettings as AppSettings | null;
  const profile = rawProfile as Pick<Profile, "id" | "role" | "is_banned"> | null;

  if (profile?.is_banned) {
    // Check if a temporary ban has expired before rejecting
    const serviceClient = await createServiceClient();
    const { data: banExpired } = await serviceClient.rpc("auto_expire_bans" as never, { p_user_id: user.id });
    if (banExpired) {
      // Re-fetch profile after auto-expiry
      const { data: refreshed } = await supabase.from("profiles").select("id, role, is_banned").eq("id", user.id).single();
      if (refreshed?.is_banned) {
        redirect("/login?banned=1");
      }
      // else: ban was expired, allow through — update profile variable
      (profile as { is_banned: boolean }).is_banned = false;
    } else {
      redirect("/login?banned=1");
    }
  }

  // Update last_active_at (fire and forget)
  supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", user.id).then(() => {});

  if (settings?.emergency_lockdown && profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-2 h-2 rounded-full bg-red-500/60 mx-auto mb-4" />
          <h1 className="text-[#f0f0f0] font-medium mb-2">
            Temporarily unavailable
          </h1>
          <p className="text-[#666] text-sm leading-relaxed">
            {settings.lockdown_message ??
              "Backbench is temporarily unavailable. Check back soon."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full pb-24 pt-14">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
