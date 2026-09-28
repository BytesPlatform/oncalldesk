# OnCallDesk

**Every no-heat call booked, even at 2 a.m.** An AI receptionist for heating, cooling and home services contractors, sold as a standalone product by Bytes Platform.

Live: https://oncalldesk.vercel.app

It answers every call, triages the emergency by the contractor's own rules, checks the service area, finds or sets up the customer, books the job into open arrival windows, pages the on-call technician when it genuinely should, and texts the caller a confirmation.

## What is in this repository

Everything lives in `demo/` (the folder name is historical; it is the whole product).

| Path | What it is |
|---|---|
| `/` | The marketing site: home with a recorded call, how it works, pricing, integrations, handover rules, security, privacy, terms, Book a demo |
| `/demo` | The public live demo. Anyone can call the assistant from the browser and watch the dashboard fill in. Answers as Northline Heating and Cooling, a fictional Chicago-area contractor. |
| `/app` | The product. Invite-only sign-in through Clerk; each customer sees only their own workspace |
| `/admin` | Our console: create customers, send invitations, open any workspace, demo requests, job log |
| `/api/retell/*` | Retell webhooks, signed, routed to the workspace that owns the agent |
| `/api/leads`, `/api/jobs/run`, `/api/sendgrid/events` | The Book a demo form, the scheduled worker, SendGrid delivery events |
| `demo/lib/product.ts` | Every word of site and email copy, the accent, the plans. The one file that makes this product this product |
| `demo/lib/config.ts`, `demo/lib/tools.ts`, `demo/retell/` | The assistant itself: rules, the tools it can call, the conversation flow |
| `demo/emails/` | React Email templates |
| `demo/docs/auth-setup.md` | Clerk and admin console setup |
| `PLAN.md`, `SHARED.md` | The original build plan, and the register of files shared with the sister products |

The three products (OnCallDesk, MolarLine, FirstIntake) are separate repositories, Vercel projects and databases by decision. Shared features are copied file for file and listed in `SHARED.md`.

## Running it locally

```bash
cd demo
cp .env.example .env.local     # see the comments in the file
npm install
npm run dev                    # http://localhost:3000
npm test                       # smoke test on an embedded database, no accounts needed
```

With no environment at all the site, the demo dashboard and the console all run on an embedded Postgres. Voice needs `RETELL_API_KEY`, `NEXT_PUBLIC_RETELL_PUBLIC_KEY` and `NEXT_PUBLIC_RETELL_AGENT_ID`. Sign-in needs the Clerk keys and `PLATFORM_ADMIN_EMAILS`, or `AUTH_DEV_USER` for local work. Email stays in preview mode until `SENDGRID_API_KEY` and a verified `SENDGRID_FROM_EMAIL` exist. Product-specific: DEMO_TECHNICIAN_NUMBER (your mobile, for the on-call page), JOBBER_* (optional), TWILIO_* (optional, SMS preview otherwise).

## Deploying

Vercel project `oncalldesk`, root directory `demo`, environment from `.env.example`. The database is Neon (`DATABASE_URL`, pooled string); the schema creates and migrates itself on the first request. The Retell agent is `agent_19b3dc76a9c3731e4c2059637f`; after any change to `retell/demo-flow.json` or `retell/demo-agent.json`:

```bash
RETELL_API_KEY=key_... DEMO_HOST=oncalldesk.vercel.app npm run push:retell
```

The worker runs from Vercel Cron every five minutes with `CRON_SECRET`. One SendGrid event webhook serves all three products; see the comment in `demo/app/api/sendgrid/events/route.ts`.

## Where the build is

Done: tenancy and invite-only sign-in (phase 0), the marketing site, demo requests, email and the worker (phase 1). Next: onboarding inside the product with agent and number provisioning (phase 2), then the simplified dashboard, messaging and usage. The phase list and estimates are in the product plan kept alongside the three repositories.

The recorded call on the site is synthetic (two neural voices) and will be replaced by a real call to this agent once phone numbers exist. The demo business, its staff and its customers are invented.
