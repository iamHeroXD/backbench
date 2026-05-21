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
