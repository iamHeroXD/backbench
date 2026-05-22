"use client";

import { useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

interface SubscribeOptions {
  table: string;
  event?: RealtimeEvent | "*";
  filter?: string;
  onData: (payload: { new: unknown; old: unknown; eventType: string }) => void;
  enabled?: boolean;
}

export function useRealtime({
  table,
  event = "*",
  filter,
  onData,
  enabled = true,
}: SubscribeOptions) {
  // Singleton client — stable across renders
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Keep onData stable in a ref so we don't recreate the channel on every render
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    if (!enabled) return;

    // Use a deterministic channel name so the same subscription is reused
    const channelName = `rt-${table}-${event}-${filter ?? "all"}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        {
          event,
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: { new: unknown; old: unknown; eventType: string }) => {
          onDataRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, table, event, filter, enabled]);
}
