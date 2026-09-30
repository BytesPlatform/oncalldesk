/**
 * The background work that outlives a single request: ageing out old
 * operational history, and (where the product has bookings) the reminder
 * a day before a visit. A trial is short and nobody is invoiced from it,
 * so there are no summaries, reports or nudges; a prospect who stops
 * after two days hears nothing more from us.
 *
 * Copied and adapted across the three products.
 */

import { dayStartUtc } from "./dash";
import { q } from "./db";
import { enqueue, registerJob, type Job } from "./jobs";
import { sendMessage } from "./sms";
import { getTenant, withTenant, type Tenant } from "./tenancy";
import { configOf } from "./tenant-config";


function tzOf(t: Tenant): string {
  return t.timezone || configOf(t).basics.timezone;
}


/** The next time it is `hour`:00 in the tenant's zone (optionally on `weekday`). */
export function nextLocalTime(tz: string, hour: number): Date {
  let candidate = new Date(dayStartUtc(tz).getTime() + hour * 3_600_000);
  if (candidate.getTime() <= Date.now()) candidate = new Date(candidate.getTime() + 24 * 3_600_000);
  return candidate;
}


/** Called by the cron entry point before running due jobs. */
export async function ensureAutomationSchedules(): Promise<void> {
  // One platform-wide retention pass a day, around 04:00 UTC.
  const [queued] = await q<{ n: number }>(
    `select count(*)::int as n from jobs where kind = 'retention' and status = 'queued'`,
  );
  if ((queued?.n ?? 0) === 0) {
    await enqueue("retention", {}, nextLocalTime("Etc/UTC", 4));
  }
}

/* -------------------------------------------------------------- retention */

/** How long the operational trails live. Events keep half a year; the
 *  words and audio of a call go sooner. */
const EVENT_RETENTION_DAYS = 180;
const MEDIA_RETENTION_DAYS = 90;

async function runRetention(): Promise<string> {
  const notes: string[] = [];
  const trails: [table: string, timeColumn: string][] = [
    ["pipeline_events", "occurred_at"],
    ["call_events", "occurred_at"],
    ["outbound_messages", "created_at"],
  ];
  for (const [table, timeColumn] of trails) {
    const rows = await q<{ id: number }>(
      `delete from ${table} where ${timeColumn} < now() - make_interval(days => $1) returning id`,
      [EVENT_RETENTION_DAYS],
    );
    if (rows.length) notes.push(`${table}: ${rows.length}`);
  }
  const media = await q<{ call_id: string }>(
    `update demo_calls set transcript = null, recording_url = null
      where started_at < now() - make_interval(days => $1) and (transcript is not null or recording_url is not null)
      returning call_id`,
    [MEDIA_RETENTION_DAYS],
  );
  if (media.length) notes.push(`call media: ${media.length}`);
  const pruned = await q<{ id: number }>(`delete from rate_limits where occurred_at < now() - interval '2 days' returning id`);
  if (pruned.length) notes.push(`rate_limits: ${pruned.length}`);
  return notes.length ? `purged ${notes.join(", ")}` : "nothing old enough";
}

/* ------------------------------------------------------------------ jobs */

/** The 24-hour visit reminder, product-specific. */
async function runVisitReminder(job: Job): Promise<string> {
  const t = await getTenant(String(job.payload.tenant_id));
  if (!t) return "tenant missing";
  if (t.status !== "active") return `tenant is ${t.status}`;
  const clientId = String(job.payload.client_id ?? "");
  const startsAt = String(job.payload.starts_at ?? "");
  const windowLabel = String(job.payload.window ?? "");
  const title = String(job.payload.title ?? "your visit");

  return withTenant(t, async () => {
    const [visit] = await q<{ status: string }>(
      `select status from demo_visits where tenant_id = $1 and client_id = $2 and starts_at = $3 order by id desc limit 1`,
      [t.id, clientId, startsAt],
    );
    if (!visit || visit.status === "cancelled") return "visit gone or cancelled, reminder dropped";
    const [client] = await q<{ phone: string | null }>(
      `select phone from demo_clients where tenant_id = $1 and id = $2`,
      [t.id, clientId],
    );
    if (!client?.phone) return "no phone on file";
    const sent = await sendMessage({
      to: client.phone,
      label: "caller",
      body: `${t.short_name}: a reminder about ${title.toLowerCase()} tomorrow, ${windowLabel}. Reply STOP to opt out.`,
    });
    return `reminder ${sent.status}`;
  });
}

registerJob("visit_reminder", runVisitReminder);
registerJob("retention", async () => {
  const note = await runRetention();
  await enqueue("retention", {}, nextLocalTime("Etc/UTC", 4));
  return note;
});
