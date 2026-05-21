"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, BarChart2, X, Plus, Loader } from "lucide-react";
import { toast } from "sonner";
import { validateImageFile } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/client";

interface CreatePostProps {
  userAvatar?: string | null;
  displayName?: string;
  onPostCreated: () => void;
}

type PostMode = "text" | "image" | "poll";

export default function CreatePost({ userAvatar, displayName, onPostCreated }: CreatePostProps) {
  const supabase = createClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<PostMode>("text");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnon, setIsAnon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollExpiry, setPollExpiry] = useState(24);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) { toast.error(validation.error); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMode("image");
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (mode === "image") setMode("text");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadProgress(0);
  }

  async function uploadImage(file: File): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;

    // Determine content type explicitly
    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const contentType = contentTypeMap[ext] ?? file.type ?? "image/jpeg";

    setUploadProgress(10);

    const { error } = await supabase.storage.from("posts").upload(path, file, {
      upsert: false,
      contentType,
    });

    if (error) {
      console.error("Upload error:", error);
      setUploadProgress(0);
      return null;
    }

    setUploadProgress(100);
    const { data } = supabase.storage.from("posts").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit() {
    if (submitting) return;
    if (mode === "text" && !content.trim()) { toast.error("Write something first."); return; }
    if (mode === "image" && !imageFile) { toast.error("Select an image first."); return; }
    if (mode === "poll") {
      if (!pollQuestion.trim()) { toast.error("Poll needs a question."); return; }
      if (pollOptions.filter((o) => o.trim()).length < 2) { toast.error("Need at least 2 options."); return; }
    }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (mode === "image" && imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) {
          toast.error("Image upload failed. Check your connection and try again.");
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode,
          content: content.trim() || undefined,
          imageUrl: imageUrl ?? undefined,
          isAnonymous: isAnon,
          ...(mode === "poll" && {
            pollQuestion: pollQuestion.trim(),
            pollOptions: pollOptions.filter((o) => o.trim()),
            pollExpiresHours: pollExpiry,
          }),
        }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to post."); return; }

      setContent("");
      clearImage();
      setPollQuestion("");
      setPollOptions(["", ""]);
      setIsAnon(false);
      setMode("text");
      setIsExpanded(false);
      toast.success("Posted.");
      onPostCreated();
    } catch {
      toast.error("Failed to post. Try again.");
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="bb-card mx-3 mb-4 overflow-hidden">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center gap-3 px-4 py-3 text-[#444] hover:text-[#666] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center overflow-hidden flex-shrink-0">
            {userAvatar ? (
              <Image src={userAvatar} alt="" width={32} height={32} className="object-cover w-full h-full" />
            ) : (
              <span className="text-[11px] text-[#888]">
                {displayName?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
          <span className="text-sm flex-1 text-left">what&apos;s happening...</span>
          <Plus size={16} className="text-[#4a7aa8]" />
        </button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-4"
          >
            {/* Mode switcher */}
            <div className="flex gap-1 mb-3">
              {(["text", "image", "poll"] as PostMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors capitalize
                    ${mode === m ? "bg-[#1e1e1e] text-[#f0f0f0]" : "text-[#555] hover:text-[#888]"}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Text area */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={mode === "poll" ? "add a caption... (optional)" : "what's on your mind?"}
              className="w-full bg-transparent text-[#d0d0d0] text-sm placeholder:text-[#444] resize-none outline-none min-h-[80px] mb-2 leading-relaxed"
              maxLength={2000}
              autoFocus
            />

            {/* Image preview */}
            {imagePreview && (
              <div className="relative rounded-xl overflow-hidden mb-3 aspect-[4/3] bg-[#1a1a1a]">
                <Image src={imagePreview} alt="" fill className="object-cover" />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white"
                >
                  <X size={13} />
                </button>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                    <div
                      className="h-full bg-[#4a7aa8] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Poll builder */}
            {mode === "poll" && (
              <div className="space-y-2 mb-3">
                <input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="poll question..."
                  className="bb-input w-full text-sm"
                  maxLength={300}
                />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                      placeholder={`option ${i + 1}`}
                      className="bb-input flex-1 text-sm"
                      maxLength={100}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                        className="text-[#555] hover:text-red-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="text-[#4a7aa8] text-xs flex items-center gap-1 hover:text-[#5a8ab8] transition-colors"
                  >
                    <Plus size={12} />
                    add option
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[#555] text-xs">expires in</span>
                  <select
                    value={pollExpiry}
                    onChange={(e) => setPollExpiry(Number(e.target.value))}
                    className="bb-input text-xs py-1 px-2"
                  >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={48}>2 days</option>
                    <option value={168}>1 week</option>
                  </select>
                </div>
              </div>
            )}

            {/* Bottom actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[#1e1e1e]">
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 flex items-center justify-center text-[#555] hover:text-[#888] transition-colors rounded-lg hover:bg-[#1e1e1e]"
                >
                  <ImageIcon size={15} />
                </button>
                <button
                  onClick={() => setMode("poll")}
                  className="w-8 h-8 flex items-center justify-center text-[#555] hover:text-[#888] transition-colors rounded-lg hover:bg-[#1e1e1e]"
                >
                  <BarChart2 size={15} />
                </button>
                <button
                  onClick={() => setIsAnon(!isAnon)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${isAnon ? "bg-[#2a2a2a] text-[#888]" : "text-[#444] hover:text-[#666]"}`}
                >
                  anon
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsExpanded(false); setContent(""); clearImage(); }}
                  className="px-3 py-1.5 text-[#555] text-sm hover:text-[#888] transition-colors"
                >
                  cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#4a7aa8] hover:bg-[#5a8ab8] text-white text-sm rounded-lg
                             transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader size={12} className="animate-spin" />
                      posting...
                    </span>
                  ) : "post"}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
