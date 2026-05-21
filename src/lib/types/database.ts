export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          class_name: string | null;
          role: "student" | "moderator" | "admin";
          trust_score: number;
          aura_score: number;
          is_shadowbanned: boolean;
          is_muted: boolean;
          is_banned: boolean;
          is_suspicious: boolean;
          can_invite: boolean;
          invite_slots: number;
          onboarding_done: boolean;
          created_at: string;
          last_active_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          bio?: string | null;
          avatar_url?: string | null;
          class_name?: string | null;
          role?: "student" | "moderator" | "admin";
          trust_score?: number;
          aura_score?: number;
          is_shadowbanned?: boolean;
          is_muted?: boolean;
          is_banned?: boolean;
          is_suspicious?: boolean;
          can_invite?: boolean;
          invite_slots?: number;
          onboarding_done?: boolean;
          created_at?: string;
          last_active_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      invites: {
        Row: {
          id: string;
          code: string;
          created_by: string | null;
          used_by: string | null;
          status: "active" | "used" | "revoked";
          created_at: string;
          used_at: string | null;
          expires_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          created_by?: string | null;
          used_by?: string | null;
          status?: "active" | "used" | "revoked";
          created_at?: string;
          used_at?: string | null;
          expires_at?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invites"]["Insert"]>;
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          type: "text" | "image" | "poll";
          content: string | null;
          image_url: string | null;
          is_anonymous: boolean;
          is_pinned: boolean;
          is_deleted: boolean;
          is_flagged: boolean;
          view_count: number;
          repost_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          type?: "text" | "image" | "poll";
          content?: string | null;
          image_url?: string | null;
          is_anonymous?: boolean;
          is_pinned?: boolean;
          is_deleted?: boolean;
          is_flagged?: boolean;
          view_count?: number;
          repost_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          parent_id: string | null;
          content: string;
          is_deleted: boolean;
          is_flagged: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          parent_id?: string | null;
          content: string;
          is_deleted?: boolean;
          is_flagged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
      };
      reactions: {
        Row: {
          id: string;
          user_id: string;
          post_id: string | null;
          comment_id: string | null;
          type: "fire" | "skull" | "lol" | "sob" | "brain" | "zap";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id?: string | null;
          comment_id?: string | null;
          type: "fire" | "skull" | "lol" | "sob" | "brain" | "zap";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
      };
      stories: {
        Row: {
          id: string;
          author_id: string;
          type: "image" | "text";
          content: string | null;
          image_url: string | null;
          bg_color: string | null;
          class_name: string | null;
          view_count: number;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          type?: "image" | "text";
          content?: string | null;
          image_url?: string | null;
          bg_color?: string | null;
          class_name?: string | null;
          view_count?: number;
          expires_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stories"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string | null;
          type: string;
          post_id: string | null;
          comment_id: string | null;
          message: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id?: string | null;
          type: string;
          post_id?: string | null;
          comment_id?: string | null;
          message?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      tomorrow_items: {
        Row: {
          id: string;
          author_id: string;
          class_name: string | null;
          title: string;
          description: string | null;
          date: string;
          is_pinned: boolean;
          upvotes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          class_name?: string | null;
          title: string;
          description?: string | null;
          date?: string;
          is_pinned?: boolean;
          upvotes?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tomorrow_items"]["Insert"]>;
      };
      spotted_posts: {
        Row: {
          id: string;
          sender_id: string | null;
          content: string;
          is_approved: boolean;
          is_deleted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id?: string | null;
          content: string;
          is_approved?: boolean;
          is_deleted?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["spotted_posts"]["Insert"]>;
      };
      whispers: {
        Row: {
          id: string;
          content: string;
          image_url: string | null;
          status: "pending" | "reviewed" | "reposted" | "dismissed";
          admin_note: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          content: string;
          image_url?: string | null;
          status?: "pending" | "reviewed" | "reposted" | "dismissed";
          admin_note?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["whispers"]["Insert"]>;
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user: string | null;
          post_id: string | null;
          comment_id: string | null;
          reason: string;
          details: string | null;
          is_resolved: boolean;
          resolved_by: string | null;
          resolution: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user?: string | null;
          post_id?: string | null;
          comment_id?: string | null;
          reason: string;
          details?: string | null;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolution?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };
      bans: {
        Row: {
          id: string;
          user_id: string;
          type: "temporary" | "permanent" | "shadowban";
          reason: string;
          issued_by: string | null;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
          lifted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "temporary" | "permanent" | "shadowban";
          reason: string;
          issued_by?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          lifted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bans"]["Insert"]>;
      };
      moderation_logs: {
        Row: {
          id: string;
          mod_id: string | null;
          action: string;
          target_user: string | null;
          target_post: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mod_id?: string | null;
          action: string;
          target_user?: string | null;
          target_post?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["moderation_logs"]["Insert"]>;
      };
      app_settings: {
        Row: {
          id: string;
          emergency_lockdown: boolean;
          lockdown_message: string | null;
          maintenance_mode: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          emergency_lockdown?: boolean;
          lockdown_message?: string | null;
          maintenance_mode?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Insert"]>;
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin_or_mod: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      compute_aura: { Args: { user_id: string }; Returns: number };
      increment_post_views: { Args: { post_id: string }; Returns: void };
      is_locked_down: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      user_role: "student" | "moderator" | "admin";
      post_type: "text" | "image" | "poll";
      reaction_type: "fire" | "skull" | "lol" | "sob" | "brain" | "zap";
      ban_type: "temporary" | "permanent" | "shadowban";
    };
  };
};

// Convenience types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type Reaction = Database["public"]["Tables"]["reactions"]["Row"];
export type Story = Database["public"]["Tables"]["stories"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type Whisper = Database["public"]["Tables"]["whispers"]["Row"];
export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type TomorrowItem = Database["public"]["Tables"]["tomorrow_items"]["Row"];
export type SpottedPost = Database["public"]["Tables"]["spotted_posts"]["Row"];

// Enriched types with joins
export type PostWithAuthor = Post & {
  profiles: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "is_shadowbanned">;
  reactions: Reaction[];
  _count?: { comments: number };
};

export type CommentWithAuthor = Comment & {
  profiles: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
  replies?: CommentWithAuthor[];
};
