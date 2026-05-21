-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tomorrow_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tomorrow_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotted_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whispers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin or moderator
CREATE OR REPLACE FUNCTION is_admin_or_mod()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_banned_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_banned = TRUE OR is_muted = TRUE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================

-- Anyone authenticated can read non-banned profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (NOT is_banned OR is_admin_or_mod());

-- Users can update their own profile (non-admin fields)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    role = (SELECT role FROM profiles WHERE id = auth.uid()) AND -- can't change own role
    is_banned = (SELECT is_banned FROM profiles WHERE id = auth.uid()) AND
    is_shadowbanned = (SELECT is_shadowbanned FROM profiles WHERE id = auth.uid())
  );

-- Admins/mods can update any profile
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin_or_mod());

-- Service role can do everything (for API routes)
CREATE POLICY "profiles_service_all" ON profiles
  FOR ALL TO service_role
  USING (TRUE);

-- ============================================================
-- INVITES POLICIES
-- ============================================================

-- Users can see their own invites
CREATE POLICY "invites_select_own" ON invites
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR is_admin_or_mod());

-- Admins can manage all
CREATE POLICY "invites_admin" ON invites
  FOR ALL TO authenticated
  USING (is_admin());

-- Service role can read/write (for invite verification)
CREATE POLICY "invites_service" ON invites
  FOR ALL TO service_role
  USING (TRUE);

-- Allow anonymous/unauthenticated to check invite codes (for signup flow)
CREATE POLICY "invites_anon_check" ON invites
  FOR SELECT TO anon
  USING (status = 'active');

-- ============================================================
-- POSTS POLICIES
-- ============================================================

-- Read: authenticated users see non-deleted, non-shadowbanned posts
CREATE POLICY "posts_select" ON posts
  FOR SELECT TO authenticated
  USING (
    is_deleted = FALSE AND
    (
      -- Show non-shadowbanned posts OR show own posts OR admin can see all
      (SELECT NOT is_shadowbanned FROM profiles WHERE id = author_id) OR
      author_id = auth.uid() OR
      is_admin_or_mod()
    )
  );

-- Create: authenticated non-banned users
CREATE POLICY "posts_insert" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    NOT is_banned_user()
  );

-- Update: only own posts or admin
CREATE POLICY "posts_update" ON posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR is_admin_or_mod());

-- Delete: only admin/mod
CREATE POLICY "posts_delete" ON posts
  FOR DELETE TO authenticated
  USING (is_admin_or_mod());

CREATE POLICY "posts_service" ON posts FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- COMMENTS POLICIES
-- ============================================================

CREATE POLICY "comments_select" ON comments
  FOR SELECT TO authenticated
  USING (
    is_deleted = FALSE AND
    (
      (SELECT NOT is_shadowbanned FROM profiles WHERE id = author_id) OR
      author_id = auth.uid() OR
      is_admin_or_mod()
    )
  );

CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    NOT is_banned_user()
  );

CREATE POLICY "comments_update" ON comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR is_admin_or_mod());

CREATE POLICY "comments_service" ON comments FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- REACTIONS POLICIES
-- ============================================================

CREATE POLICY "reactions_select" ON reactions
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "reactions_insert" ON reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT is_banned_user());

CREATE POLICY "reactions_delete" ON reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod());

CREATE POLICY "reactions_service" ON reactions FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- FOLLOWS POLICIES
-- ============================================================

CREATE POLICY "follows_select" ON follows FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "follows_insert" ON follows
  FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "follows_delete" ON follows
  FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

-- ============================================================
-- STORIES POLICIES
-- ============================================================

-- Only non-expired stories visible
CREATE POLICY "stories_select" ON stories
  FOR SELECT TO authenticated
  USING (
    expires_at > NOW() AND
    (
      (SELECT NOT is_shadowbanned FROM profiles WHERE id = author_id) OR
      author_id = auth.uid() OR
      is_admin_or_mod()
    )
  );

CREATE POLICY "stories_insert" ON stories
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND NOT is_banned_user());

CREATE POLICY "stories_delete" ON stories
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR is_admin_or_mod());

CREATE POLICY "stories_service" ON stories FOR ALL TO service_role USING (TRUE);

CREATE POLICY "story_views_all" ON story_views FOR ALL TO authenticated USING (TRUE);

-- ============================================================
-- POLLS POLICIES
-- ============================================================

CREATE POLICY "polls_select" ON polls FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "poll_options_select" ON poll_options FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "poll_votes_select" ON poll_votes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "poll_votes_insert" ON poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());

CREATE POLICY "polls_service" ON polls FOR ALL TO service_role USING (TRUE);
CREATE POLICY "poll_options_service" ON poll_options FOR ALL TO service_role USING (TRUE);
CREATE POLICY "poll_votes_service" ON poll_votes FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_service" ON notifications FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- TOMORROW BOARD POLICIES
-- ============================================================

CREATE POLICY "tomorrow_select" ON tomorrow_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "tomorrow_insert" ON tomorrow_items
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND NOT is_banned_user());
CREATE POLICY "tomorrow_update" ON tomorrow_items
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR is_admin_or_mod());

CREATE POLICY "tomorrow_upvotes_all" ON tomorrow_upvotes FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod());

-- ============================================================
-- SPOTTED POLICIES
-- ============================================================

-- Only see approved, non-deleted spotted posts
CREATE POLICY "spotted_select" ON spotted_posts
  FOR SELECT TO authenticated
  USING (is_approved = TRUE AND is_deleted = FALSE);

-- Create (anonymous possible — sender_id can be null)
CREATE POLICY "spotted_insert" ON spotted_posts
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Admin can manage
CREATE POLICY "spotted_admin" ON spotted_posts
  FOR ALL TO authenticated
  USING (is_admin_or_mod());

CREATE POLICY "spotted_service" ON spotted_posts FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- WHISPERS POLICIES
-- ============================================================

-- Only admins see whispers
CREATE POLICY "whispers_select" ON whispers
  FOR SELECT TO authenticated
  USING (is_admin_or_mod());

-- Anyone authenticated can submit
CREATE POLICY "whispers_insert" ON whispers
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- Only admins update
CREATE POLICY "whispers_update" ON whispers
  FOR UPDATE TO authenticated
  USING (is_admin_or_mod());

CREATE POLICY "whispers_service" ON whispers FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- REPORTS POLICIES
-- ============================================================

CREATE POLICY "reports_select" ON reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR is_admin_or_mod());

CREATE POLICY "reports_insert" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reports_update" ON reports
  FOR UPDATE TO authenticated
  USING (is_admin_or_mod());

CREATE POLICY "reports_service" ON reports FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- BANS, ACHIEVEMENTS, TRUST EVENTS, MOD LOGS
-- ============================================================

CREATE POLICY "bans_select" ON bans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod());

CREATE POLICY "bans_admin" ON bans FOR ALL TO authenticated USING (is_admin_or_mod());
CREATE POLICY "bans_service" ON bans FOR ALL TO service_role USING (TRUE);

CREATE POLICY "achievements_select" ON achievements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "achievements_service" ON achievements FOR ALL TO service_role USING (TRUE);

CREATE POLICY "trust_events_select" ON trust_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod());
CREATE POLICY "trust_events_service" ON trust_events FOR ALL TO service_role USING (TRUE);

CREATE POLICY "mod_logs_select" ON moderation_logs
  FOR SELECT TO authenticated
  USING (is_admin_or_mod());
CREATE POLICY "mod_logs_service" ON moderation_logs FOR ALL TO service_role USING (TRUE);

-- ============================================================
-- COMMUNITY POLLS
-- ============================================================

CREATE POLICY "community_polls_select" ON community_polls
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "community_polls_insert" ON community_polls
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_mod());

CREATE POLICY "community_poll_options_select" ON community_poll_options
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "community_poll_votes_all" ON community_poll_votes
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_mod());

-- ============================================================
-- APP SETTINGS
-- ============================================================

CREATE POLICY "app_settings_select" ON app_settings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "app_settings_update" ON app_settings
  FOR UPDATE TO authenticated
  USING (is_admin());
CREATE POLICY "app_settings_service" ON app_settings FOR ALL TO service_role USING (TRUE);

-- Bookmarks
CREATE POLICY "bookmarks_select" ON bookmarks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "bookmarks_insert" ON bookmarks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookmarks_delete" ON bookmarks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Post tags
CREATE POLICY "post_tags_select" ON post_tags FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "post_tags_service" ON post_tags FOR ALL TO service_role USING (TRUE);

-- Reposts
CREATE POLICY "reposts_select" ON reposts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "reposts_insert" ON reposts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reposts_delete" ON reposts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Invite chains
CREATE POLICY "invite_chains_select" ON invite_chains
  FOR SELECT TO authenticated USING (is_admin_or_mod());
CREATE POLICY "invite_chains_service" ON invite_chains FOR ALL TO service_role USING (TRUE);
