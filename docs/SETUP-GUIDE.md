# Goat Practice Scheduler — Complete Setup Guide
### Everything you do, step by step. Nothing skipped.

---

## OVERVIEW — What You're Setting Up

| Service | Cost | What it does |
|---|---|---|
| Namecheap | ~$12/year | Your domain: bookgoatpractice.com |
| GitHub | Free | Stores your app code |
| Vercel | Free | Hosts the app on the internet |
| Twilio | ~$1/month + pennies per SMS | Sends text reminders |

Total cost: about $14/year + a few dollars in SMS.

---

## PART 1 — BUY YOUR DOMAIN ON NAMECHEAP

**Go to:** https://www.namecheap.com

1. Search for `bookgoatpractice.com` in the search bar
2. Click **Add to Cart**
3. Checkout — you should see it for about $8–13 for the first year
4. Create an account or log in
5. Complete purchase

✅ **Done when:** You see "bookgoatpractice.com" in your Namecheap dashboard under "Domain List"

> **Don't do anything else in Namecheap yet** — we'll come back to point it at Vercel later.

---

## PART 2 — PUT THE CODE ON GITHUB

**Go to:** https://github.com — log in with mimi.mila@gmail.com

### Step 2a — Create a new repository

1. Click the **+** button in the top right corner
2. Click **New repository**
3. Name it: `goat-practice-scheduler`
4. Make sure it's set to **Public**
5. Do NOT check any boxes (no README, no .gitignore)
6. Click **Create repository**

### Step 2b — Upload the files

1. On the empty repo page, click **uploading an existing file** (it's a link in the middle of the page)
2. You'll see a drag-and-drop area
3. Open the folder Claude gave you (goat-practice-scheduler)
4. Drag ALL files and folders into the GitHub upload area
   - src/ folder (with all 4 .jsx and .js files)
   - docs/ folder
   - index.html
   - package.json
   - vite.config.js
   - .env.example
5. Scroll down, type a commit message: `Initial upload`
6. Click **Commit changes**

✅ **Done when:** You can see all your files listed in the GitHub repo

---

## PART 3 — DEPLOY TO VERCEL

**Go to:** https://vercel.com

1. Click **Sign Up** (top right)
2. Choose **Continue with GitHub**
3. Authorize Vercel to access your GitHub
4. You'll land on the Vercel dashboard

### Import your project

1. Click **Add New → Project**
2. Find `goat-practice-scheduler` in the list and click **Import**
3. Vercel will detect it's a Vite/React app automatically
4. Under **Environment Variables**, click **Add** and enter:
   - Name: `VITE_ADMIN_PASSWORD` → Value: `Goat$2026`
   - Name: `VITE_TWILIO_WEBHOOK` → Value: (leave blank for now — we'll add this in Part 4)
5. Click **Deploy**
6. Wait about 60 seconds — you'll see a confetti screen when it's done
7. Vercel gives you a URL like `goat-practice-scheduler.vercel.app` — your app is live!

✅ **Test it:** Click the URL and make sure you can see the scheduler

---

## PART 4 — CONNECT YOUR DOMAIN

### Step 4a — Add domain in Vercel

1. In Vercel, click on your project
2. Go to **Settings → Domains**
3. Type `bookgoatpractice.com` and click **Add**
4. Also add `www.bookgoatpractice.com` and click **Add**
5. Vercel will show you two values — **write these down:**
   - An **A record** — looks like: `76.76.21.21`
   - A **CNAME value** — looks like: `cname.vercel-dns.com`

### Step 4b — Point Namecheap at Vercel

**Go to:** https://www.namecheap.com → Domain List → click **Manage** next to bookgoatpractice.com

1. Click the **Advanced DNS** tab
2. Delete any existing A Record or CNAME records (there may be default ones)
3. Click **Add New Record** and add:

   **Record 1:**
   - Type: `A Record`
   - Host: `@`
   - Value: `76.76.21.21` (the IP Vercel gave you)
   - TTL: Automatic

   **Record 2:**
   - Type: `CNAME Record`
   - Host: `www`
   - Value: `cname.vercel-dns.com` (the value Vercel gave you)
   - TTL: Automatic

4. Click the checkmark to save each one
5. Wait 10–30 minutes for DNS to update

✅ **Done when:** `bookgoatpractice.com` loads your scheduler in a browser

---

## PART 5 — SET UP TWILIO (SMS)

**Go to:** https://www.twilio.com

### Step 5a — Create your account

1. Sign up for a free account
2. Verify your phone number
3. When asked "What do you want to do?" → choose **Send SMS messages**
4. Complete the setup wizard

### Step 5b — Buy a phone number

1. In the Twilio Console, go to **Phone Numbers → Manage → Buy a Number**
2. Search for a number with your area code (760 if you want)
3. Make sure **SMS** capability is checked
4. Click **Buy** — costs about $1/month
5. Write down your new Twilio phone number

### Step 5c — Create the Function

1. In Twilio Console, go to **Explore Products → Developer Tools → Functions & Assets**
2. Click **Services → Create Service**
3. Name it: `goat-practice-notifications`
4. Click **Add Function** → name it `/notify`
5. Delete all the default code in the editor
6. Open the file `docs/twilio-function.js` (from the project Claude gave you)
7. Copy ALL of that code and paste it into the Twilio editor
8. Click **Save**

### Step 5d — Set environment variables in Twilio

Still in the Functions editor:

1. Click **Environment Variables** in the left sidebar
2. Add these variables:

   | Key | Value |
   |---|---|
   | TWILIO_PHONE_NUMBER | Your new Twilio number (e.g. +17601234567) |
   | COACH_MIMI_PHONE | 7609125441 |
   | COACH_DAWNA_PHONE | (add Dawna's number when you have it) |

3. Click **Save**

### Step 5e — Deploy and get your webhook URL

1. Click **Deploy All** (top right of the Functions editor)
2. Wait for deployment to finish (about 30 seconds)
3. Click on your `/notify` function
4. Copy the URL shown at the top — it looks like:
   `https://goat-practice-notifications-XXXX.twil.io/notify`
5. **Go back to Vercel:**
   - Open your project → Settings → Environment Variables
   - Edit `VITE_TWILIO_WEBHOOK`
   - Paste in that URL
   - Click **Save**
6. Vercel will redeploy automatically (takes ~60 seconds)

✅ **Test it:** Book a slot in your scheduler and you should receive a text!

---

## PART 6 — SET UP REMINDER SCHEDULING

The day-before and 1-hour reminders need to fire automatically. Here's how to do that with Twilio's built-in scheduler.

> **Note:** Twilio Messaging Schedules is the easiest way. You'll set this up once and it fires automatically for every new booking.

### How it works:
When someone books, your app sends the booking info to your Twilio Function. The Function sends the immediate confirmation. For timed reminders, you'll use **Twilio Studio** (free, no code).

### Step 6a — Create a Studio Flow for reminders

1. In Twilio Console → **Studio → Flows → Create new Flow**
2. Name it: `Goat Practice Reminders`
3. Choose **Start from scratch**
4. In the flow editor, add:
   - **Trigger:** HTTP Request (this gets called when someone books)
   - **Send Message widget:** `{{ flow.data.reminder_day_before_body }}`
   - **Wait widget:** set to 23 hours
   - **Send Message widget:** `{{ flow.data.reminder_one_hour_body }}`
5. Publish the flow
6. Copy the Flow's webhook URL from the Trigger widget

> **Need help with Studio?** Just come back and tell Claude "I'm ready to set up Studio reminders" and I'll walk through it with exact screenshots described step by step.

---

## PART 7 — ADD DAWNA'S PHONE NUMBER

When you have Dawna's number:

1. Go to: https://console.twilio.com → Functions → goat-practice-notifications → Environment Variables
2. Update `COACH_DAWNA_PHONE` with her 10-digit number
3. Click Save → Deploy All

That's it — she'll start getting booking notifications immediately.

---

## QUICK REFERENCE — URLs TO BOOKMARK

| What | URL |
|---|---|
| Your scheduler (public) | https://bookgoatpractice.com |
| Your app on Vercel | https://vercel.com/dashboard |
| Your GitHub repo | https://github.com/mimi.mila/goat-practice-scheduler |
| Twilio Console | https://console.twilio.com |
| Namecheap | https://www.namecheap.com |

---

## COACH DASHBOARD

- Go to `bookgoatpractice.com`
- Tap **Coach View** (top right tab)
- Enter password: `Goat$2026`
- You'll see:
  - Total bookings across all 10 days
  - Full roster for each day (name + phone number)
  - **Block Day** button — use this for bad weather, travel, or any day off
  - **Remove** button next to any booking to manually clear a slot

---

## TROUBLESHOOTING

**"My domain isn't working yet"**
→ DNS takes up to 30 minutes. Wait and try again.

**"I'm not getting texts"**
→ Check that VITE_TWILIO_WEBHOOK is set in Vercel. Make sure you deployed after adding it.

**"The Coach View password isn't working"**
→ Check that VITE_ADMIN_PASSWORD is set correctly in Vercel's Environment Variables.

**"I need to change the password"**
→ Go to Vercel → Settings → Environment Variables → edit VITE_ADMIN_PASSWORD → Save. Vercel redeploys automatically.

---

## NEED TO MAKE CHANGES TO THE APP?

Just come back to Claude and say what you want changed. Claude will update the code and tell you exactly which files to re-upload to GitHub. Vercel picks up the change automatically once GitHub is updated.
