"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

interface SubscribeOptions {
  table: string;
  event?: RealtimeEvent | "*";
  filter?: string;
  onData: (payload: { new: unknown; old: unknown; eventType: string }) => void;
}

export function useRealtime({ table, event = "*", filter, onData }: SubscribeOptions) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  useEffect(() => {
    const channelName = `rt-${table}-${Math.random().toString(36).slice(2)}`;

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
      }
    };
  }, [supabase, table, event, filter]);
}
