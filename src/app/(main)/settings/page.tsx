"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Camera, LogOut, Shield, Eye } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CLASS_OPTIONS, getAvatarFallback } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [className, setClassName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name);
        setBio(data.bio ?? "");
        setClassName(data.class_name ?? "");
      }
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function saveProfile() {
    if (!profile || saving) return;
    if (!displayName.trim()) { toast.error("Display name required."); return; }
    setSaving(true);

    try {
      let avatarUrl = profile.avatar_url;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${profile.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true });

        if (!uploadError) {
          const { data } = supabase.storage.from("avatars").getPublicUrl(path);
          avatarUrl = data.publicUrl + `?t=${Date.now()}`;
        }
      }

      await supabase.from("profiles").update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        class_name: className || null,
        avatar_url: avatarUrl,
      }).eq("id", profile.id);

      toast.success("Profile saved.");
      setAvatarFile(null);
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="pt-2 px-3">
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="shimmer h-14 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 px-3 pb-6">
      {/* Avatar */}
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-3">
          <div className="w-20 h-20 rounded-full bg-[#222] overflow-hidden flex items-center justify-center">
            {(avatarPreview ?? profile?.avatar_url) ? (
              <Image
                src={avatarPreview ?? profile?.avatar_url ?? ""}
                alt=""
                width={80}
                height={80}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-2xl font-medium text-[#888]">
                {profile ? getAvatarFallback(profile.display_name) : "?"}
              </span>
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-7 h-7 bg-[#4a7aa8] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#5a8ab8] transition-colors">
            <Camera size={13} className="text-white" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB."); return; }
                setAvatarFile(f);
                setAvatarPreview(URL.createObjectURL(f));
              }}
            />
          </label>
        </div>
        <p className="text-[#888] text-sm">@{profile?.username}</p>
      </div>

      {/* Profile fields */}
      <div className="space-y-3 mb-6">
        <div>
          <label className="text-[#666] text-xs block mb-1.5">display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bb-input w-full"
            maxLength={50}
          />
        </div>

        <div>
          <label className="text-[#666] text-xs block mb-1.5">bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="bb-input w-full resize-none h-16 text-sm"
            maxLength={200}
            placeholder="write something about yourself..."
          />
        </div>

        <div>
          <label className="text-[#666] text-xs block mb-1.5">class</label>
          <select
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="bb-input w-full"
          >
            <option value="">not specified</option>
            {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full bg-[#4a7aa8] hover:bg-[#5a8ab8] text-white py-2.5 rounded-lg text-sm font-medium
                     disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          {saving ? "saving..." : "save changes"}
        </button>
      </div>

      {/* Account section */}
      <div className="space-y-1">
        <p className="text-[#444] text-xs uppercase tracking-wider mb-2">account</p>

        <div className="bb-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield size={15} className="text-[#555]" />
            <div>
              <p className="text-[#d0d0d0] text-sm">trust score</p>
              <p className="text-[#555] text-xs">your community standing</p>
            </div>
          </div>
          <span className="text-[#4a7aa8] text-sm font-medium">{profile?.trust_score}/100</span>
        </div>

        <div className="bb-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Eye size={15} className="text-[#555]" />
            <div>
              <p className="text-[#d0d0d0] text-sm">invite slots</p>
              <p className="text-[#555] text-xs">available invites</p>
            </div>
          </div>
          <span className="text-[#888] text-sm">{profile?.invite_slots}</span>
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-6 pt-5 border-t border-[#1e1e1e] space-y-2">
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] rounded-xl text-sm hover:border-red-500/30 hover:text-red-400 transition-colors"
        >
          <LogOut size={14} />
          sign out
        </button>
      </div>
    </div>
  );
}
