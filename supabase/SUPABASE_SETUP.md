# Connecting the real lab database (Supabase)

Right now the app and the wall use **demo data**, which lives in each browser.
Follow these steps once so every phone and the wall screen share one real database.
It takes about 10 minutes and it's free.

---

## 1. Create the Supabase project

1. Go to **https://supabase.com** and click **Start your project**.
2. Click **Continue with GitHub** and use the lab's GitHub account (`drugdiscolabmb`).
3. Click **New project** and fill in:
   - **Name:** `drugdisco-checkin`
   - **Database password:** click **Generate a password** and save it somewhere safe. The website doesn't need it.
   - **Region:** **Southeast Asia (Singapore)**. It's the closest to Bangkok.
   - If you see **Enable Data API**, leave it **ticked**.
4. Click **Create new project** and wait 1–2 minutes until it's ready.

## 2. Create the tables and functions

1. In the left menu, open **SQL Editor**.
2. Click **+ New query**.
3. Open `supabase/setup.sql` from this folder in Notepad. Select all (Ctrl+A), copy, and paste it into the editor.
4. Click **Run** (or press Ctrl+Enter).
   - Supabase may warn that the query "has destructive operations". That's the line that **locks** the tables. Click **Run this query**.
5. You should see **Success. No rows returned**.

You can run the same file again later if it's updated. Your data stays.

## 3. Copy the two keys into `docs/js/config.js`

1. Click the **Connect** button at the top of the project page.
   You can also go to **Project Settings → API Keys**.
2. Copy these two values:
   - **Project URL.** It looks like `https://abcdxyz.supabase.co`.
   - **Publishable key.** It starts with `sb_publishable_…`.
3. Open `docs/js/config.js` and paste them between the quotes:

   ```js
   supabaseUrl: 'https://abcdxyz.supabase.co',
   supabaseKey: 'sb_publishable_xxxxxxxxxxxxxxxx',
   ```

   ⚠️ Use the **publishable** key only. **Never** paste the `sb_secret_…` key (or the old `service_role` key). Anything in this repo is public.

4. In **GitHub Desktop**: write a summary like "connect real database", then **Commit to main** → **Push origin**.

## 4. Become the first admin

1. Wait about 1 minute for GitHub Pages to update.
2. On your phone, open https://drugdiscolabmb.github.io/Drugdisco-MB-Check-in/app/ and pull down to refresh.
3. Because the database is empty, you'll see **set up the lab board**. Fill in your name, nickname, initials, position, avatar and PIN.
4. Tap **create admin**. You're now an active admin. This screen never shows again.
5. Lab members can now tap **+ sign up**. You approve them in **⚙ admin → requests**.

The DEMO tag disappears once the real database is in use.

---

## Good to know

- **Why is the publishable key safe to share?** The tables are locked. The website can only call the functions in `setup.sql`, and every change checks the member's PIN, or the admin login, inside the database. PINs are stored as bcrypt hashes, never as plain text.
- **Wrong PINs:** 5 wrong tries lock that member for 30 seconds.
- **Forgot to check out?** Anyone still IN after midnight (Bangkok time) is checked out automatically at 23:59:59.
- **Free plan pause:** Supabase pauses free projects after about a week with no activity. The wall screen polls the database every 10 seconds, so it stays awake while the wall is on. If it ever pauses, log in to supabase.com and click **Restore project**.
- **Try the demo again:** add `?demo` to the address, e.g. `.../app/?demo`. Demo data stays in that browser only.
- **See the raw data:** in Supabase, use **Table Editor** → `members`, `events` or `status`. You can view and export it as CSV. Please don't edit `pin_hash` by hand. To reset a PIN, use the app's admin panel.
