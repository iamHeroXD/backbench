"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Shield, Users, Sparkles, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const STEPS = [
  {
    id: "welcome",
    title: "welcome to backbench.",
    subtitle: "your private school network.",
    icon: null,
    content: null,
  },
  {
    id: "trust",
    title: "this place runs on trust.",
    subtitle: null,
    icon: Shield,
    content: [
      "Everyone here was invited by someone they know.",
      "Your Trust Score reflects how you engage with the community.",
      "Low trust = limited posting. High trust = more invite slots.",
      "Keep it real. This is your actual school community.",
    ],
  },
  {
    id: "features",
    title: "what can you do here?",
    subtitle: null,
    icon: null,
    content: null,
    features: [
      { icon: Users, label: "follow classmates", desc: "build your feed" },
      { icon: Sparkles, label: "spotted", desc: "anonymous compliments" },
      { icon: Radio, label: "whispers", desc: "tip admin anonymously" },
    ],
  },
  {
    id: "rules",
    title: "community rules.",
    subtitle: "short. serious.",
    icon: null,
    content: [
      "No bullying or harassment.",
      "No doxxing or personal information.",
      "No spam or fake accounts.",
      "No explicit or illegal content.",
      "Respect anonymity — don't try to expose anonymous posts.",
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function complete() {
    setCompleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ onboarding_done: true }).eq("id", user.id);
      }
    } catch {}
    router.push("/feed");
    router.refresh();
  }

  function next() {
    if (isLast) {
      complete();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? "w-5 h-1.5 bg-[#4a7aa8]"
                  : i < step
                  ? "w-1.5 h-1.5 bg-[#4a7aa8]/40"
                  : "w-1.5 h-1.5 bg-[#222]"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Logo on welcome step */}
            {step === 0 && (
              <div className="flex justify-center mb-8">
                <div className="w-16 h-16 relative">
                  <Image src="/logoofbackbench.png" alt="Backbench" fill className="object-contain" />
                </div>
              </div>
            )}

            {/* Icon */}
            {currentStep.icon && (
              <div className="w-12 h-12 rounded-2xl bg-[#1a2f44] border border-[#2a4a68] flex items-center justify-center mb-6">
                <currentStep.icon size={22} className="text-[#4a7aa8]" />
              </div>
            )}

            {/* Title */}
            <h1 className="text-[#f0f0f0] font-semibold text-2xl leading-tight mb-2">
              {currentStep.title}
            </h1>
            {currentStep.subtitle && (
              <p className="text-[#666] text-sm mb-6">{currentStep.subtitle}</p>
            )}

            {/* Content - list */}
            {currentStep.content && (
              <ul className="space-y-3 mt-5">
                {currentStep.content.map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-2.5"
                  >
                    <Check size={14} className="text-[#4a7aa8] mt-0.5 flex-shrink-0" />
                    <span className="text-[#a0a0a0] text-sm leading-relaxed">{item}</span>
                  </motion.li>
                ))}
              </ul>
            )}

            {/* Features grid */}
            {currentStep.id === "features" && (
              <div className="mt-5 space-y-2">
                {currentStep.features?.map(({ icon: Icon, label, desc }, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="bb-card px-4 py-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#1a2f44] flex items-center justify-center flex-shrink-0">
                      <Icon size={15} className="text-[#4a7aa8]" />
                    </div>
                    <div>
                      <p className="text-[#d0d0d0] text-sm font-medium">{label}</p>
                      <p className="text-[#555] text-xs">{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Next button */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={next}
          disabled={completing}
          className="w-full flex items-center justify-center gap-2 bg-[#4a7aa8] hover:bg-[#5a8ab8] text-white py-3 rounded-xl text-sm font-medium
                     mt-8 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {completing ? (
            <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />
          ) : isLast ? (
            <>got it, let me in</>
          ) : (
            <>continue <ArrowRight size={14} /></>
          )}
        </motion.button>

        {step === 0 && (
          <button
            onClick={complete}
            className="w-full text-center text-[#333] text-xs mt-3 hover:text-[#555] transition-colors"
          >
            skip intro
          </button>
        )}
      </div>
    </div>
  );
}
