import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import FeedClient from "./FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = rawProfile as Profile | null;
  if (!profile) return null;

  return <FeedClient currentUser={profile} />;
}
