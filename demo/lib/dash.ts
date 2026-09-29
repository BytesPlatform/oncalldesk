/**
 * What the customer dashboard shows. Product-specific: the three numbers
 * and their labels are this product's (calls, jobs booked, urgent jobs);
 * dental and legal count their own. Days run in the tenant's timezone,
 * not the server's.
 */

import { q } from "./db";
import { configOf } from "./tenant-config";
import type { Tenant } from "./tenancy";

export interface StatCard {
  label: string;
  today: number;
  yesterday: number;
}

export interface NeedsYouItem {
  /** Product-specific: this product uses callback, request and failed_text. */
  kind: string;
  id: string;
  title: string;
  detail: string;
  when: string;
  phone: string | null;
  /** Set when "Done" can clear it from the list. */
  canDone: boolean;
  /** Set when the item points at a call worth opening. */
  callId: string | null;
}

/** What the little green tag on a handled call says, in this product's words. */
export const BOOKED_TAG = "booked";
/** The upcoming panel's title, in this product's words. */
export const UPCOMING_TITLE = "Upcoming jobs";

export interface CallRow {
  call_id: string;
  flagged: boolean;
  started_at: string;
  ended_at: string | null;
  channel: string;
  from_number: string | null;
  urgency: string | null;
  outcome: string | null;
  after_hours: boolean;
  booked: boolean;
  ticket_value: number | null;
  summary: string | null;
  has_transcript: boolean;
  has_recording: boolean;
}

export interface CallDetail extends CallRow {
  transcript: string | null;
  recording_url: string | null;
  pipeline: { step: string; status: string; detail: string | null; occurred_at: string }[];
  events: { action: string; outcome: string | null; urgency: string | null; occurred_at: string }[];
  texts: { to_label: string | null; to_number: string; body: string; status: string; created_at: string }[];
}

export interface UpcomingVisit {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  worker_name: string | null;
  urgency: string;
  by_agent: boolean;
}

export interface HomeData {
  stats: StatCard[];
  needsYou: NeedsYouItem[];
  todaysCalls: CallRow[];
  upcoming: UpcomingVisit[];
  agent: {
    published: boolean;
    phoneNumber: string | null;
    weekCalls: number;
    avgSeconds: number | null;
  };
  hasAnyCalls: boolean;
  timezone: string;
}

/** Midnight, `daysBack` days ago, in the tenant's timezone, as a UTC instant. */
export function dayStartUtc(tz: string, daysBack = 0): Date {
  const now = new Date();
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysBack);
    return d;
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  // The tenant's wall clock read as if it were UTC differs from real UTC by the zone offset.
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const midnightAsUtc = Date.UTC(get("year"), get("month") - 1, get("day") - daysBack);
  return new Date(midnightAsUtc - offsetMs);
}

const CALL_COLS = `call_id, false as flagged, started_at, ended_at, channel, from_number, urgency, outcome, after_hours, booked,
       ticket_value::float as ticket_value, summary,
       (transcript is not null) as has_transcript, (recording_url is not null) as has_recording`;

export async function homeData(tenant: Tenant): Promise<HomeData> {
  const c = configOf(tenant);
  const tz = tenant.timezone || c.basics.timezone;
  const today = dayStartUtc(tz);
  const yesterday = dayStartUtc(tz, 1);

  const [counts] = await q<{
    t_calls: number; t_booked: number; t_urgent: number;
    y_calls: number; y_booked: number; y_urgent: number;
    all_calls: number;
  }>(
    `select count(*) filter (where started_at >= $2)::int as t_calls,
            count(*) filter (where started_at >= $2 and booked)::int as t_booked,
            count(*) filter (where started_at >= $2 and urgency in ('emergency','urgent'))::int as t_urgent,
            count(*) filter (where started_at >= $3 and started_at < $2)::int as y_calls,
            count(*) filter (where started_at >= $3 and started_at < $2 and booked)::int as y_booked,
            count(*) filter (where started_at >= $3 and started_at < $2 and urgency in ('emergency','urgent'))::int as y_urgent,
            count(*)::int as all_calls
       from demo_calls where tenant_id = $1`,
    [tenant.id, today, yesterday],
  );

  const stats: StatCard[] = [
    { label: "Calls today", today: counts.t_calls, yesterday: counts.y_calls },
    { label: "Jobs booked", today: counts.t_booked, yesterday: counts.y_booked },
    { label: "Urgent jobs", today: counts.t_urgent, yesterday: counts.y_urgent },
  ];

  const callbacks = await q<{ id: number; caller_name: string | null; caller_phone: string | null; reason: string | null; note: string | null; created_at: string }>(
    `select id, caller_name, caller_phone, reason, note, created_at
       from callback_queue where tenant_id = $1 and handled_at is null order by created_at desc limit 8`,
    [tenant.id],
  );
  const requests = await q<{ id: string; title: string; details: string | null; created_at: string }>(
    `select id, title, details, created_at
       from demo_requests where tenant_id = $1 and status = 'new' order by created_at desc limit 8`,
    [tenant.id],
  );
  const failedTexts = await q<{ id: number; to_number: string; body: string; created_at: string }>(
    `select id, to_number, body, created_at
       from outbound_messages where tenant_id = $1 and status = 'failed' and created_at > now() - interval '7 days'
      order by created_at desc limit 5`,
    [tenant.id],
  );

  const needsYou: NeedsYouItem[] = [
    ...callbacks.map((r) => ({
      kind: "callback",
      id: String(r.id),
      title: `Call back ${r.caller_name || "a caller"}`,
      detail: [r.reason, r.note].filter(Boolean).join(". ") || "The assistant promised a callback.",
      when: r.created_at,
      phone: r.caller_phone,
      canDone: true,
      callId: null,
    })),
    ...requests.map((r) => ({
      kind: "request",
      id: r.id,
      title: r.title || "Quote request",
      detail: r.details || "A caller asked for an estimate.",
      when: r.created_at,
      phone: null,
      canDone: true,
      callId: null,
    })),
    ...failedTexts.map((r) => ({
      kind: "failed_text",
      id: String(r.id),
      title: `A text to ${r.to_number} failed`,
      detail: r.body.slice(0, 120),
      when: r.created_at,
      phone: r.to_number,
      canDone: false,
      callId: null,
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));

  const todaysCalls = await q<CallRow>(
    `select ${CALL_COLS} from demo_calls
      where tenant_id = $1 and started_at >= $2 order by started_at desc limit 8`,
    [tenant.id, today],
  );

  const upcomingRows = await q<{ id: string; title: string; starts_at: string; ends_at: string; urgency: string; created_by_agent: boolean; technician_id: string | null; first_name: string | null; last_name: string | null }>(
    `select v.id, v.title, v.starts_at, v.ends_at, v.urgency, v.created_by_agent, v.technician_id,
            c.first_name, c.last_name
       from demo_visits v left join demo_clients c on c.id = v.client_id and c.tenant_id = v.tenant_id
      where v.tenant_id = $1 and v.status <> 'cancelled' and v.ends_at >= now()
      order by v.starts_at asc limit 4`,
    [tenant.id],
  );
  const techName = new Map(c.technicians.map((t) => [t.id, t.firstName]));
  const upcoming: UpcomingVisit[] = upcomingRows.map((v) => ({
    id: v.id,
    title: v.title,
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    client_name: [v.first_name, v.last_name ? `${v.last_name[0]}.` : null].filter(Boolean).join(" ") || "Customer",
    worker_name: (v.technician_id && techName.get(v.technician_id)) || null,
    urgency: v.urgency,
    by_agent: v.created_by_agent,
  }));

  const [week] = await q<{ calls: number; avg_seconds: number | null }>(
    `select count(*)::int as calls,
            avg(extract(epoch from (ended_at - started_at)))::float as avg_seconds
       from demo_calls where tenant_id = $1 and started_at > now() - interval '7 days' and ended_at is not null`,
    [tenant.id],
  );

  return {
    stats,
    needsYou,
    todaysCalls,
    upcoming,
    agent: {
      published: Boolean(tenant.retell_agent_id),
      phoneNumber: tenant.phone_number || c.phone.existingNumber || null,
      weekCalls: week?.calls ?? 0,
      avgSeconds: week?.avg_seconds ?? null,
    },
    hasAnyCalls: counts.all_calls > 0,
    timezone: tz,
  };
}

export async function listCalls(tenantId: string, limit = 50): Promise<CallRow[]> {
  return q<CallRow>(
    `select ${CALL_COLS} from demo_calls where tenant_id = $1 order by started_at desc limit $2`,
    [tenantId, limit],
  );
}

export async function callDetail(tenantId: string, callId: string): Promise<CallDetail | null> {
  const [call] = await q<CallDetail>(
    `select ${CALL_COLS}, transcript, recording_url from demo_calls where tenant_id = $1 and call_id = $2`,
    [tenantId, callId],
  );
  if (!call) return null;
  call.pipeline = await q(
    `select step, status, detail, occurred_at from pipeline_events
      where tenant_id = $1 and call_id = $2 order by id asc limit 40`,
    [tenantId, callId],
  );
  call.events = await q(
    `select action, outcome, urgency, occurred_at from call_events
      where tenant_id = $1 and call_id = $2 order by id asc limit 40`,
    [tenantId, callId],
  );
  call.texts = await q(
    `select to_label, to_number, body, status, created_at from outbound_messages
      where tenant_id = $1 and call_id = $2 order by id asc limit 20`,
    [tenantId, callId],
  );
  return call;
}

/** "Done" on a Needs-you row, routed by the product-specific kind. */
export async function markNeedsDone(tenantId: string, kind: string, id: string): Promise<void> {
  if (kind === "callback") {
    await q(`update callback_queue set handled_at = now() where tenant_id = $1 and id = $2 and handled_at is null`, [tenantId, Number(id)]);
  } else if (kind === "request") {
    await q(`update demo_requests set status = 'handled' where tenant_id = $1 and id = $2 and status = 'new'`, [tenantId, id]);
  }
}

/** This month's answered minutes against the plan, for the billing card. */
export async function monthUsage(tenant: Tenant): Promise<{ minutes: number; included: number; plan: string }> {
  const c = configOf(tenant);
  const tz = tenant.timezone || c.basics.timezone;
  const now = dayStartUtc(tz);
  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  const [row] = await q<{ seconds: number }>(
    `select coalesce(sum(extract(epoch from (ended_at - started_at))), 0)::float as seconds
       from demo_calls where tenant_id = $1 and started_at >= $2 and ended_at is not null`,
    [tenant.id, monthStart],
  );
  return { minutes: Math.ceil((row?.seconds ?? 0) / 60), included: tenant.included_minutes ?? 0, plan: tenant.plan || "trial" };
}
