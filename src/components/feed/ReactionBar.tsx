"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { REACTION_EMOJIS } from "@/lib/utils";
import { toast } from "sonner";

const REACTIONS = Object.entries(REACTION_EMOJIS) as [string, string][];

interface ReactionBarProps {
  postId: string;
  currentReaction?: string;
  onReact?: (type: string | null) => void;
}

export default function ReactionBar({ postId, currentReaction, onReact }: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [activeReaction, setActiveReaction] = useState(currentReaction ?? null);
  const [isAnimating, setIsAnimating] = useState(false);

  async function handleReact(type: string) {
    if (isAnimating) return;
    setIsAnimating(true);

    const newReaction = activeReaction === type ? null : type;
    setActiveReaction(newReaction);
    setShowPicker(false);

    try {
      const res = await fetch(`/api/posts/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      onReact?.(data.action === "removed" ? null : type);
    } catch {
      toast.error("Failed to react.");
      setActiveReaction(currentReaction ?? null);
    } finally {
      setTimeout(() => setIsAnimating(false), 300);
    }
  }

  return (
    <div className="relative flex items-center">
      {/* Current reaction button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-200 text-xs
          ${activeReaction
            ? "text-[#f0f0f0] bg-[#1e1e1e]"
            : "text-[#666] hover:text-[#aaa] hover:bg-[#1e1e1e]"
          }`}
      >
        {activeReaction ? (
          <>
            <span className="text-sm">{REACTION_EMOJIS[activeReaction]}</span>
          </>
        ) : (
          <span className="text-sm">🔥</span>
        )}
      </button>

      {/* Reaction picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute bottom-full left-0 mb-2 z-30 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl px-2 py-2 shadow-xl flex items-center gap-1"
          >
            {REACTIONS.map(([type, emoji]) => (
              <motion.button
                key={type}
                onClick={() => handleReact(type)}
                whileTap={{ scale: 0.85 }}
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-lg transition-colors
                  ${activeReaction === type
                    ? "bg-[#2a2a2a]"
                    : "hover:bg-[#222]"
                  }`}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
