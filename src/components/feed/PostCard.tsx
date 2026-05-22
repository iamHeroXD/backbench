"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Share2, Bookmark, MoreHorizontal,
  Pin, Flag, Trash2, Eye
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime, REACTION_EMOJIS, getAvatarFallback } from "@/lib/utils";
import type { PostWithAuthor } from "@/lib/types/database";
import ReactionBar from "./ReactionBar";
import CommentSection from "./CommentSection";
import { createClient } from "@/lib/supabase/client";

interface PostCardProps {
  post: PostWithAuthor;
  currentUserId: string;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}

export default function PostCard({ post, currentUserId, isAdmin, onDelete }: PostCardProps) {
  const supabase = createClient();
  const [showComments, setShowComments] = useState(false);

  // Increment view count on mount (fire and forget)
  useEffect(() => {
    void supabase.rpc("increment_post_views" as never, { post_id: post.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);
  const [showMenu, setShowMenu] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isPinned, setIsPinned] = useState(post.is_pinned);

  const author = post.profiles;
  const isOwn = author?.id === currentUserId;
  const isAnon = post.is_anonymous;

  const displayName = isAnon ? "anonymous" : (author?.display_name ?? "unknown");
  const displayUsername = isAnon ? null : author?.username;
  const avatarUrl = isAnon ? null : author?.avatar_url;

  const reactionCounts = post.reactions.reduce(
    (acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalReactions = post.reactions.length;
  const userReaction = post.reactions.find((r) => r.user_id === currentUserId)?.type;

  async function handleBookmark() {
    try {
      if (isBookmarked) {
        await supabase.from("bookmarks").delete()
          .eq("user_id", currentUserId)
          .eq("post_id", post.id);
        setIsBookmarked(false);
        toast.success("Removed from bookmarks");
      } else {
        await supabase.from("bookmarks").insert({ user_id: currentUserId, post_id: post.id });
        setIsBookmarked(true);
        toast.success("Saved to bookmarks");
      }
    } catch {
      toast.error("Bookmark failed.");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this post?")) return;
    try {
      let res: Response;
      if (isOwn && !isAdmin) {
        // Regular user deleting their own post
        res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      } else {
        // Admin/mod deleting any post
        res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete_post", postId: post.id }),
        });
      }
      if (!res.ok) throw new Error();
      onDelete?.(post.id);
      toast.success("Post deleted.");
    } catch {
      toast.error("Failed to delete post.");
    }
  }

  async function handlePin() {
    const action = isPinned ? "unpin_post" : "pin_post";
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postId: post.id }),
      });
      if (!res.ok) throw new Error();
      setIsPinned(!isPinned);
      toast.success(isPinned ? "Post unpinned." : "Post pinned.");
    } catch {
      toast.error("Failed to pin post.");
    }
    setShowMenu(false);
  }

  async function handleShare() {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Backbench post", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      }
    } catch {
      // user cancelled
    }
  }

  return (
    <motion.article
      className="post-appear bb-card mx-3 mb-3 overflow-hidden"
      layout
    >
      {isPinned && (
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
          <Pin size={11} className="text-[#4a7aa8]" />
          <span className="text-[#4a7aa8] text-xs font-medium">pinned</span>
        </div>
      )}

      {/* Author row */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <Link
            href={isAnon ? "#" : `/profile/${displayUsername}`}
            className="flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                <span className="text-[11px] font-medium text-[#888]">
                  {isAnon ? "?" : getAvatarFallback(displayName)}
                </span>
              )}
            </div>
          </Link>

          {/* Name + time */}
          <div>
            <div className="flex items-center gap-1.5">
              <Link
                href={isAnon ? "#" : `/profile/${displayUsername}`}
                className="text-[#e0e0e0] text-sm font-medium leading-none hover:text-white transition-colors"
              >
                {displayName}
              </Link>
              {displayUsername && !isAnon && (
                <span className="text-[#555] text-xs">@{displayUsername}</span>
              )}
            </div>
            <span className="text-[#444] text-xs mt-0.5 block">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center text-[#444] hover:text-[#888] transition-colors rounded-lg hover:bg-[#1e1e1e]"
          >
            <MoreHorizontal size={16} />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-9 z-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl overflow-hidden min-w-[150px]"
                onMouseLeave={() => setShowMenu(false)}
              >
                {(isOwn || isAdmin) && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-red-400 text-sm hover:bg-[#222] transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>delete</span>
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={handlePin}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[#888] text-sm hover:bg-[#222] transition-colors"
                  >
                    <Pin size={13} />
                    <span>{isPinned ? "unpin" : "pin post"}</span>
                  </button>
                )}
                {!isOwn && (
                  <button
                    onClick={async () => {
                      await fetch("/api/reports", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          postId: post.id,
                          reportedUser: author?.id,
                          reason: "other",
                        }),
                      });
                      toast.success("Reported. Admins will review.");
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[#888] text-sm hover:bg-[#222] transition-colors"
                  >
                    <Flag size={13} />
                    <span>report</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-2">
          <p className="text-[#d0d0d0] text-sm leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>
        </div>
      )}

      {/* Tags */}
      {post.post_tags && post.post_tags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {post.post_tags.map(({ tag }) => (
            <Link
              key={tag}
              href={`/search?q=${encodeURIComponent("#" + tag)}`}
              className="text-[10px] px-2 py-0.5 bg-[#1a2f44] text-[#4a7aa8] rounded-full hover:bg-[#1a3f58] transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Image */}
      {post.image_url && (
        <div className="relative mt-1 mb-2 mx-4 rounded-xl overflow-hidden bg-[#1a1a1a] aspect-[4/3]">
          <Image
            src={post.image_url}
            alt="Post image"
            fill
            className="object-cover"
            sizes="(max-width: 672px) 100vw, 672px"
          />
        </div>
      )}

      {/* Reactions summary */}
      {totalReactions > 0 && (
        <div className="px-4 pb-1.5 flex items-center gap-1.5">
          <div className="flex items-center">
            {Object.entries(reactionCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([type]) => (
                <span key={type} className="text-sm -ml-0.5 first:ml-0">
                  {REACTION_EMOJIS[type]}
                </span>
              ))}
          </div>
          <span className="text-[#555] text-xs">{totalReactions}</span>
        </div>
      )}

      {/* Action bar */}
      <div className="px-3 pb-3 pt-1 border-t border-[#1e1e1e] mt-1 flex items-center justify-between">
        <ReactionBar
          postId={post.id}
          currentReaction={userReaction}
          onReact={() => {}}
        />

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[#666] hover:text-[#aaa] rounded-lg hover:bg-[#1e1e1e] transition-colors text-xs"
          >
            <MessageSquare size={14} />
          </button>

          <button
            onClick={handleBookmark}
            className={`px-2 py-1.5 rounded-lg hover:bg-[#1e1e1e] transition-colors ${isBookmarked ? "text-[#4a7aa8]" : "text-[#666] hover:text-[#aaa]"}`}
          >
            <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
          </button>

          <button
            onClick={handleShare}
            className="px-2 py-1.5 text-[#666] hover:text-[#aaa] rounded-lg hover:bg-[#1e1e1e] transition-colors"
          >
            <Share2 size={14} />
          </button>

          <div className="flex items-center gap-1 px-2 py-1.5 text-[#444] text-xs">
            <Eye size={12} />
            <span>{post.view_count}</span>
          </div>
        </div>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-[#1e1e1e]"
          >
            <CommentSection
              postId={post.id}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
