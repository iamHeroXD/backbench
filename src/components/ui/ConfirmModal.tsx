"use client";

import { motion } from "framer-motion";

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal({
  title,
  description,
  confirmLabel = "confirm",
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
        className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm"
      >
        <h2 className="text-[#f0f0f0] font-medium text-base mb-2">{title}</h2>
        <p className="text-[#888] text-sm mb-5 leading-relaxed">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-[#2a2a2a] text-[#888] rounded-xl text-sm hover:border-[#333] hover:text-[#aaa] transition-colors"
          >
            cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              danger
                ? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
                : "bg-[#4a7aa8] text-white hover:bg-[#5a8ab8]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
