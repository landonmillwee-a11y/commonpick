# CommonPick

A public community polling site. Frontend: plain HTML/CSS/JS. Database and email authentication: Supabase. Hosting: Vercel.

## Deploy the multi-poll version

1. Open your Supabase project.
2. Go to **SQL Editor → New query**.
3. Paste the entire current `supabase/schema.sql` file from this repository and run it. It upgrades the original fries poll and preserves its votes.
4. In Supabase, open **Authentication → URL Configuration**.
5. Set the Site URL to `https://commonpick.vercel.app`.
6. Add `https://commonpick.vercel.app/admin.html` to the Redirect URLs allowlist.
7. In Supabase **Authentication → Providers → Email**, make sure Email is enabled. Email OTP / magic link sign-in is used for the admin dashboard.
8. Vercel deploys automatically when changes are committed to the main branch. Wait for deployment to finish, then visit the site.

## Admin dashboard

Open `https://commonpick.vercel.app/admin.html`.

- The only permitted administrator email is `landonmillwee@gmail.com`.
- Enter that email and request a sign-in link.
- Open the email on the same browser/device and follow the link.
- Create polls with 2–40 answer choices.
- Save polls as drafts, publish them, edit them, or close voting.
- Public visitors can only see published polls.

Supabase Row Level Security policies enforce admin-only poll management. The browser-side email check is only a user-interface convenience, not the security boundary.

## Public voting

- Visitors can vote in multiple different polls.
- Each browser-local voter ID can vote once per poll.
- Results are visible on each published poll.
- The original fries poll and existing vote records are retained.

## Security and prototype limitations

The public Supabase publishable key is expected in browser code. Never put a Supabase secret or service-role key in `app.js` or `admin.js`.

The current one-vote limit is per browser-stored UUID, not per verified human. Clearing browser storage or using another device can bypass it. Before a large public launch, add stronger voter verification, rate limiting, abuse monitoring, and moderation.
