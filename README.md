# Renta – Kigali household bills

A small web app for keeping track of the bills a Kigali household pays every month:

| Bill | Kinyarwanda | How it's tracked |
|---|---|---|
| 🏠 Rent | Ubukode | Fixed monthly amount and due day |
| 💧 Water (WASAC) | Amazi | Amount varies – enter each month's bill (and m³ if you like) |
| ⚡ Electricity (REG Cash Power) | Amashanyarazi | Prepaid – log token purchases (amount, kWh, token number) against a monthly budget |
| 🛡️ Security | Umutekano | Fixed monthly amount and due day |
| 🧹 Sanitation | Isuku | Fixed monthly amount and due day |

You can add other bills too, change any type, or turn off a bill you don't pay (e.g. water included in rent).

## Features

- **Monthly overview** – what's still to pay, what's paid, total spent, and overdue / due-soon alerts.
- **Partial and multi-month payments** – pay rent in instalments, or pay 3 months at once.
- **Arrears** – unpaid amounts from earlier months are carried forward and shown until settled.
- **Rent increases** – a new amount applies from the month you choose; earlier months keep the old amount.
- **Cash Power log** – kWh bought, average RWF/kWh, last token, budget warnings.
- **History** – filter by category/year, search references and tokens, export to CSV.
- **Receipts** – share a text receipt (e.g. to your landlord on WhatsApp) or copy it.
- **Private & offline** – data stays in your browser (no account, no server). Installable on your phone.
- **Backup / restore** – download a JSON backup and restore it on another device.
- Light and dark mode, works on phones.

> Data lives only in the browser you use. Download a backup from **Settings** now and then.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for the bill logic
npm run build    # production build in dist/
```

## Put it online (free)

The repo includes a GitHub Actions workflow that publishes the app to GitHub Pages
whenever `main` is updated. In the repository on GitHub go to **Settings → Pages** and set
**Source** to **GitHub Actions**. The app will be at `https://<your-user>.github.io/<repo>/`.
Open that on your phone and choose **Add to Home screen** to install it.
