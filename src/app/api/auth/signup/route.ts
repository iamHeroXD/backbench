import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/),
  displayName: z.string().min(1).max(50),
  password: z.string().min(8),
  inviteCode: z.string().min(1),
  className: z.string().optional(),
  bio: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, username, displayName, password, inviteCode, className, bio } = parsed.data;

    // Verify invite code
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("id, created_by, status, expires_at")
      .eq("code", inviteCode.toUpperCase())
      .eq("status", "active")
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invalid invite code." }, { status: 400 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite code has expired." }, { status: 400 });
    }

    // Check username uniqueness
    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.toLowerCase())
      .single();

    if (existingUsername) {
      return NextResponse.json({ error: "Username is already taken." }, { status: 400 });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes("already registered")) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to create account." }, { status: 500 });
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      username: username.toLowerCase(),
      display_name: displayName,
      bio: bio ?? null,
      class_name: className ?? null,
      role: "student",
      trust_score: 50,
      aura_score: 0,
      can_invite: true,
      invite_slots: 3,
    });

    if (profileError) {
      // Cleanup auth user if profile creation fails
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Failed to create profile." }, { status: 500 });
    }

    // Mark invite as used
    await supabase
      .from("invites")
      .update({ status: "used", used_by: userId, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Create invite chain entry
    if (invite.created_by) {
      const { data: parentChain } = await supabase
        .from("invite_chains")
        .select("depth, root_id")
        .eq("invitee_id", invite.created_by)
        .single();

      const depth = parentChain ? parentChain.depth + 1 : 1;
      const rootId = parentChain?.root_id ?? invite.created_by;

      await supabase.from("invite_chains").insert({
        inviter_id: invite.created_by,
        invitee_id: userId,
        invite_id: invite.id,
        depth,
        root_id: rootId,
      });

      // Reward inviter with trust (non-critical, best-effort)
      try {
        await supabase.rpc("adjust_trust_score" as never, {
          p_user_id: invite.created_by,
          p_delta: 5,
        });
      } catch {
        // Non-critical
      }

      // Send notification to inviter
      await supabase.from("notifications").insert({
        user_id: invite.created_by,
        actor_id: userId,
        type: "invite_accepted",
        message: `@${username} joined using your invite.`,
      });
    }

    // Sign in the new user to get a session
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Account created but couldn't sign in immediately — not critical
    }

    return NextResponse.json({ success: true, userId });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
