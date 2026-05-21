"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Users, Zap } from "lucide-react";
import { toast } from "sonner";

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setIsChecking(true);
    try {
      const res = await fetch("/api/auth/verify-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();

      if (data.valid) {
        router.push(`/signup?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      } else {
        toast.error("Invalid or expired invite code.");
        setCode("");
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Subtle noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-[#f0f0f0] font-semibold tracking-tight text-lg">
            backbench
          </span>
        </motion.div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          onClick={() => router.push("/login")}
          className="text-[#888] hover:text-[#f0f0f0] text-sm transition-colors duration-200"
        >
          sign in
        </motion.button>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-lg mx-auto"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#181818] border border-[#2a2a2a] rounded-full px-3 py-1 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4a7aa8] animate-pulse-slow" />
            <span className="text-[#888] text-xs tracking-wider uppercase">
              invite only · vhss plus two
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-semibold text-[#f0f0f0] leading-tight tracking-tight mb-4">
            The unofficial
            <br />
            <span className="text-[#a0a0a0]">student network.</span>
          </h1>

          <p className="text-[#666] text-base leading-relaxed mb-10 max-w-sm mx-auto">
            A private space built only for VHSS Plus Two students. No public access. No exceptions.
          </p>

          {/* Invite code form */}
          <form onSubmit={handleInviteSubmit} className="max-w-xs mx-auto">
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter invite code"
                className="w-full bg-[#141414] border border-[#2a2a2a] text-[#f0f0f0] placeholder:text-[#444]
                           rounded-xl px-4 py-3 pr-12 text-sm text-center tracking-widest uppercase
                           focus:outline-none focus:border-[#4a7aa8] focus:ring-1 focus:ring-[#4a7aa8]/20
                           transition-all duration-200"
                maxLength={14}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={isChecking || !code.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-[#4a7aa8] hover:text-[#5a8ab8]
                           disabled:text-[#333] transition-colors duration-200"
              >
                {isChecking ? (
                  <div className="w-4 h-4 border border-[#4a7aa8] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
              </button>
            </div>
            <p className="text-[#444] text-xs mt-3 text-center">
              You need an invite from an existing member.
            </p>
          </form>
        </motion.div>

        {/* Feature hints */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 flex flex-wrap items-center justify-center gap-4 max-w-md mx-auto"
        >
          {[
            { icon: Lock, label: "invite-only access" },
            { icon: Users, label: "class-based spaces" },
            { icon: Zap, label: "daily community" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 text-[#555] text-xs"
            >
              <Icon size={13} />
              <span>{label}</span>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-8 px-6">
        <p className="text-[#333] text-xs">
          vhss · plus two · science & commerce · private
        </p>
      </footer>
    </div>
  );
}
