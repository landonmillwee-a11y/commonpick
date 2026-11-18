# CommonPick

A public community polling site. Frontend: plain HTML/CSS/JavaScript. Database and authentication: Supabase. Hosting: Vercel.

## Current features

- Public feed of published polls with search, category filters, trending, and newest sections.
- Polls support 2–40 answer choices.
- Visitors receive a Supabase anonymous account and can vote without entering an email.
- A Supabase identity can vote once per poll. The database also retains the legacy browser-voter uniqueness constraint.
- Visitors can add and verify an email to preserve the same guest account and its votes.
- Individual polls have shareable links.
- Admin dashboard supports poll creation, editing, publishing, closing, reopening, deletion, category recommendations, and an assistant draft queue.
- Vote rows are private; the public site receives aggregate vote totals and whether the current identity has voted.

## Deploy and database setup

Vercel deploys automatically when changes are committed to the connected branch. Confirm the deployment has finished before testing.

For a fresh Supabase setup, run the SQL files in this order from Supabase → SQL Editor → New query:

1. `supabase/schema.sql`
2. `supabase/anonymous-voting-migration.sql`
3. `supabase/anonymous-vote-stats-migration.sql`
4. `supabase/assistant-drafts-migration.sql` (if present)
5. `supabase/admin-management-migration.sql`

Do not rerun migrations casually on a live site. Review the SQL and confirm backups before making production database changes.

In Supabase Authentication → URL Configuration:
- Site URL: `https://commonpick.vercel.app`
- Redirect URL allowlist should include `https://commonpick.vercel.app/**` and `https://commonpick.vercel.app/admin.html`.

In Supabase Authentication → Sign In / Providers:
- Enable Anonymous Sign-Ins.
- Enable Email sign-in for the administrator.

## ChatGPT-assisted poll creation

The admin dashboard prepares a detailed prompt for ChatGPT. The administrator copies the prompt into ChatGPT, asks it to create a poll, then pastes ChatGPT's JSON response back into the admin page. CommonPick validates the response and loads the question, description, category, and answer choices into the poll editor.

The administrator reviews and edits the imported poll, then chooses whether to save it as a draft or publish it. Nothing is published automatically. This workflow uses the ChatGPT website and does not require an OpenAI API key, Supabase Edge Function, or separate API billing.

## Admin dashboard

Open `https://commonpick.vercel.app/admin.html`.

- The permitted administrator email is `landonmillwee@gmail.com`.
- Request a secure sign-in link and open it in the same browser.
- The dashboard can create polls with 2–40 choices, save drafts, publish, edit, close, reopen, and delete polls.
- Public visitors can only see published polls.

Supabase Row Level Security policies enforce admin-only poll management. The browser-side email check is only a user-interface convenience, not the security boundary.

## Voting and account limitations

- Voting starts with an anonymous Supabase identity; no email is required to cast a vote.
- Adding and verifying an email is intended to retain votes on that same anonymous identity.
- **Cross-browser merging is not implemented yet.** Two separate anonymous accounts are still separate identities. A secure claim/merge workflow must verify control of both identities and resolve duplicate votes before it is enabled.
- Losing the browser's Supabase session before adding an email can make that anonymous account's votes unrecoverable.
- The current database limit is one vote per Supabase identity per poll, not one vote per verified human.

## Security notes

- The Supabase publishable key is expected in browser code. Never put a Supabase secret or service-role key in `app.js` or `admin.js`.
- Individual vote rows are not readable by public roles. The public RPC returns aggregate counts and the current identity's voted status.
- Before a large public launch, add rate limiting/abuse monitoring, poll reporting and moderation, and complete a security review.
