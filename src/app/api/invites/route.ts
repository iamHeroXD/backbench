import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: invites } = await supabase
    .from("invites")
    .select("id, code, status, created_at, used_at")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ invites: invites ?? [] });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("invite_slots, can_invite, is_banned, is_muted")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_banned || profile.is_muted) {
    return NextResponse.json({ error: "Cannot generate invites at this time." }, { status: 403 });
  }

  if (!profile.can_invite) {
    return NextResponse.json({ error: "Your invite privileges have been restricted." }, { status: 403 });
  }

  if ((profile.invite_slots ?? 0) <= 0) {
    return NextResponse.json({ error: "No invite slots remaining." }, { status: 403 });
  }

  const code = generateInviteCode();

  const { error: insertError } = await supabase.from("invites").insert({
    code,
    created_by: user.id,
    status: "active",
  });

  if (insertError) {
    return NextResponse.json({ error: "Failed to generate invite." }, { status: 500 });
  }

  // Decrement invite slots
  await supabase
    .from("profiles")
    .update({ invite_slots: (profile.invite_slots ?? 1) - 1 })
    .eq("id", user.id);

  return NextResponse.json({ success: true, code });
}
