# Kinolhas School Stock Inventory — standalone version

This is the exported, self-hosted version of the portal, using your Google
Sheet as the live backend instead of Claude's built-in storage. Follow these
steps in order.

## Part 1 — Set up the Google Sheet backend

1. Open the Google Sheet you already use for stock (the one with `IN`,
   `OUT`, `Inventory Control`, etc.).
2. Go to **Extensions > Apps Script**.
3. Delete any starter code in the editor, then paste in the entire contents
   of `apps-script/Code.gs` from this package.
4. Save the project (any name is fine, e.g. "Stock API").
5. In the function dropdown at the top, select **seedItemsIfEmpty**, then
   click **Run** (▶). The first time, Google will ask you to authorize the
   script — click through and allow it (you'll see an "unverified app"
   warning since this is your own script; click **Advanced > Go to
   project (unsafe)** to proceed — this is expected for personal scripts).
6. Check your Sheet — you should now see two new tabs: `App_Items` (241
   items pre-loaded) and `App_StockLog` (empty, ready for records).
7. Click **Deploy > New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize again if asked.
8. Copy the **Web app URL** it gives you (looks like
   `https://script.google.com/macros/s/AKfycb.../exec`). You'll need this
   in Part 2.

**Important:** this URL is the actual door into your data. Anyone who has
it can read/write stock data directly, bypassing the portal's own login
screen. Don't post it publicly — treat it like a password.

## Part 2 — Configure and build the app

1. Open `src/App.jsx` in this package and find this line near the top:
   ```js
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```
   Replace the placeholder with the Web app URL you copied in step 8 above.

2. Install Node.js if you don't have it (https://nodejs.org — the LTS
   version). Then, in a terminal, inside this project folder:
   ```bash
   npm install
   npm run build
   ```
   This creates a `dist/` folder — that's your finished, deployable website.

3. To test it locally first (optional but recommended):
   ```bash
   npm run dev
   ```
   Open the URL it prints (usually `http://localhost:5173`) and confirm
   the portal loads your real stock data and that taking out stock updates
   the Google Sheet.

## Part 3 — Host it for free

Any of these work well for a small internal tool. Pick one:

### Option A: Netlify (easiest, drag-and-drop)
1. Go to https://app.netlify.com and sign up (free).
2. Drag the `dist/` folder onto the Netlify dashboard.
3. It gives you a live URL immediately (e.g. `random-name.netlify.app`).
4. You can rename the subdomain, or connect a custom domain later, from
   Site settings.

### Option B: Vercel
1. Go to https://vercel.com and sign up (free).
2. Install the Vercel CLI (`npm i -g vercel`), then run `vercel` inside
   this project folder and follow the prompts.
3. It deploys and gives you a live URL.

### Option C: GitHub Pages
1. Push this project to a GitHub repository.
2. In the repo, go to Settings > Pages, and point it at the `dist/`
   folder (or use a GitHub Action to build and deploy automatically).
3. Your site is live at `https://yourusername.github.io/reponame`.

## Adding a custom domain later

All three hosts above support connecting your own domain (e.g.
`stock.kinolhasschool.mv`) for free — you'd need to own that domain
separately and point its DNS at the host, following that host's specific
"custom domain" instructions.

## What changed from the Claude version

- Data now lives in your Google Sheet (`App_Items` and `App_StockLog`
  tabs) instead of Claude's built-in storage — this is what makes it
  work outside of Claude.
- The "Sync new items" button is now "Refresh from sheet" — it re-fetches
  live data, so if you edit the sheet directly, click that button (or
  reload the page) to see the changes reflected in the portal.
- Everything else — login, admin PIN, low-stock alerts, CSV export,
  multi-item stock-out — works exactly as it did before.

## A note on security

The in-app login screen and admin PIN are a soft barrier suitable for
keeping casual/accidental use out among staff who already have access to
your school systems. They are not real authentication — anyone with the
Apps Script URL can call it directly, and anyone who reads the deployed
website's source code can see the PINs. For a small internal school tool
this is a reasonable tradeoff, but don't treat it as securing sensitive
data.
