"use client";


export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, ChevronUp, Pin, BookOpen } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CLASS_OPTIONS } from "@/lib/utils";
import type { TomorrowItem } from "@/lib/types/database";

export default function TomorrowPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<TomorrowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentClass, setCurrentClass] = useState<string | null>(null);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [forClass, setForClass] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const { data } = await supabase
      .from("tomorrow_items")
      .select("*")
      .gte("date", dateStr)
      .order("is_pinned", { ascending: false })
      .order("upvotes", { ascending: false })
      .order("created_at", { ascending: false });

    setItems(data ?? []);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && data && data.length > 0) {
      const { data: uv } = await supabase
        .from("tomorrow_upvotes")
        .select("item_id")
        .eq("user_id", user.id)
        .in(
          "item_id",
          data.map((i) => i.id)
        );
      setUpvoted(new Set((uv ?? []).map((v) => v.item_id)));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("class_name")
          .eq("id", user.id)
          .single();
        if (p?.class_name) setCurrentClass(p.class_name);
      }
      await fetchItems();
    }
    init();
  }, [supabase, fetchItems]);

  async function submitItem() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not signed in.");
      setSubmitting(false);
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { error } = await supabase.from("tomorrow_items").insert({
      author_id: user.id,
      title: title.trim(),
      description: desc.trim() || null,
      class_name: forClass || null,
      date: tomorrow.toISOString().split("T")[0],
    });

    if (error) {
      toast.error("Failed to add item.");
      setSubmitting(false);
      return;
    }

    toast.success("Added to tomorrow board.");
    setTitle("");
    setDesc("");
    setForClass("");
    setShowForm(false);
    await fetchItems();
    setSubmitting(false);
  }

  async function toggleUpvote(itemId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const isNowUpvoted = !upvoted.has(itemId);

    // Optimistic UI update
    setUpvoted((s) => {
      const n = new Set(s);
      if (isNowUpvoted) { n.add(itemId); } else { n.delete(itemId); }
      return n;
    });
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, upvotes: isNowUpvoted ? i.upvotes + 1 : Math.max(0, i.upvotes - 1) }
          : i
      )
    );

    // Atomic server-side toggle
    const { data: newCount, error } = await supabase.rpc(
      "toggle_tomorrow_upvote" as never,
      { p_item_id: itemId, p_user_id: user.id }
    );

    if (error) {
      // Revert on error
      setUpvoted((s) => {
        const n = new Set(s);
        if (isNowUpvoted) { n.delete(itemId); } else { n.add(itemId); }
        return n;
      });
      await fetchItems();
      return;
    }

    // Sync with server count
    if (typeof newCount === "number") {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, upvotes: newCount } : i))
      );
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const filtered = currentClass
    ? items.filter((i) => !i.class_name || i.class_name === currentClass)
    : items;

  return (
    <div className="pt-2 px-3">
      <div className="mb-3">
        <BackButton fallback="/feed" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[#f0f0f0] font-medium text-base">tomorrow</h1>
          <p className="text-[#555] text-xs mt-0.5">{tomorrowStr}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4a7aa8] hover:bg-[#5a8ab8] text-white text-xs rounded-lg transition-colors"
        >
          <Plus size={13} /> add item
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bb-card p-4 mb-4 space-y-2"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="exam, submission, reminder..."
            className="bb-input w-full text-sm"
            maxLength={200}
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="details (optional)"
            className="bb-input w-full text-sm"
            maxLength={500}
          />
          <div className="flex gap-2">
            <select
              value={forClass}
              onChange={(e) => setForClass(e.target.value)}
              className="bb-input flex-1 text-sm"
            >
              <option value="">all classes</option>
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={submitItem}
              disabled={submitting || !title.trim()}
              className="px-4 py-2 bg-[#4a7aa8] text-white text-sm rounded-lg disabled:opacity-40 hover:bg-[#5a8ab8] transition-colors"
            >
              {submitting ? "..." : "post"}
            </button>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={28} className="text-[#333] mx-auto mb-3" />
          <p className="text-[#444] text-sm">nothing added yet for tomorrow.</p>
          <p className="text-[#333] text-xs mt-1">
            be the first to post a reminder.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bb-card px-4 py-3 flex items-start gap-3"
            >
              <button
                onClick={() => toggleUpvote(item.id)}
                className={`flex flex-col items-center gap-0.5 mt-0.5 transition-colors
                  ${
                    upvoted.has(item.id)
                      ? "text-[#4a7aa8]"
                      : "text-[#444] hover:text-[#888]"
                  }`}
              >
                <ChevronUp size={16} />
                <span className="text-[10px]">{item.upvotes}</span>
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {item.is_pinned && (
                    <Pin size={11} className="text-[#4a7aa8]" />
                  )}
                  <p className="text-[#d0d0d0] text-sm font-medium">
                    {item.title}
                  </p>
                </div>
                {item.description && (
                  <p className="text-[#777] text-xs mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                )}
                {item.class_name && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-[#1a2f44] border border-[#2a4a68] rounded-full text-[#4a7aa8] text-[10px]">
                    {item.class_name}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
