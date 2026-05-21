"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Eye, Radio } from "lucide-react";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/client";

export default function WhispersPage() {
  const supabase = createClient();
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!content.trim() || content.trim().length < 10) {
      toast.error("Message too short (min 10 chars).");
      return;
    }
    setSubmitting(true);

    let imageUrl: string | null = null;
    if (imageFile) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const path = `whispers/${Date.now()}.${imageFile.name.split(".").pop()}`;
        const { error } = await supabase.storage.from("whispers").upload(path, imageFile);
        if (!error) {
          const { data } = supabase.storage.from("whispers").getPublicUrl(path);
          imageUrl = data.publicUrl;
        }
      }
    }

    try {
      const res = await fetch("/api/whispers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed."); return; }
      setSent(true);
    } catch {
      toast.error("Failed to send.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="pt-2 px-3 flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-xs"
        >
          <div className="w-12 h-12 rounded-full bg-[#1a2f44] border border-[#2a4a68] flex items-center justify-center mx-auto mb-4">
            <Radio size={20} className="text-[#4a7aa8]" />
          </div>
          <h2 className="text-[#f0f0f0] font-medium mb-2">whisper sent</h2>
          <p className="text-[#555] text-sm leading-relaxed">
            Your message was delivered anonymously to the admin. It will be reviewed shortly.
          </p>
          <button
            onClick={() => { setSent(false); setContent(""); setImageFile(null); }}
            className="mt-4 text-[#4a7aa8] text-sm hover:text-[#5a8ab8] transition-colors"
          >
            send another
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pt-2 px-3">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Radio size={16} className="text-[#4a7aa8]" />
          <h1 className="text-[#f0f0f0] font-medium">whispers</h1>
        </div>
        <p className="text-[#555] text-sm leading-relaxed">
          Send anonymous tips directly to the admin. Use this for important school info, safety concerns, or anything you&apos;d rather not post publicly.
        </p>
      </div>

      {/* Examples */}
      <div className="bb-card px-4 py-3 mb-5 space-y-1.5">
        <p className="text-[#666] text-xs font-medium uppercase tracking-wider mb-2">examples</p>
        {[
          "teacher absent tomorrow",
          "exam might happen in period 3",
          "fight happened near the canteen",
          "creepy account targeting students",
        ].map((ex) => (
          <button
            key={ex}
            onClick={() => setContent(ex)}
            className="block w-full text-left text-[#888] text-xs py-1 hover:text-[#aaa] transition-colors"
          >
            → {ex}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div className="flex items-start gap-2 mb-1">
          <Eye size={14} className="text-[#444] mt-0.5 flex-shrink-0" />
          <p className="text-[#444] text-xs">your identity is completely hidden. not even the admin can see who sent this.</p>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="type your whisper here..."
          className="bb-input w-full resize-none h-28 text-sm"
          maxLength={1000}
        />

        {/* Optional image */}
        <div>
          <label className="flex items-center gap-2 text-[#555] text-xs cursor-pointer hover:text-[#888] transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const v = validateImageFile(f);
                if (!v.valid) { toast.error(v.error); return; }
                setImageFile(f);
                toast.success("Image attached.");
              }}
            />
            attach image (optional)
          </label>
          {imageFile && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[#4a7aa8] text-xs">{imageFile.name}</span>
              <button onClick={() => setImageFile(null)} className="text-[#555] text-xs hover:text-red-400">remove</button>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || content.trim().length < 10}
          className="w-full flex items-center justify-center gap-2 bg-[#4a7aa8] hover:bg-[#5a8ab8] text-white py-2.5 rounded-lg text-sm font-medium
                     disabled:opacity-40 transition-colors"
        >
          <Send size={14} />
          {submitting ? "sending..." : "send whisper"}
        </button>
      </div>
    </div>
  );
}
