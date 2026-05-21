"use client";


export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { CLASS_OPTIONS } from "@/lib/utils";

const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  username: z
    .string()
    .min(3, "Min 3 characters")
    .max(30, "Max 30 characters")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, underscores"),
  displayName: z.string().min(1, "Required").max(50, "Max 50 chars"),
  password: z.string().min(8, "Min 8 characters"),
  className: z.string().optional(),
  bio: z.string().max(200, "Max 200 chars").optional(),
});

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteCode = params.get("code") ?? "";

  const [form, setForm] = useState({
    email: "",
    username: "",
    displayName: "",
    password: "",
    className: "",
    bio: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!inviteCode) {
      router.replace("/");
    }
  }, [inviteCode, router]);

  function update(field: string, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
    setErrors((e) => ({ ...e, [field]: "" }));
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        errs[err.path[0]] = err.message;
      });
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          inviteCode,
          username: form.username.toLowerCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Signup failed.");
        return;
      }

      toast.success("Welcome to Backbench.");
      router.push("/onboarding");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center mb-8">
        <Link href="/" className="text-[#f0f0f0] font-semibold text-xl tracking-tight">
          backbench
        </Link>
        <p className="text-[#555] text-sm mt-2">create your account</p>
        {inviteCode && (
          <div className="inline-flex items-center gap-1.5 mt-3 bg-[#1a2f44] border border-[#2a4a68] rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4a7aa8]" />
            <span className="text-[#4a7aa8] text-xs">{inviteCode}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSignup} className="space-y-3">
        {/* Email */}
        <div>
          <input
            type="email"
            placeholder="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="bb-input w-full"
            autoComplete="email"
          />
          {errors.email && <FieldError msg={errors.email} />}
        </div>

        {/* Display name */}
        <div>
          <input
            type="text"
            placeholder="display name"
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            className="bb-input w-full"
            autoComplete="name"
          />
          {errors.displayName && <FieldError msg={errors.displayName} />}
          <p className="text-[#444] text-xs mt-1 pl-1">
            Use your real name or an alias &mdash; your choice.
          </p>
        </div>

        {/* Username */}
        <div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">@</span>
            <input
              type="text"
              placeholder="username"
              value={form.username}
              onChange={(e) => update("username", e.target.value.toLowerCase())}
              className="bb-input w-full pl-7"
              autoComplete="username"
            />
          </div>
          {errors.username && <FieldError msg={errors.username} />}
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            placeholder="password (min 8 chars)"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="bb-input w-full pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888] transition-colors"
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          {errors.password && <FieldError msg={errors.password} />}
        </div>

        {/* Class */}
        <div>
          <select
            value={form.className}
            onChange={(e) => update("className", e.target.value)}
            className="bb-input w-full appearance-none"
          >
            <option value="">select your class (optional)</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Bio */}
        <div>
          <textarea
            placeholder="short bio (optional)"
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            className="bb-input w-full resize-none h-16 text-sm"
            maxLength={200}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4a7aa8] hover:bg-[#5a8ab8] text-white rounded-lg py-2.5 text-sm font-medium
                     transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mt-1"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
              creating account...
            </span>
          ) : (
            "join backbench"
          )}
        </button>
      </form>

      <div className="mt-5 text-center">
        <p className="text-[#444] text-xs">
          already a member?{" "}
          <Link href="/login" className="text-[#4a7aa8] hover:text-[#5a8ab8] transition-colors">
            sign in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-1 pl-1">
      <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
      <span className="text-red-400 text-xs">{msg}</span>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
