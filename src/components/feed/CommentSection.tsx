"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Send, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime, getAvatarFallback } from "@/lib/utils";
import type { CommentWithAuthor } from "@/lib/types/database";

interface CommentSectionProps {
  postId: string;
  currentUserId: string;
}

export default function CommentSection({
  postId,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch {
      toast.error("Failed to load comments.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function submitComment() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text.trim(),
          parentId: replyTo?.id ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to comment.");
        return;
      }
      setComments((prev) => [...prev, data.comment]);
      setText("");
      setReplyTo(null);
    } catch {
      toast.error("Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = comments.filter((c) => c.parent_id);

  function getReplies(commentId: string): CommentWithAuthor[] {
    return replies.filter((r) => r.parent_id === commentId);
  }

  return (
    <div className="px-4 py-3">
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="shimmer h-8 rounded-lg" />
          ))}
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-[#444] text-xs py-2">
          no comments yet. start the conversation.
        </p>
      ) : (
        <div className="space-y-3 mb-3">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              viewerUserId={currentUserId}
              onReply={(id, username) => {
                setReplyTo({ id, username });
                inputRef.current?.focus();
              }}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          {replyTo && (
            <div className="flex items-center gap-1.5 mb-1">
              <CornerDownRight size={11} className="text-[#4a7aa8]" />
              <span className="text-[#4a7aa8] text-xs">@{replyTo.username}</span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-[#444] text-xs hover:text-[#888] ml-1"
              >
                ×
              </button>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="add a comment..."
            className="bb-input w-full text-xs resize-none min-h-[36px] max-h-24 py-2"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitComment();
              }
            }}
          />
        </div>
        <button
          onClick={submitComment}
          disabled={!text.trim() || submitting}
          className="w-8 h-8 flex items-center justify-center bg-[#4a7aa8] text-white rounded-lg
                     disabled:opacity-40 hover:bg-[#5a8ab8] transition-colors flex-shrink-0"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: CommentWithAuthor;
  replies: CommentWithAuthor[];
  viewerUserId: string;
  onReply: (id: string, username: string) => void;
}

function CommentItem({ comment, replies, onReply }: CommentItemProps) {
  const author = comment.profiles;
  const [showReplies, setShowReplies] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-[#222] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {author?.avatar_url ? (
            <Image
              src={author.avatar_url}
              alt=""
              width={24}
              height={24}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-[9px] text-[#888]">
              {author ? getAvatarFallback(author.display_name) : "?"}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[#d0d0d0] text-xs font-medium">
              {author?.display_name ?? "unknown"}
            </span>
            <span className="text-[#444] text-[10px]">
              {formatRelativeTime(comment.created_at)}
            </span>
          </div>
          <p className="text-[#aaa] text-xs leading-relaxed mt-0.5 break-words">
            {comment.content}
          </p>
          <button
            onClick={() => onReply(comment.id, author?.username ?? "")}
            className="text-[#444] text-[10px] hover:text-[#888] mt-1 transition-colors"
          >
            reply
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="ml-8 border-l border-[#222] pl-3 space-y-2">
          {!showReplies && (
            <button
              onClick={() => setShowReplies(true)}
              className="text-[#4a7aa8] text-xs"
            >
              show {replies.length}{" "}
              {replies.length === 1 ? "reply" : "replies"}
            </button>
          )}
          {showReplies &&
            replies.map((reply) => (
              <motion.div
                key={reply.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-2"
              >
                <div className="w-5 h-5 rounded-full bg-[#222] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {reply.profiles?.avatar_url ? (
                    <Image
                      src={reply.profiles.avatar_url}
                      alt=""
                      width={20}
                      height={20}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-[8px] text-[#888]">
                      {reply.profiles
                        ? getAvatarFallback(reply.profiles.display_name)
                        : "?"}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#d0d0d0] text-[11px] font-medium">
                      {reply.profiles?.display_name ?? "unknown"}
                    </span>
                    <span className="text-[#444] text-[10px]">
                      {formatRelativeTime(reply.created_at)}
                    </span>
                  </div>
                  <p className="text-[#aaa] text-[11px] leading-relaxed mt-0.5">
                    {reply.content}
                  </p>
                </div>
              </motion.div>
            ))}
        </div>
      )}
    </div>
  );
}
