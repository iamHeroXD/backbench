"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAvatarFallback, formatRelativeTime } from "@/lib/utils";
import type { Story, Profile } from "@/lib/types/database";

type StoryGroup = {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
  stories: Story[];
  seen: boolean;
};

interface StoryViewerProps {
  group: StoryGroup;
  currentUserId: string;
  onClose: () => void;
}

const STORY_DURATION = 5000;

export default function StoryViewer({ group, currentUserId, onClose }: StoryViewerProps) {
  const supabase = createClient();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const story = group.stories[index];

  const markViewed = useCallback(async (storyId: string) => {
    await supabase.from("story_views").upsert({
      story_id: storyId,
      viewer_id: currentUserId,
    });
  }, [supabase, currentUserId]);

  useEffect(() => {
    if (!story) return;
    markViewed(story.id);
  }, [story, markViewed]);

  useEffect(() => {
    if (paused) return;
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          if (index < group.stories.length - 1) {
            setIndex((i) => i + 1);
          } else {
            onClose();
          }
          return 0;
        }
        return p + (100 / (STORY_DURATION / 50));
      });
    }, 50);

    return () => clearInterval(interval);
  }, [index, paused, group.stories.length, onClose]);

  function next() {
    if (index < group.stories.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  }

  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  if (!story) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        {/* Story container - max phone width */}
        <div className="relative w-full max-w-sm h-full max-h-screen overflow-hidden bg-[#0a0a0a]">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 pt-safe">
            {group.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  style={{
                    width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-3 pt-safe">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#222] overflow-hidden flex items-center justify-center">
                {group.author.avatar_url ? (
                  <Image src={group.author.avatar_url} alt="" width={32} height={32} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-xs text-white">{getAvatarFallback(group.author.display_name)}</span>
                )}
              </div>
              <div>
                <p className="text-white text-sm font-medium leading-none">{group.author.display_name}</p>
                <p className="text-white/50 text-xs mt-0.5">{formatRelativeTime(story.created_at)}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Story content */}
          <div
            className="w-full h-full flex items-center justify-center"
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >
            {story.type === "image" && story.image_url ? (
              <Image
                src={story.image_url}
                alt=""
                fill
                className="object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center p-10"
                style={{ backgroundColor: story.bg_color ?? "#1e1e1e" }}
              >
                <p className="text-white text-xl font-medium text-center leading-relaxed">
                  {story.content}
                </p>
              </div>
            )}
          </div>

          {/* Tap zones */}
          <button
            className="absolute left-0 top-0 w-1/3 h-full z-10 opacity-0"
            onClick={prev}
          />
          <button
            className="absolute right-0 top-0 w-1/3 h-full z-10 opacity-0"
            onClick={next}
          />

          {/* Nav arrows */}
          {index > 0 && (
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white/60 hover:text-white">
              <ChevronLeft size={24} />
            </button>
          )}
          {index < group.stories.length - 1 && (
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white/60 hover:text-white">
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
