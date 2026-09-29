/**
 * Demo database schema.
 *
 * The demo_* tables stand in for Jobber when the mock gateway is active. The
 * call_events, pipeline_events and outbound_messages tables are ours either
 * way, because the contractor wants a record of what the agent did regardless
 * of where the job landed.
 *
 * Every table carries tenant_id. The demo tenant owns the public page; each
 * customer created from the admin console owns its own rows. See lib/tenancy.ts.
 *
 * Kept as a TypeScript string so it bundles into serverless functions with no
 * file system access at runtime. Every statement is idempotent and the
 * "alter table add column if not exists" lines migrate a database that was
 * created before tenancy in place.
 */

export const SCHEMA_SQL = `
-- ---------- tenancy ----------
-- One row per customer. The demo tenant is created at bootstrap and backs
-- the public page; every other row is created from the admin console.

create table if not exists tenants (
  id               text primary key,
  name             text not null,
  short_name       text not null,
  tagline          text,
  main_number      text,
  timezone         text not null default 'America/Chicago',
  plan             text not null default 'trial',
  included_minutes integer not null default 0,
  status           text not null default 'invited',   -- invited, active, suspended
  retell_agent_id  text,
  phone_number     text,
  config           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists tenants_agent on tenants (retell_agent_id) where retell_agent_id is not null;

create table if not exists memberships (
  id                  bigserial primary key,
  tenant_id           text not null references tenants (id) on delete cascade,
  email               text not null,
  name                text,
  role                text not null default 'owner',     -- owner, staff
  clerk_user_id       text,
  clerk_invitation_id text,
  invite_status       text not null default 'pending',   -- pending, sent, accepted, failed
  invite_error        text,
  invited_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  unique (tenant_id, email)
);
create index if not exists memberships_user on memberships (clerk_user_id);

-- ---------- stand-in for Jobber ----------

create table if not exists demo_clients (
  id               text primary key,
  tenant_id        text not null default 'demo',
  first_name       text not null,
  last_name        text not null,
  phone            text not null,
  email            text,
  property_id      text not null,
  street1          text not null,
  city             text not null,
  province         text not null default 'IL',
  postal_code      text not null,
  created_by_agent boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists demo_clients_phone on demo_clients (phone);

create table if not exists demo_jobs (
  id               text primary key,
  tenant_id        text not null default 'demo',
  client_id        text not null,
  property_id      text not null,
  title            text not null,
  instructions     text,
  job_type_id      text not null,
  urgency          text not null,
  created_by_agent boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists demo_visits (
  id               text primary key,
  tenant_id        text not null default 'demo',
  job_id           text not null,
  client_id        text not null,
  technician_id    text not null,
  title            text not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  urgency          text not null default 'routine',
  status           text not null default 'scheduled',
  created_by_agent boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists demo_visits_starts_at on demo_visits (starts_at);

create table if not exists demo_requests (
  id         text primary key,
  tenant_id        text not null default 'demo',
  client_id  text not null,
  property_id text not null,
  title      text not null,
  details    text,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists demo_notes (
  id         bigserial primary key,
  tenant_id        text not null default 'demo',
  client_id  text not null,
  message    text not null,
  created_at timestamptz not null default now()
);

-- ---------- ours, regardless of where the job lands ----------

create table if not exists call_events (
  id            bigserial primary key,
  tenant_id        text not null default 'demo',
  occurred_at   timestamptz not null default now(),
  call_id       text not null,
  action        text not null,
  outcome       text not null,
  urgency       text,
  detail        jsonb
);
create index if not exists call_events_call_id on call_events (call_id);

create table if not exists pipeline_events (
  id          bigserial primary key,
  tenant_id        text not null default 'demo',
  occurred_at timestamptz not null default now(),
  call_id     text not null,
  step        text not null,
  status      text not null,          -- running, ok, warn, error
  detail      text,
  duration_ms integer
);
create index if not exists pipeline_events_call_id on pipeline_events (call_id);

-- Every text the agent would send. While Twilio is not connected these are
-- queued rather than sent, and the demo shows them on a phone mock up.
create table if not exists outbound_messages (
  id          bigserial primary key,
  tenant_id        text not null default 'demo',
  created_at  timestamptz not null default now(),
  call_id     text,
  to_number   text not null,
  to_label    text not null,          -- caller or technician
  body        text not null,
  channel     text not null default 'sms',
  status      text not null default 'queued',  -- queued, sent, failed
  provider    text not null default 'preview', -- preview or twilio
  provider_id text,
  error       text
);
create index if not exists outbound_messages_created_at on outbound_messages (created_at);

-- Messages the agent took because it could not book: out of area, nobody free
-- to transfer to, or a caller who wanted a call back. The office works this
-- list in the morning.
create table if not exists callback_queue (
  id           bigserial primary key,
  tenant_id        text not null default 'demo',
  created_at   timestamptz not null default now(),
  call_id      text not null,
  caller_name  text not null,
  caller_phone text not null,
  town         text,
  reason       text not null,
  note         text,
  handled_at   timestamptz
);
create index if not exists callback_queue_created_at on callback_queue (created_at);

create table if not exists demo_calls (
  call_id     text primary key,
  tenant_id        text not null default 'demo',
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  channel     text not null default 'web',
  from_number text,
  urgency     text,
  outcome     text,
  after_hours boolean not null default false,
  booked      boolean not null default false,
  ticket_value numeric(10,2),
  summary     text,
  transcript  text,
  recording_url text
);

-- ---------- platform: prospects, email, jobs ----------
-- These belong to us, not to a tenant. A lead becomes a tenant when sales
-- closes it; the messages and jobs tables carry both the landing site's
-- emails and, later, each tenant's notifications.

create table if not exists leads (
  id                  bigserial primary key,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  source              text not null default 'book_demo',
  name                text not null,
  business            text,
  email               text not null,
  phone               text not null,
  message             text,
  consent_contact     boolean not null default false,
  consent_at          timestamptz,
  consent_text        text,
  status              text not null default 'new',        -- new, contacted, booked, converted, closed
  tenant_id           text references tenants (id) on delete set null,
  sequence_stopped_at timestamptz,
  notes               text,
  ip_hash             text,
  user_agent          text
);
create index if not exists leads_status on leads (status, created_at);

create table if not exists messages (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  tenant_id    text,
  lead_id      bigint,
  channel      text not null default 'email',              -- email, sms
  direction    text not null default 'outbound',
  to_address   text not null,
  from_address text,
  template     text not null,
  subject      text,
  body_text    text,
  status       text not null default 'queued',             -- preview, queued, sent, delivered, opened, clicked, bounced, spam, failed
  provider     text not null default 'preview',            -- preview, sendgrid, twilio
  provider_id  text,
  error        text,
  events       jsonb not null default '[]'::jsonb
);
create index if not exists messages_lead on messages (lead_id, id);
create index if not exists messages_tenant on messages (tenant_id, id);

create table if not exists jobs (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  run_at      timestamptz not null default now(),
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'queued',              -- queued, running, done, failed, cancelled
  attempts    integer not null default 0,
  last_error  text,
  finished_at timestamptz,
  lead_id     bigint,
  tenant_id   text
);
create index if not exists jobs_due on jobs (status, run_at);
create index if not exists jobs_lead on jobs (lead_id);

-- ---------- migration for databases created before tenancy ----------
alter table demo_clients add column if not exists tenant_id text not null default 'demo';
alter table demo_jobs add column if not exists tenant_id text not null default 'demo';
alter table demo_visits add column if not exists tenant_id text not null default 'demo';
alter table demo_requests add column if not exists tenant_id text not null default 'demo';
alter table demo_notes add column if not exists tenant_id text not null default 'demo';
alter table call_events add column if not exists tenant_id text not null default 'demo';
alter table pipeline_events add column if not exists tenant_id text not null default 'demo';
alter table outbound_messages add column if not exists tenant_id text not null default 'demo';
alter table callback_queue add column if not exists tenant_id text not null default 'demo';
alter table demo_calls add column if not exists tenant_id text not null default 'demo';
alter table demo_calls add column if not exists transcript text;
alter table demo_calls add column if not exists recording_url text;
create index if not exists demo_clients_tenant on demo_clients (tenant_id);
create index if not exists demo_visits_tenant on demo_visits (tenant_id, starts_at);
create index if not exists demo_jobs_tenant on demo_jobs (tenant_id);
create index if not exists call_events_tenant on call_events (tenant_id, id);
create index if not exists pipeline_events_tenant on pipeline_events (tenant_id, id);
create index if not exists outbound_messages_tenant on outbound_messages (tenant_id, id);
create index if not exists callback_queue_tenant on callback_queue (tenant_id, id);
create index if not exists demo_calls_tenant on demo_calls (tenant_id, started_at);
`;

/** The tables that hold a tenant's data, in an order safe to clear. */
export const TENANT_TABLES = [
  "pipeline_events",
  "call_events",
  "outbound_messages",
  "callback_queue",
  "demo_calls",
  "demo_notes",
  "demo_requests",
  "demo_visits",
  "demo_jobs",
  "demo_clients",
] as const;

