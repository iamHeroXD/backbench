import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ valid: false, error: "No code provided" }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    const { data: invite, error } = await supabase
      .from("invites")
      .select("id, status, expires_at")
      .eq("code", normalizedCode)
      .single();

    if (error || !invite) {
      return NextResponse.json({ valid: false });
    }

    if (invite.status !== "active") {
      return NextResponse.json({ valid: false });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false, error: "Server error" }, { status: 500 });
  }
}
