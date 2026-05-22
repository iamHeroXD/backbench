"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Type, Image as ImageIcon, Loader } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getAvatarFallback } from "@/lib/utils";
import { validateImageFile } from "@/lib/moderation";
import StoryViewer from "./StoryViewer";
import type { Story, Profile } from "@/lib/types/database";

type StoryGroup = {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
  stories: Story[];
  seen: boolean;
};

const BG_COLORS = [
  "#1a1a2e", "#16213e", "#0f3460", "#1a2f44",
  "#2d1b69", "#11998e", "#1a1a1a", "#2c2c2c",
];

export default function StoryBar({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewing, setViewing] = useState<StoryGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [storyType, setStoryType] = useState<"text" | "image">("text");
  const [storyText, setStoryText] = useState("");
  const [storyBg, setStoryBg] = useState(BG_COLORS[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStories = useCallback(async () => {
    const { data: stories } = await supabase
      .from("stories")
      .select("*, profiles!author_id(id, username, display_name, avatar_url)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (!stories) return;

    const groupMap = new Map<string, StoryGroup>();
    for (const story of stories) {
      const author = story.profiles as unknown as Pick<
        Profile,
        "id" | "username" | "display_name" | "avatar_url"
      >;
      if (!author) continue;
      if (!groupMap.has(author.id)) {
        groupMap.set(author.id, { author, stories: [], seen: false });
      }
      groupMap.get(author.id)!.stories.push(story);
    }

    const storyIds = stories.map((s) => s.id);
    if (storyIds.length > 0) {
      const { data: views } = await supabase
        .from("story_views")
        .select("story_id")
        .eq("viewer_id", currentUserId)
        .in("story_id", storyIds);

      const viewedIds = new Set((views ?? []).map((v) => v.story_id));
      groupMap.forEach((group) => {
        group.seen = group.stories.every((s) => viewedIds.has(s.id));
      });
    }

    const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.author.id === currentUserId) return -1;
      if (b.author.id === currentUserId) return 1;
      if (!a.seen && b.seen) return -1;
      if (a.seen && !b.seen) return 1;
      return 0;
    });

    setGroups(sortedGroups);
  }, [supabase, currentUserId]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const handleClose = useCallback(() => {
    setViewing(null);
    fetchStories();
  }, [fetchStories]);

  function resetCreateForm() {
    setStoryType("text");
    setStoryText("");
    setStoryBg(BG_COLORS[0]);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreateStory() {
    if (submitting) return;

    if (storyType === "text" && !storyText.trim()) {
      toast.error("Write something for your story.");
      return;
    }
    if (storyType === "image" && !imageFile) {
      toast.error("Select an image.");
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;

      if (storyType === "image" && imageFile) {
        const ext = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const contentTypeMap: Record<string, string> = {
          jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
        };
        const contentType = contentTypeMap[ext] ?? imageFile.type ?? "image/jpeg";
        const path = `stories/${currentUserId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage.from("posts").upload(path, imageFile, {
          upsert: false,
          contentType,
        });

        if (uploadError) {
          toast.error("Image upload failed. Try again.");
          setSubmitting(false);
          return;
        }

        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: storyType,
          content: storyType === "text" ? storyText.trim() : undefined,
          imageUrl: imageUrl ?? undefined,
          bgColor: storyType === "text" ? storyBg : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to post story.");
        return;
      }

      toast.success("Story posted! It expires in 24 hours.");
      setCreating(false);
      resetCreateForm();
      fetchStories();
    } catch {
      toast.error("Failed to post story.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {/* Create story button */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setCreating(true)}
            className="w-14 h-14 rounded-full bg-[#181818] border-2 border-dashed border-[#2a2a2a]
                       flex items-center justify-center text-[#555] hover:text-[#888] hover:border-[#444]
                       transition-colors"
          >
            <Plus size={18} />
          </button>
          <span className="text-[#444] text-[10px]">your story</span>
        </div>

        {groups.map((group) => (
          <motion.div
            key={group.author.id}
            className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer"
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewing(group)}
          >
            <div
              className={`w-14 h-14 rounded-full p-[2px] ${
                group.seen ? "bg-[#2a2a2a]" : "story-ring"
              }`}
            >
              <div className="w-full h-full rounded-full bg-[#141414] overflow-hidden flex items-center justify-center">
                {group.author.avatar_url ? (
                  <Image
                    src={group.author.avatar_url}
                    alt={group.author.display_name}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-sm font-medium text-[#888]">
                    {getAvatarFallback(group.author.display_name)}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[#888] text-[10px] max-w-[56px] text-center truncate">
              {group.author.id === currentUserId ? "you" : group.author.username}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Story viewer */}
      {viewing && (
        <StoryViewer
          group={viewing}
          currentUserId={currentUserId}
          onClose={handleClose}
        />
      )}

      {/* Story creator modal */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) { setCreating(false); resetCreateForm(); } }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.2 }}
              className="w-full max-w-sm bg-[#111] border border-[#2a2a2a] rounded-t-2xl md:rounded-2xl p-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[#f0f0f0] font-medium text-sm">new story</h2>
                <button
                  onClick={() => { setCreating(false); resetCreateForm(); }}
                  className="text-[#555] hover:text-[#888] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Type switcher */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setStoryType("text")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors
                    ${storyType === "text" ? "bg-[#1e1e1e] text-[#f0f0f0]" : "text-[#555] hover:text-[#888]"}`}
                >
                  <Type size={14} /> text
                </button>
                <button
                  onClick={() => setStoryType("image")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors
                    ${storyType === "image" ? "bg-[#1e1e1e] text-[#f0f0f0]" : "text-[#555] hover:text-[#888]"}`}
                >
                  <ImageIcon size={14} /> image
                </button>
              </div>

              {storyType === "text" ? (
                <>
                  {/* Preview */}
                  <div
                    className="rounded-xl h-36 flex items-center justify-center mb-3 p-4"
                    style={{ backgroundColor: storyBg }}
                  >
                    <p className="text-white text-base font-medium text-center leading-relaxed">
                      {storyText || <span className="opacity-40">your story text...</span>}
                    </p>
                  </div>

                  <textarea
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="what do you want to say?"
                    className="bb-input w-full resize-none h-16 text-sm mb-3"
                    maxLength={300}
                  />

                  {/* Background color picker */}
                  <div className="flex gap-2 mb-4">
                    {BG_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setStoryBg(color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${storyBg === color ? "border-white scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Image upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 10 * 1024 * 1024) { toast.error("Max 10MB for stories."); return; }
                      const validation = validateImageFile(f);
                      if (!validation.valid) { toast.error(validation.error); return; }
                      setImageFile(f);
                      setImagePreview(URL.createObjectURL(f));
                    }}
                  />

                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden mb-4 aspect-[3/4] bg-[#1a1a1a]">
                      <Image src={imagePreview} alt="" fill className="object-cover" />
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-36 rounded-xl border-2 border-dashed border-[#2a2a2a] flex flex-col items-center justify-center gap-2 text-[#555] hover:text-[#888] hover:border-[#444] transition-colors mb-4"
                    >
                      <ImageIcon size={24} />
                      <span className="text-sm">tap to select image</span>
                    </button>
                  )}
                </>
              )}

              <button
                onClick={handleCreateStory}
                disabled={submitting || (storyType === "text" && !storyText.trim()) || (storyType === "image" && !imageFile)}
                className="w-full flex items-center justify-center gap-2 bg-[#4a7aa8] hover:bg-[#5a8ab8] text-white py-2.5 rounded-xl text-sm font-medium
                           disabled:opacity-40 transition-colors"
              >
                {submitting ? <><Loader size={14} className="animate-spin" /> posting...</> : "post story"}
              </button>

              <p className="text-[#333] text-xs text-center mt-2">stories disappear after 24 hours</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
