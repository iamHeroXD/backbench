"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  fallback?: string;
  label?: string;
  className?: string;
}

export default function BackButton({ fallback = "/feed", label, className = "" }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={handleBack}
      className={`flex items-center gap-0.5 text-[#555] hover:text-[#888] transition-colors text-sm ${className}`}
    >
      <ChevronLeft size={16} strokeWidth={1.5} />
      {label && <span className="text-xs">{label}</span>}
    </button>
  );
}
