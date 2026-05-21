-- ============================================================
-- ADMIN SETUP SCRIPT
-- Run this AFTER creating admin auth user via Supabase Dashboard
-- ============================================================

-- STEP 1: Create the admin user in Supabase Auth Dashboard
--   Email: admin@backbench.local (or any email you own)
--   Password: c6h12o6c6h12o6###$$$
--   Toggle "Auto Confirm User" ON

-- STEP 2: Get the UUID from auth.users table:
--   SELECT id FROM auth.users WHERE email = 'admin@backbench.local';

-- STEP 3: Replace 'PASTE_ADMIN_UUID_HERE' below with the actual UUID

-- Create admin profile
INSERT INTO profiles (
  id,
  username,
  display_name,
  role,
  can_invite,
  invite_slots,
  onboarding_done,
  trust_score,
  aura_score
) VALUES (
  '5fba7b0a-c3db-4deb-bb64-149e4ee13268',  -- Replace with actual UUID from auth.users
  'adminisreal',            -- Admin username (as specified)
  'Admin',
  'admin',
  TRUE,
  999,
  TRUE,
  100,
  9999
)
ON CONFLICT (id) DO UPDATE SET
  username = 'adminisreal',
  role = 'admin',
  can_invite = TRUE,
  invite_slots = 999,
  trust_score = 100;

-- STEP 4: Generate initial invite codes for the admin
-- (Replace UUID before running)
INSERT INTO invites (code, created_by, status)
SELECT
  'VHSS-' || upper(substring(md5(random()::text), 1, 4)) || '-' || upper(substring(md5(random()::text), 1, 4)),
  '5fba7b0a-c3db-4deb-bb64-149e4ee13268',
  'active'
FROM generate_series(1, 20);

-- STEP 5: Verify
-- SELECT username, role, invite_slots FROM profiles WHERE username = 'adminisreal';
-- SELECT code, status FROM invites WHERE created_by = 'PASTE_ADMIN_UUID_HERE' LIMIT 5;
