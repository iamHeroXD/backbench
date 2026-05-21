-- ============================================================
-- BACKBENCH DATABASE SCHEMA
-- PostgreSQL / Supabase
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('student', 'moderator', 'admin');
CREATE TYPE post_type AS ENUM ('text', 'image', 'poll');
CREATE TYPE story_type AS ENUM ('image', 'text');
CREATE TYPE reaction_type AS ENUM ('fire', 'skull', 'lol', 'sob', 'brain', 'zap');
CREATE TYPE report_reason AS ENUM (
  'harassment', 'bullying', 'spam', 'fake_account',
  'creepy_behavior', 'doxxing', 'impersonation', 'other'
);
CREATE TYPE ban_type AS ENUM ('temporary', 'permanent', 'shadowban');
CREATE TYPE notification_type AS ENUM (
  'comment', 'reply', 'mention', 'follow', 'reaction',
  'announcement', 'invite_accepted', 'council_invite'
);
CREATE TYPE whisper_status AS ENUM ('pending', 'reviewed', 'reposted', 'dismissed');
CREATE TYPE invite_status AS ENUM ('active', 'used', 'revoked');
CREATE TYPE moderation_action AS ENUM (
  'ban', 'unban', 'shadowban', 'mute', 'unmute',
  'delete_post', 'delete_comment', 'revoke_invite',
  'restore_invite', 'pin_post', 'unpin_post', 'approve_spotted',
  'reject_spotted', 'lockdown_on', 'lockdown_off'
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            TEXT UNIQUE NOT NULL CHECK (username ~* '^[a-z0-9_]{3,30}$'),
  display_name        TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  bio                 TEXT CHECK (char_length(bio) <= 200),
  avatar_url          TEXT,
  class_name          TEXT, -- e.g. "12 Science A", "11 Commerce B"
  role                user_role NOT NULL DEFAULT 'student',
  trust_score         INTEGER NOT NULL DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  aura_score          INTEGER NOT NULL DEFAULT 0,
  is_shadowbanned     BOOLEAN NOT NULL DEFAULT FALSE,
  is_muted            BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned           BOOLEAN NOT NULL DEFAULT FALSE,
  is_suspicious       BOOLEAN NOT NULL DEFAULT FALSE,
  can_invite          BOOLEAN NOT NULL DEFAULT TRUE,
  invite_slots        INTEGER NOT NULL DEFAULT 3 CHECK (invite_slots >= 0),
  onboarding_done     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON profiles USING btree (username);
CREATE INDEX idx_profiles_class ON profiles USING btree (class_name);
CREATE INDEX idx_profiles_trust ON profiles USING btree (trust_score);
CREATE INDEX idx_profiles_username_trgm ON profiles USING gin (username gin_trgm_ops);
CREATE INDEX idx_profiles_display_trgm ON profiles USING gin (display_name gin_trgm_ops);

-- ============================================================
-- INVITE SYSTEM
-- ============================================================

CREATE TABLE invites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status         invite_status NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at        TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  notes          TEXT -- admin notes
);

CREATE INDEX idx_invites_code ON invites USING btree (code);
CREATE INDEX idx_invites_created_by ON invites USING btree (created_by);
CREATE INDEX idx_invites_status ON invites USING btree (status);

-- Invite chain (tree structure)
CREATE TABLE invite_chains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_id   UUID NOT NULL REFERENCES invites(id),
  depth       INTEGER NOT NULL DEFAULT 1, -- depth from root
  root_id     UUID REFERENCES profiles(id), -- original root inviter
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invitee_id) -- each person has exactly one inviter
);

CREATE INDEX idx_invite_chains_inviter ON invite_chains USING btree (inviter_id);
CREATE INDEX idx_invite_chains_root ON invite_chains USING btree (root_id);

-- ============================================================
-- POSTS
-- ============================================================

CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            post_type NOT NULL DEFAULT 'text',
  content         TEXT CHECK (char_length(content) <= 2000),
  image_url       TEXT,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  is_flagged      BOOLEAN NOT NULL DEFAULT FALSE,
  view_count      INTEGER NOT NULL DEFAULT 0,
  repost_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_author ON posts USING btree (author_id);
CREATE INDEX idx_posts_created ON posts USING btree (created_at DESC);
CREATE INDEX idx_posts_pinned ON posts USING btree (is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_posts_content_trgm ON posts USING gin (content gin_trgm_ops);

-- Post tags
CREATE TABLE post_tags (
  post_id  UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX idx_post_tags_tag ON post_tags USING btree (tag);

-- ============================================================
-- REPOSTS
-- ============================================================

CREATE TABLE reposts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

-- ============================================================
-- BOOKMARKS
-- ============================================================

CREATE TABLE bookmarks (
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ============================================================
-- COMMENTS
-- ============================================================

CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  is_flagged  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON comments USING btree (post_id, created_at);
CREATE INDEX idx_comments_parent ON comments USING btree (parent_id);
CREATE INDEX idx_comments_author ON comments USING btree (author_id);

-- ============================================================
-- REACTIONS
-- ============================================================

CREATE TABLE reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  type        reaction_type NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE (user_id, post_id, type),
  UNIQUE (user_id, comment_id, type)
);

CREATE INDEX idx_reactions_post ON reactions USING btree (post_id);
CREATE INDEX idx_reactions_comment ON reactions USING btree (comment_id);
CREATE INDEX idx_reactions_user ON reactions USING btree (user_id);

-- ============================================================
-- FOLLOWS
-- ============================================================

CREATE TABLE follows (
  follower_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_following ON follows USING btree (following_id);

-- ============================================================
-- STORIES
-- ============================================================

CREATE TABLE stories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        story_type NOT NULL DEFAULT 'text',
  content     TEXT,
  image_url   TEXT,
  bg_color    TEXT DEFAULT '#1e1e1e',
  class_name  TEXT, -- for class stories
  view_count  INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stories_author ON stories USING btree (author_id);
CREATE INDEX idx_stories_expires ON stories USING btree (expires_at);
CREATE INDEX idx_stories_class ON stories USING btree (class_name);

CREATE TABLE story_views (
  story_id    UUID REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

-- ============================================================
-- POLLS
-- ============================================================

CREATE TABLE polls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID UNIQUE NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  question        TEXT NOT NULL CHECK (char_length(question) <= 300),
  anonymous_votes BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE poll_options (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id  UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text     TEXT NOT NULL CHECK (char_length(text) <= 100),
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_poll_options_poll ON poll_options USING btree (poll_id, position);

CREATE TABLE poll_votes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  poll_id   UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  voter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  voted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, voter_id) -- one vote per poll per user
);

CREATE INDEX idx_poll_votes_poll ON poll_votes USING btree (poll_id);
CREATE INDEX idx_poll_votes_option ON poll_votes USING btree (option_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type        notification_type NOT NULL,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  message     TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications USING btree (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications USING btree (user_id) WHERE is_read = FALSE;

-- ============================================================
-- TOMORROW BOARD
-- ============================================================

CREATE TABLE tomorrow_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_name  TEXT, -- null = all classes
  title       TEXT NOT NULL CHECK (char_length(title) <= 200),
  description TEXT CHECK (char_length(description) <= 500),
  date        DATE NOT NULL DEFAULT CURRENT_DATE + 1,
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  upvotes     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tomorrow_date ON tomorrow_items USING btree (date, created_at DESC);
CREATE INDEX idx_tomorrow_class ON tomorrow_items USING btree (class_name);

CREATE TABLE tomorrow_upvotes (
  item_id   UUID REFERENCES tomorrow_items(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, user_id)
);

-- ============================================================
-- SPOTTED SECTION
-- ============================================================

CREATE TABLE spotted_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content      TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 500),
  is_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spotted_approved ON spotted_posts USING btree (created_at DESC)
  WHERE is_approved = TRUE AND is_deleted = FALSE;

-- ============================================================
-- WHISPERS SYSTEM
-- ============================================================

CREATE TABLE whispers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 1000),
  image_url   TEXT,
  status      whisper_status NOT NULL DEFAULT 'pending',
  admin_note  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_whispers_status ON whispers USING btree (status, created_at DESC);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id    UUID REFERENCES comments(id) ON DELETE CASCADE,
  reason        report_reason NOT NULL,
  details       TEXT CHECK (char_length(details) <= 500),
  is_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX idx_reports_unresolved ON reports USING btree (created_at DESC)
  WHERE is_resolved = FALSE;
CREATE INDEX idx_reports_user ON reports USING btree (reported_user);

-- ============================================================
-- BANS
-- ============================================================

CREATE TABLE bans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         ban_type NOT NULL,
  reason       TEXT NOT NULL,
  issued_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ, -- null = permanent
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lifted_at    TIMESTAMPTZ
);

CREATE INDEX idx_bans_user ON bans USING btree (user_id) WHERE is_active = TRUE;

-- ============================================================
-- ACHIEVEMENTS
-- ============================================================

CREATE TABLE achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL, -- e.g. 'first_post', 'popular_post', 'trusted_inviter'
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

CREATE INDEX idx_achievements_user ON achievements USING btree (user_id);

-- ============================================================
-- TRUST SCORE EVENTS
-- ============================================================

CREATE TABLE trust_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta       INTEGER NOT NULL, -- positive or negative
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_events_user ON trust_events USING btree (user_id, created_at DESC);

-- ============================================================
-- MODERATION LOGS
-- ============================================================

CREATE TABLE moderation_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mod_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      moderation_action NOT NULL,
  target_user UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_post UUID REFERENCES posts(id) ON DELETE SET NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mod_logs_created ON moderation_logs USING btree (created_at DESC);
CREATE INDEX idx_mod_logs_target ON moderation_logs USING btree (target_user);

-- ============================================================
-- COMMUNITY GOVERNANCE
-- ============================================================

CREATE TABLE community_polls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ends_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE community_poll_options (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID NOT NULL REFERENCES community_polls(id) ON DELETE CASCADE,
  text      TEXT NOT NULL,
  votes     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE community_poll_votes (
  poll_id   UUID REFERENCES community_polls(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  option_id UUID REFERENCES community_poll_options(id) ON DELETE CASCADE,
  voted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

-- ============================================================
-- APP SETTINGS (singleton)
-- ============================================================

CREATE TABLE app_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_lockdown BOOLEAN NOT NULL DEFAULT FALSE,
  lockdown_message   TEXT DEFAULT 'Backbench is temporarily unavailable.',
  maintenance_mode   BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO app_settings (id) VALUES (gen_random_uuid());

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile after signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile is created via the signup API, not auto-triggered
  -- This function handles any post-creation setup
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update last_active_at
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET last_active_at = NOW() WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Compute aura score
CREATE OR REPLACE FUNCTION compute_aura(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  post_reactions INTEGER;
  follower_count INTEGER;
  post_count INTEGER;
  days_active INTEGER;
BEGIN
  SELECT COUNT(*) INTO post_reactions
  FROM reactions r
  JOIN posts p ON r.post_id = p.id
  WHERE p.author_id = user_id AND p.is_deleted = FALSE;

  SELECT COUNT(*) INTO follower_count
  FROM follows WHERE following_id = user_id;

  SELECT COUNT(*) INTO post_count
  FROM posts WHERE author_id = user_id AND is_deleted = FALSE;

  SELECT EXTRACT(DAY FROM NOW() - created_at)::INTEGER INTO days_active
  FROM profiles WHERE id = user_id;

  score := (post_reactions * 2) + (follower_count * 5) + (post_count * 3) + LEAST(days_active, 100);
  RETURN score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment view count
CREATE OR REPLACE FUNCTION increment_post_views(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE posts SET view_count = view_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check emergency lockdown
CREATE OR REPLACE FUNCTION is_locked_down()
RETURNS BOOLEAN AS $$
DECLARE
  locked BOOLEAN;
BEGIN
  SELECT emergency_lockdown INTO locked FROM app_settings LIMIT 1;
  RETURN COALESCE(locked, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REALTIME PUBLICATIONS
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE stories;
ALTER PUBLICATION supabase_realtime ADD TABLE tomorrow_items;
