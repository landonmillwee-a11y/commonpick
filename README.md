# CommonPick

A small public voting-site MVP. Frontend: plain HTML/CSS/JS. Database: Supabase. Hosting: Vercel.

## 1. Create the database

1. Open your Supabase project.
2. Go to **SQL Editor** → **New query**.
3. Paste and run all of `supabase/schema.sql`.

## 2. Connect the website

1. In Supabase, open **Project Settings** → **API** (or **Data API / API Keys**, depending on dashboard layout).
2. Copy the **Project URL** and the **anon / publishable key**. Never use a `service_role` or secret key in browser code.
3. Open `app.js`.
4. Replace `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE` and `PASTE_YOUR_SUPABASE_ANON_KEY_HERE` with those values.

## 3. Upload to GitHub

Upload `index.html`, `styles.css`, `app.js`, and the `supabase` folder to the root of your `commonpick` repository. Keep the file names and folder structure unchanged.

## 4. Publish with Vercel

1. Sign in to Vercel using GitHub.
2. Choose **Add New → Project**.
3. Import the `commonpick` repository.
4. Leave framework preset as **Other**. Leave build command and output directory blank.
5. Deploy.

## Current MVP behavior

- One starter poll: best fast-food fries.
- Four fixed choices.
- Votes and results stored in Supabase.
- Browser-local voter ID prevents repeat votes from the same browser profile.
- Results are visible to everyone.

## Important limitations

This is a prototype, not a fraud-resistant election system. A user can clear browser storage or use another browser/device to vote again. The public anon key is intended to be exposed in a browser; never expose a service-role key. Before a wider launch, add rate limiting, stronger voter verification, poll/option tables, moderation, and abuse monitoring.
