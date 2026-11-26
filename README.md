# Fagitire – household bills & money for Kigali

*Fagitire* (Kinyarwanda for "bill") keeps track of everything a Kigali household pays – and what's left of the salary afterwards.
Available in **English, Kinyarwanda and French**.

## What it tracks

| Bill | Kinyarwanda | How it's tracked |
|---|---|---|
| 🏠 Rent | Ubukode | Fixed monthly amount, due day, lease details (end date, deposit, landlord contact, next increase) |
| 💧 Water (WASAC) | Amazi | Enter each month's bill; meter readings show daily use and flag sudden jumps (leaks) |
| ⚡ Electricity (REG Cash Power) | Amashanyarazi | Log token purchases (kWh, token); estimates **days of power left** and how much to buy |
| 🛡️ Security | Umutekano | Fixed monthly |
| 🧹 Sanitation | Isuku | Fixed monthly |
| 📶 Internet / Wi-Fi | Interineti | Fixed monthly, renewal day |
| 📺 TV (Canal+, StarTimes, DStv) | Televiziyo | Fixed monthly, renewal day |
| 🔥 Cooking gas | Gaz | Log refills; learns how long a cylinder lasts and warns before it runs out |
| 📱 Airtime & data | Amainite | Top-ups against a monthly budget |
| 🧑‍🍳 House help | Umukozi | Monthly salary; advances are deducted from the balance |
| 🤝 Contributions | Imisanzu / Ubufasha | Tithe, offerings, weddings, funerals – recorded when they happen |

## Features

- **Home** – still to pay, total spent, what's left of your income, arrears; alerts for overdue bills, budgets, power/gas running low, lease ending, rent increases.
- **Paste a MoMo / Airtel SMS** – fills in amount, date, transaction ID and bill; for Cash Power also the token and kWh.
- **Partial, multi-month and advance payments**; arrears carried forward; rent increases from a chosen month.
- **Receipt & bill photos** attached to payments.
- **Money** – income (salary and other), a monthly budget per category with warnings, savings goals with "save X a month" guidance.
- **Reports** – month-on-month changes ("Water up 30%"), averages, year totals, searchable history, CSV export,
  and a **printable yearly statement** (Print → Save as PDF).
- **Calendar reminders** – download all due dates (with alarms) into your phone calendar, or add them to Google Calendar.
- **App lock** – PIN, plus fingerprint/face unlock where the device supports it.
- **Google Drive backup & sync** – your data in your own Drive (hidden app folder); keeps phone and computer in sync.
- **Backup file** export/restore, works offline, installable on your phone, light & dark mode.

> Data lives in your browser (and your own Google Drive if you turn on sync). There is no Fagitire server.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build in dist/
node scripts/extract-strings.mjs --missing rw   # list untranslated Kinyarwanda strings
```

Translations live in `src/i18n/fr.ts` and `src/i18n/rw.ts`, keyed by the English text.

## Put it online (free, GitHub Pages)

The workflow in `.github/workflows/deploy.yml` publishes the app whenever `main` is updated.
In the repository on GitHub go to **Settings → Pages** and set **Source** to **GitHub Actions**.
The app will be at `https://<your-user>.github.io/<repo>/` – open it on your phone and choose **Add to Home screen**.

## Turn on Google Drive sync (one-time, ~10 minutes)

Google requires every app that uses Drive to have its own (free) OAuth client ID:

1. Go to <https://console.cloud.google.com/>, create a project (e.g. "Fagitire").
2. **APIs & Services → Library**: enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your email,
   add the scope `.../auth/drive.appdata`, and add your Google account (and family members') as **test users**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**: type *Web application*.
   Under **Authorized JavaScript origins** add `https://<your-user>.github.io` (and `http://localhost:5173` for testing).
5. Copy the client ID (ends in `.apps.googleusercontent.com`).
6. In the GitHub repository: **Settings → Secrets and variables → Actions → Variables → New variable**,
   name `GOOGLE_CLIENT_ID`, paste the ID, then re-run the deploy workflow.
   (Or paste it in the app under **Settings → Google Drive** on each device.)

The app only asks for access to its own hidden folder in your Drive – it cannot see your other files.
