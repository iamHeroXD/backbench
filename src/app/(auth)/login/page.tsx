"use client";


export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("Wrong credentials. Check your email and password.");
      return;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error("Sign in failed. Please try again.");
      return;
    }

    // Check ban status and onboarding
    const { data: rawProfile } = await supabase
      .from("profiles")
      .select("is_banned, onboarding_done")
      .eq("id", currentUser.id)
      .single();

    const profile = rawProfile as { is_banned: boolean; onboarding_done: boolean } | null;

    if (profile?.is_banned) {
      await supabase.auth.signOut();
      toast.error("Your account has been suspended.");
      return;
    }

    if (!profile?.onboarding_done) {
      router.push("/onboarding");
    } else {
      router.push("/feed");
    }
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="text-[#f0f0f0] font-semibold text-xl tracking-tight">
          backbench
        </Link>
        <p className="text-[#555] text-sm mt-2">sign in to continue</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-3">
        <div>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bb-input w-full"
            autoComplete="email"
            required
          />
        </div>

        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bb-input w-full pr-10"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888] transition-colors"
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4a7aa8] hover:bg-[#5a8ab8] text-white rounded-lg py-2.5 text-sm font-medium
                     transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
                     mt-1"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
              signing in...
            </span>
          ) : (
            "sign in"
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-[#444] text-xs">
          don&apos;t have access?{" "}
          <Link href="/" className="text-[#4a7aa8] hover:text-[#5a8ab8] transition-colors">
            get an invite
          </Link>
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-[#1e1e1e]">
        <p className="text-[#333] text-xs text-center leading-relaxed">
          this platform is private and invite-only.
          <br />
          unauthorized access is not permitted.
        </p>
      </div>
    </motion.div>
  );
}
