# Pistonpad

Stock, GST billing and sales reports for a two-wheeler spare parts wholesale shop.
Built to stay fast with **millions of parts**: every page loads in about 20–110 ms, and search takes 20–50 ms, on a catalogue of 10 lakh parts (production build, a laptop).

## What it does

| Area | Features |
|---|---|
| **Billing** (`F2`) | Search by part number or name, or pick the customer's **bike brand + model** to list every part that fits it. Keyboard-first: `↑ ↓ Enter` to add, `F9` to save. Per-line discount, CGST/SGST or IGST (automatic from the customer's GSTIN), round-off, Cash/UPI/Card/Bank/Credit, part payments. |
| **Invoices** | Gap-free numbering per financial year (`INV/26-27/00001`), printable A4 tax invoice with HSN summary and amount in words, WhatsApp share, receive payments, cancel (returns stock). |
| **Parts** | Brand, category, HSN, rack/bin, cost, wholesale rate, MRP, GST rate, reorder level, **fits-models** picker. Filters by brand, model, category, stock level. Full stock history for each part. |
| **Stock in** | Enter a supplier's bill: many parts at once, optional cost-price update. |
| **Customers** | Auto-saved from bills by phone number. Balances, credit limit warnings, bill history. |
| **Reports** (owner) | Sales, GST collected, gross profit and margin, daily chart, payment modes, sales by brand and category, top parts, GST by rate, B2B/B2C. CSV downloads: invoices, item-wise, HSN summary for GSTR-1. |
| **Import** (owner) | Upload a CSV from Excel, or use `npm run import -- file.csv` for millions of rows (about 5,000 rows/s). Missing brands, categories and models are created. |
| **Settings** (owner) | Shop details and GSTIN, invoice prefix, brands, bike models, categories, staff logins. |

Staff logins can bill and manage stock. Only owners see cost prices, profit, reports and settings.

## Tech

- **Next.js 16** (App Router, Server Components, Server Actions), React 19, TypeScript, Tailwind CSS 4
- **PostgreSQL 15+** through [`postgres`](https://github.com/porsager/postgres) with hand-written SQL (no ORM)
- Auth: bcrypt passwords and signed, HTTP-only session cookies (`jose`)

### Why it stays fast with millions of parts

- `products.search` is a generated lowercase `part no + name` column with a **trigram GIN index**, so `like '%word%'` for every typed word uses the index.
- **Keyset pagination** (`id < cursor`) instead of `OFFSET`: page 10,000 is as fast as page 1.
- Bike fitment is a `product_models (model_id, product_id)` table keyed for "all parts for this model".
- A **partial index** keeps reorder lists instant (`where stock <= reorder_level`), and the dashboard caps that count at 10,000+.
- Catalogue size comes from planner statistics instead of `count(*)` over millions of rows.
- Saving a bill is a single transaction: it locks the parts (`FOR UPDATE`), checks stock, numbers the invoice, updates stock in one statement and writes the stock ledger. Two counters can bill at the same time without overselling.
- CSV exports and imports **stream**, so memory stays flat for any file size.

## Run it on your computer

Requires Node.js 20.9+ and PostgreSQL 15+.

```bash
cp .env.example .env.local        # then fill in DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD
npm install
npm run db:setup                  # creates tables, brands, 198 bike models, categories and the owner login
npm run dev                       # http://localhost:3000
```

Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env.local`, then open **Settings** and enter your shop name, address and GSTIN.

### Demo data (optional)

```bash
npm run db:demo                   # 10 lakh demo parts + 90 days of demo sales (takes a few minutes)
npm run db:demo -- 50000          # smaller catalogue
npm run db:demo -- --purge        # remove ALL demo data; your real parts and bills stay
```

Demo rows are flagged `is_demo`, and demo invoices are numbered `DEMO/…`, so they never mix with your real invoice numbers.

## Import your parts

1. In the app: **Import parts → Download template**.
2. Fill it in Excel (one row per part; put the bike models it fits in `models`, separated by `|`, e.g. `Splendor Plus|Passion Pro`).
3. Save as **CSV (Comma delimited)** and upload it. Re-importing the same part numbers updates them; leave `stock` empty to keep current stock.

For very large files, run on the server: `npm run import -- /path/to/parts.csv`.

## Put it online (cloud)

### Option 0: Vercel + Neon (no server to manage)

1. **vercel.com → Add New → Project → Import** this GitHub repo. Keep the detected Next.js settings.
2. In the project: **Storage → Create Database → Neon (Postgres)**, pick the region nearest you (e.g. Mumbai or Singapore) and connect it to the project. This adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` for you.
3. **Settings → Environment Variables:** add `SESSION_SECRET` (a long random string: `openssl rand -base64 32`).
4. **Settings → Functions:** set the function region to the same region as the database. A far-away region makes every page slow.
5. Also add `ADMIN_USERNAME` and `ADMIN_PASSWORD` for your first owner login, then redeploy.
   Every Vercel build runs `scripts/vercel-build.sh`, which applies database migrations and creates
   the brands, models and owner login if they don't exist yet (it never overwrites them).
6. Open the site, sign in, change your password, and fill in **Settings** (shop details, GSTIN, logo).

Notes for Vercel:
- Uploads are limited to about 4.5 MB, so the web importer takes about 30,000 rows per file. For bigger files run `DATABASE_URL_UNPOOLED=… npm run import -- parts.csv` from your computer.
- Neon's free tier holds 0.5 GB, roughly 5–6 lakh parts with their model links. Don't load the 10-lakh demo data there; use a paid plan for millions of real parts.

### Option A: one VPS with Docker (simplest, about ₹500–1,500/month)

Any Linux VPS with 2 GB+ RAM (DigitalOcean, Hetzner, AWS Lightsail, etc.):

```bash
git clone <your repo> pistonpad && cd pistonpad
cp .env.example .env              # set SESSION_SECRET, ADMIN_PASSWORD, POSTGRES_PASSWORD
docker compose up -d --build      # starts PostgreSQL + the app on port 3000; migrations run automatically
docker compose --profile tools run --rm setup   # first time only: brands, models, owner login
```

Put a reverse proxy with HTTPS in front (Caddy is easiest: `your-domain.in { reverse_proxy localhost:3000 }`).

### Option B: managed services

- Database: any managed PostgreSQL (Neon, Supabase, AWS RDS, DigitalOcean Managed DB). It must allow the `pg_trgm` and `citext` extensions (all of these do).
- App: any Node host (Render, Railway, a VPS). Build with `npm run build`, start with `node scripts/migrate.mjs && node .next/standalone/server.js` (copy `.next/static` into `.next/standalone/.next/static` first; see the Dockerfile).
- Run `npm run db:setup` once from your computer with `DATABASE_URL` pointing at the cloud database.

### Backups (do this before going live)

Managed databases include daily backups. On a VPS, add a nightly dump:

```bash
# crontab -e
30 2 * * * docker compose -f /path/to/pistonpad/docker-compose.yml exec -T db pg_dump -U spares -Fc spares > /backups/spares-$(date +\%F).dump
```

Copy the dumps off the server (for example to Google Drive or S3) and test a restore once.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm run db:migrate` | Apply new database migrations |
| `npm run db:seed` | Add brands, models, categories and the first owner login |
| `npm run import -- file.csv` | Bulk-import parts |
| `npm run typecheck` / `npm run lint` | Checks |

## Project layout

```
db/migrations/        SQL schema (applied in order by scripts/migrate.mjs)
db/catalog-data.ts    Starting brands, bike models and categories
scripts/              migrate, seed, demo data and CSV import CLIs
src/proxy.ts          Redirects signed-out visitors to /login
src/lib/              database, auth, search, billing maths, invoices, reports, importer
src/app/(app)/        Screens: dashboard, billing, invoices, parts, stock-in, customers, reports, settings, import
src/app/api/          Search, catalogue, CSV export/import, health check
src/components/       UI kit, sidebar, part picker, charts
```
