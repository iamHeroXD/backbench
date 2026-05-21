"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getAvatarFallback } from "@/lib/utils";
import StoryViewer from "./StoryViewer";
import type { Story, Profile } from "@/lib/types/database";

type StoryGroup = {
  author: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
  stories: Story[];
  seen: boolean;
};

export default function StoryBar({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewing, setViewing] = useState<StoryGroup | null>(null);

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

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            onClick={() => toast("Story creation coming soon.")}
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

      {viewing && (
        <StoryViewer
          group={viewing}
          currentUserId={currentUserId}
          onClose={handleClose}
        />
      )}
    </>
  );
}
