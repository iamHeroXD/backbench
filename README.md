# Backbench

The unofficial student network. Private, invite-only, built for VHSS Plus Two students.

---

## Quick Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up Supabase database

In your Supabase dashboard → SQL Editor, run these in order:

1. `supabase/schema.sql` — creates all tables
2. `supabase/rls-policies.sql` — applies security policies

### 4. Create admin account

1. Go to Supabase Dashboard → Authentication → Users → Add User
2. Email: any email you own
3. Password: `c6h12o6c6h12o6###$$$`
4. Toggle "Auto Confirm User" ON
5. Copy the UUID from the users list
6. Open `supabase/admin-setup.sql`, replace `PASTE_ADMIN_UUID_HERE` with the UUID
7. Run the modified SQL in Supabase SQL Editor

### 5. Set up Storage buckets

In Supabase Dashboard → Storage → New Bucket:
- `avatars` — Public
- `posts` — Public  
- `stories` — Public
- `whispers` — Private (admin only)

### 6. Add your logo

Place your `logoofbackbench.png` file in the `public/` folder.

### 7. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Admin Access

- URL: `/admin`
- Username: `adminisreal`
- Password: `c6h12o6c6h12o6###$$$`

> **Note on passwords:** All passwords are automatically bcrypt-hashed by Supabase Auth. This is mandatory security — not optional. Plain-text passwords are never stored anywhere in the database. This protects users from data breaches.

---

## Invite System

- Admin generates invite codes from `/admin` → Invites tab
- Share codes with trusted students
- Each code can only be used once
- Invite chains are tracked for moderation

---

## Deployment (Vercel)

1. Push to GitHub
2. Connect repo to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

---

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, TailwindCSS, Framer Motion
- **Backend:** Supabase (Auth + PostgreSQL + Storage + Realtime)
- **Hosting:** Vercel

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with invite code entry |
| `/login` | Sign in |
| `/signup?code=XXX` | Create account with invite |
| `/feed` | Main infinite feed |
| `/explore` | Trending + discover |
| `/search` | Search users and posts |
| `/profile/:username` | User profile |
| `/notifications` | Notification center |
| `/tomorrow` | Daily board for exams/reminders |
| `/spotted` | Anonymous compliments |
| `/polls` | Community polls |
| `/whispers` | Anonymous tips to admin |
| `/settings` | Profile + account settings |
| `/onboarding` | New user welcome flow |
| `/admin` | Admin dashboard (admin/mod only) |
