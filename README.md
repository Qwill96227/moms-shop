# Mom's — online store

A small, production-ready shop for custom T-shirts, mugs, water bottles and accessories.
Customers browse and pay by card on their phone; Mom runs everything from a simple dashboard at `/admin`.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Postgres + Drizzle ORM · Stripe Checkout · Vercel

---

## Run it on your computer

```bash
npm install
cp .env.example .env.local     # optional for a first look
npm run dev                    # http://localhost:3000
```

No database setup needed locally: without `DATABASE_URL` the app starts an embedded Postgres in `.data/`, creates the tables and fills in 8 sample products.

To sign in at `/admin`, put these in `.env.local` before the first sign-in:

```
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=at-least-12-characters
ADMIN_NAME=Mom
```

```bash
npm test            # 14 tests: pricing, stock, idempotent payments, auth, rate limits
npm run typecheck
```

---

## Go live (about 30 minutes)

1. **GitHub.** Create a private repo and push this folder.
2. **Database.** Create a free Postgres at [neon.tech](https://neon.tech). Copy the **pooled** connection string.
3. **Vercel.** Import the repo at [vercel.com/new](https://vercel.com/new). Before deploying, add the environment variables from `.env.example`:
   - `DATABASE_URL` (from Neon)
   - `SESSION_SECRET` (run `openssl rand -base64 48`)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` for Mom's account
   - `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`
4. **Photo storage.** In the Vercel project: Storage → Create → Blob. This adds `BLOB_READ_WRITE_TOKEN` for you.
5. **Deploy.** Vercel runs migrations (`vercel-build`) then builds. Optionally load the sample catalog once: `DATABASE_URL=... npm run db:seed`.
6. **Stripe.** Create an account at [stripe.com](https://dashboard.stripe.com) in Mom's name with her bank account.
   - Developers → API keys → copy the secret key into `STRIPE_SECRET_KEY`.
   - Developers → Webhooks → Add endpoint `https://YOUR-DOMAIN/api/webhooks/stripe` with events
     `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`,
     `checkout.session.async_payment_failed`, `charge.dispute.created`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   - Redeploy. Test with card `4242 4242 4242 4242` in test mode, then switch to live keys.
7. **Recommended extras**
   - [Upstash Redis](https://upstash.com) (free) → `UPSTASH_REDIS_REST_URL/TOKEN` so rate limits are shared across servers.
   - [Resend](https://resend.com) → `RESEND_API_KEY` + `ORDER_NOTIFY_EMAIL` so Mom gets an email for every order and customers get "your order shipped" emails.
   - A Slack/Discord webhook → `ALERT_WEBHOOK_URL` for new orders, low stock, errors and disputes.
   - [UptimeRobot](https://uptimerobot.com) or Better Stack pinging `https://YOUR-DOMAIN/api/health` every 5 minutes.
   - A custom domain in Vercel → Settings → Domains.

---

## What Mom can do at `/admin`

- **Today:** orders waiting to be packed, sales for the last 30 days, items running low.
- **Orders:** see what to make, the shipping address and the customer's notes (names, colors, dates). Mark shipped with a tracking number, which emails the customer.
- **Products:** add photos straight from her phone (auto-resized), set price, sizes/colors with their own stock and price, hide items, feature them on the home page.
- **Categories:** add new kinds of products as the shop grows.

Roles: `owner` can do everything; `helper` can only see and ship orders. Add a helper with
`npm run admin:create -- name@example.com "Name" helper`.

Refunds are done in the Stripe dashboard (Payments → the payment → Refund), then mark the order canceled.

---

## How it's built, layer by layer

| Layer | Where | What it does |
|---|---|---|
| **System design** | below | Browser → Next.js on Vercel's edge/CDN → serverless functions → Postgres; Stripe hosts payment |
| **System architecture** | `src/app`, `src/lib` | Server components read the catalog; API routes handle checkout, webhooks, uploads; server actions handle admin edits |
| **Frontend** | `src/app/(store)`, `src/components` | Mobile-first storefront, cart in local storage, accessible (skip link, focus rings, reduced motion, readable type) |
| **APIs & backend logic** | `src/lib/checkout.ts`, `src/lib/fulfillment.ts` | Server-side pricing, pending → paid order flow, stock decrement that can't go negative |
| **Databases & storage** | `src/lib/db/schema.ts`, `drizzle/` | Postgres tables for categories, products, variants, orders, order items, admins; versioned migrations; photos in Vercel Blob |
| **Auth & permissions** | `src/lib/auth.ts` | bcrypt passwords, signed httpOnly session cookie, owner/helper roles checked on every page and action |
| **Hosting & cloud** | Vercel + Neon | Serverless, scales to zero, pooled DB connections |
| **CI/CD & version control** | `.github/workflows/ci.yml`, `dependabot.yml` | Typecheck, tests, build, migration drift check and dependency audit on every push; Vercel previews per PR, production on `main` |
| **Security** | `next.config.ts`, everywhere | CSP, HSTS, no framing; Zod validation; Stripe webhook signature check; prices never trusted from the browser; uploads checked by file bytes; card data never touches this server |
| **Rate limiting** | `src/lib/rate-limit.ts` | Checkout 10/min, login 5 per 15 min, uploads 30/min; Upstash Redis in production, in-memory fallback |
| **Caching & CDN** | page `revalidate`, `next.config.ts` | Store pages cached at the CDN and refreshed every 5 min or right after Mom saves a change or an order changes stock; images optimized and cached for a year |
| **Error tracking & logs** | `src/lib/logger.ts`, `src/instrumentation.ts` | Structured JSON logs (passwords and emails redacted); every unhandled server error is logged and alerted |
| **Monitoring & alerts** | `src/lib/alerts.ts`, `/api/health` | Health check for uptime monitors; alerts for new orders, low stock, oversells, disputes and webhook failures |
| **Testing** | `tests/` | Vitest against a real in-memory Postgres: pricing, shipping, oversell handling, duplicate webhook delivery, sessions, rate limits |
| **Scaling** | design | Stateless servers, CDN-cached pages, pooled DB, shared rate limits, idempotent payment handling; nothing to change until thousands of orders a day |

### Order flow

```
Customer bag ──POST /api/checkout──▶ price from DB, check stock
                                      create order (pending)
                                      create Stripe Checkout session ──▶ Stripe-hosted payment page
Stripe ──POST /api/webhooks/stripe──▶ verify signature
                                      pending → paid (once, even if Stripe retries)
                                      take stock; oversold → "needs attention"
                                      email/alert Mom, refresh cached pages
Mom ── /admin/orders ──▶ pack → mark shipped (+ tracking) → customer emailed
```

---

## Making it hers

- **Name, tagline, story, shipping rates:** `src/lib/site.ts` (or the `NEXT_PUBLIC_*` env vars).
- **Her photo:** add `public/maker.jpg` and change `maker.photo` in `src/lib/site.ts`.
- **Product photos:** replace the sample artwork by editing each product in the dashboard.
- **Colors and fonts:** the tokens at the top of `src/app/globals.css`.

### Design notes

The look comes from quilting: blocks of marigold, okra green, hibiscus and indigo, with a running stitch around each piece. It's warm and colorful and rooted in a handmade, family tradition without leaning on clichés like kente borders or clip-art motifs. Body text uses Atkinson Hyperlegible, designed for readability on small screens; headings use Bricolage Grotesque.

### Changing the database

Edit `src/lib/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`. Vercel applies it on the next deploy.
