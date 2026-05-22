-- ============================================================
-- BACKBENCH MIGRATIONS
-- Run after initial schema.sql
-- ============================================================

-- Fix: Enforce one reaction per user per post (any type)
-- Drop old type-specific uniqueness and add post-level uniqueness
DO $$
BEGIN
  -- Drop old unique constraints if they exist
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reactions_user_id_post_id_type_key'
  ) THEN
    ALTER TABLE reactions DROP CONSTRAINT reactions_user_id_post_id_type_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reactions_user_id_comment_id_type_key'
  ) THEN
    ALTER TABLE reactions DROP CONSTRAINT reactions_user_id_comment_id_type_key;
  END IF;

  -- Add correct one-reaction-per-post-per-user constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reactions_user_post_unique'
  ) THEN
    ALTER TABLE reactions ADD CONSTRAINT reactions_user_post_unique
      UNIQUE (user_id, post_id) DEFERRABLE INITIALLY DEFERRED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reactions_user_comment_unique'
  ) THEN
    ALTER TABLE reactions ADD CONSTRAINT reactions_user_comment_unique
      UNIQUE (user_id, comment_id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Add delete_comment to moderation_action enum if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'moderation_action'::regtype
    AND enumlabel = 'delete_comment'
  ) THEN
    ALTER TYPE moderation_action ADD VALUE 'delete_comment';
  END IF;
END $$;

-- Index for bookmarks
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks USING btree (user_id, created_at DESC);

-- Index for story_views
CREATE INDEX IF NOT EXISTS idx_story_views_viewer ON story_views USING btree (viewer_id);

-- Ensure app_settings has exactly one row
INSERT INTO app_settings (emergency_lockdown, lockdown_message, maintenance_mode)
SELECT FALSE, 'Backbench is temporarily unavailable.', FALSE
WHERE NOT EXISTS (SELECT 1 FROM app_settings);

-- Auto-expire stories (run periodically via cron or pg_cron)
-- This is a helper function to clean up expired stories
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM stories WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- v2 MIGRATIONS — Complete platform overhaul
-- Run these in Supabase SQL editor
-- ============================================================

-- 1. Add sender_ip_hash to whispers (per-IP rate limiting)
ALTER TABLE whispers ADD COLUMN IF NOT EXISTS sender_ip_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_whispers_sender ON whispers (sender_ip_hash, created_at);

-- 2. Auto-expire temporary bans
CREATE OR REPLACE FUNCTION auto_expire_bans(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE expired_count INTEGER;
BEGIN
  UPDATE bans SET is_active = FALSE, lifted_at = NOW()
  WHERE user_id = p_user_id AND is_active = TRUE
    AND expires_at IS NOT NULL AND expires_at < NOW();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  IF expired_count > 0 THEN
    UPDATE profiles SET is_banned = FALSE WHERE id = p_user_id
      AND NOT EXISTS (SELECT 1 FROM bans WHERE user_id = p_user_id AND is_active = TRUE);
  END IF;
  RETURN expired_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atomic tomorrow board upvote toggle
CREATE OR REPLACE FUNCTION toggle_tomorrow_upvote(p_item_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE already_voted BOOLEAN; new_count INTEGER;
BEGIN
  SELECT EXISTS(SELECT 1 FROM tomorrow_upvotes WHERE item_id = p_item_id AND user_id = p_user_id) INTO already_voted;
  IF already_voted THEN
    DELETE FROM tomorrow_upvotes WHERE item_id = p_item_id AND user_id = p_user_id;
    UPDATE tomorrow_items SET upvotes = GREATEST(0, upvotes - 1) WHERE id = p_item_id RETURNING upvotes INTO new_count;
  ELSE
    INSERT INTO tomorrow_upvotes(item_id, user_id) VALUES (p_item_id, p_user_id) ON CONFLICT DO NOTHING;
    UPDATE tomorrow_items SET upvotes = upvotes + 1 WHERE id = p_item_id RETURNING upvotes INTO new_count;
  END IF;
  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS Security Fixes

-- Fix: spotted self-approval bypass
DROP POLICY IF EXISTS "spotted_insert" ON spotted_posts;
CREATE POLICY "spotted_insert" ON spotted_posts
  FOR INSERT TO authenticated
  WITH CHECK (is_approved = FALSE AND is_deleted = FALSE AND NOT is_banned_user());

-- Fix: moderator can self-promote to admin role
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin_or_mod())
  WITH CHECK (
    CASE WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'moderator'
    THEN role != 'admin'
    ELSE TRUE END
  );

-- Fix: story_views too permissive
DROP POLICY IF EXISTS "story_views_all" ON story_views;
CREATE POLICY "story_views_insert" ON story_views
  FOR INSERT TO authenticated WITH CHECK (viewer_id = auth.uid());
CREATE POLICY "story_views_select" ON story_views
  FOR SELECT TO authenticated
  USING (viewer_id = auth.uid() OR is_admin_or_mod());

-- Fix: tomorrow_upvotes scope
DROP POLICY IF EXISTS "tomorrow_upvotes_all" ON tomorrow_upvotes;
CREATE POLICY "tomorrow_upvotes_own" ON tomorrow_upvotes
  FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "tomorrow_upvotes_admin" ON tomorrow_upvotes
  FOR SELECT TO authenticated USING (is_admin_or_mod());
