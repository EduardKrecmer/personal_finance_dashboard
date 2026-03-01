# FIDU — Financial Dashboard

Osobny financny dashboard na sledovanie majetku, dlhov, vydavkov a cisteho imania.

**Live:** [https://financial-dashboard-71b17.web.app](https://financial-dashboard-71b17.web.app)

## Funkcie

- **Prehľad čistého imania** — aktíva, záväzky, plánované výdavky, NW trend graf
- **Správa účtov** — kategórie (hotovosť, investície, nehnuteľnosti, dlhy...), poznámky, drag & drop poradie
- **Crypto portfólio** — pridanie coinov cez CoinGecko API, live ceny, profit/loss
- **ETF / Akcie** — sledovanie portfólia s aktuálnymi cenami
- **Plánované výdavky** — kategorizované (bývanie, auto, zdravie, vzdelávanie...)
- **Mesačný cash-flow** — príjmy vs výdavky, prebytok, projekcie (3/6/12 mesiacov)
- **Alerty** — upozornenia pri dosiahnutí NW hraníc
- **História** — automatické snímky NW s denným/týždenným/mesačným prehľadom
- **Export** — PDF report, CSV, PNG screenshot, tlač
- **Dark / Light mode**
- **Mobilná optimalizácia** — plne responzívny design, touch-friendly
- **Market ticker** — BTC, ETH, SPY, zlato, EUR/USD v reálnom čase

## Tech stack

- **Frontend:** React 19 + Vite 7 + Tailwind CSS v4
- **Backend:** Firebase Auth (Google login) + Firestore (per-user data)
- **Hosting:** Firebase Hosting
- **Knižnice:** jsPDF, html-to-image, lucide-react

## Spustenie lokálne

```bash
# Klonovanie
git clone https://github.com/EduardKrecmer/personal_finance_dashboard.git
cd personal_finance_dashboard

# Inštalácia závislostí
npm install

# Nastavenie Firebase (skopíruj .env.example a vyplň)
cp .env.example .env.local

# Spustenie dev servera
npm run dev
```

## Environment premenné

Skopíruj `.env.example` do `.env.local` a vyplň Firebase konfiguráciu:

```
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=...
VITE_FB_PROJECT_ID=...
VITE_FB_STORAGE_BUCKET=...
VITE_FB_MESSAGING_ID=...
VITE_FB_APP_ID=...
```

## Build & Deploy

```bash
# Build
npm run build

# Deploy na Firebase
npx firebase deploy --only hosting
```

## Licencia

MIT
