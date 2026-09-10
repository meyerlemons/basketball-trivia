# NBA Trivia Challenge — Setup Guide

This is a plain HTML/CSS/JS website — no server, no database, no monthly cost.
There are three things you can edit any time you want: **questions.csv**,
**players.csv**, and (once) the email settings in **app.js**.

## What's in the folder

```
index.html      the page structure
style.css       the look and feel (no need to touch this)
app.js          the quiz logic (you'll edit 3 lines, once)
questions.csv   your trivia questions — edit this whenever you want
players.csv     the master list of player names for autocomplete
README.md       this file
```

## 1. Edit your questions

Open `questions.csv` in Excel, Google Sheets, or any text editor. Each row is
one question with three columns:

| question | answer | hint |
|---|---|---|
| Who is the NBA's all-time leading scorer? | LeBron James\|LeBron | He passed Kareem in 2023. |

- **answer** — if you want to accept more than one spelling/nickname, separate
  them with a pipe `|`, e.g. `Stephen Curry|Steph Curry|Steph`. Answers are
  checked without worrying about capitalization or extra spaces.
- **hint** — optional. Leave it blank and the app will auto-generate one
  (it masks the answer, showing only the first letter of each word, e.g.
  `L_____ J_____`).

Add as many rows as you like, whenever you like (weekly, monthly, whatever).
Just save the file as **questions.csv** (if you edit in Excel/Sheets, make
sure you export/save as "CSV", not .xlsx).

## 2. Edit your player list

Open `players.csv` — it's one player name per line, with `player` as the
header on the first row. This list powers the autocomplete dropdown as your
nephew types. It doesn't need to match your questions exactly — bigger is
fine, since it's just there to help him type faster.

## 3. Set up free email sending (one-time, ~10 minutes)

The site emails you and dad automatically when your nephew finishes. Since
this is a static site with no server, it uses **EmailJS**, a free service
that sends email directly from the page (free tier: 200 emails/month, way
more than you'll need).

1. Go to https://www.emailjs.com and sign up for a free account.
2. **Add an email service**: in the dashboard, click "Email Services" →
   "Add New Service" → choose Gmail (or whatever you use) → connect your
   account. Note the **Service ID** it gives you.
3. **Create a template**: click "Email Templates" → "Create New Template".
   - Set the **To email** field to both addresses, separated by a comma,
     e.g. `you@gmail.com, dad@gmail.com`.
   - Set a subject, e.g. `{{player_name}}'s NBA Trivia Score: {{score}}/{{total}}`.
   - In the body, use these variables (click to insert, or type them):
     `{{player_name}}`, `{{score}}`, `{{total}}`, and `{{summary}}` (this one
     contains the full question-by-question breakdown — put it on its own
     line and it will keep its line breaks).
   - Save it and note the **Template ID**.
4. **Get your Public Key**: click "Account" → "General" and copy the
   **Public Key**.
5. Open `app.js` in a text editor and fill in the top of the file:
   ```js
   const CONFIG = {
     EMAILJS_PUBLIC_KEY: "paste your public key here",
     EMAILJS_SERVICE_ID: "paste your service ID here",
     EMAILJS_TEMPLATE_ID: "paste your template ID here",
     ...
   };
   ```
6. Save the file.

That's it — no backend, no API keys to protect (EmailJS public keys are
meant to be used client-side).

## 4. Host it for free

Since traffic is basically just the two of you, any free static host works
great. Two easy options:

### Option A: Netlify Drop (easiest, no account needed to start)
1. Go to https://app.netlify.com/drop
2. Drag the whole `nba-trivia` folder onto the page.
3. You'll get a live URL immediately (like `random-name-123.netlify.app`).
4. To update questions later: make a free Netlify account, and re-drag the
   folder to the same site (or connect it to a GitHub repo — see Option B —
   for easier repeat updates).

### Option B: GitHub Pages (best for frequent updates)
1. Create a free GitHub account if you don't have one, and create a new
   repository (e.g. `nba-trivia`).
2. Upload all the files in this folder to the repository (drag-and-drop
   works on github.com — click "Add file" → "Upload files").
3. Go to the repo's **Settings** → **Pages**, and under "Source" choose the
   `main` branch and `/ (root)` folder, then save.
4. GitHub gives you a URL like `https://yourusername.github.io/nba-trivia/`.
5. **To update questions later**: on github.com, open `questions.csv` in the
   repo, click the pencil (edit) icon, make your changes, and commit. The
   live site updates automatically within a minute or two — no re-uploading
   needed.

Either way, hosting costs $0/month at this traffic level.

## How the scoring works

- Correct on the first try: **1 point**
- Used the hint, then correct: **0.5 points**
- Skipped: **0 points**
- Wrong answers can be retried as many times as needed (no penalty) — the
  only ways to move on are a correct answer or Skip.

## Notes

- Everything runs in the browser; nothing is saved between sessions, so
  refreshing mid-quiz restarts it. For two family members playing
  occasionally, that's simplest — but let me know if you'd ever want it to
  save progress or keep a running history of scores, and I can add that.
- If email sending ever breaks (e.g. you hit EmailJS's free monthly limit,
  which is very unlikely at this volume), the quiz still works fine and the
  results screen will just say it couldn't send.
