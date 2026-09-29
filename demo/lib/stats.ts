/**
 * The numbers a customer is sent about their week and their day.
 * Product-specific: each product counts what its dashboard counts.
 */
import { dayStartUtc } from "./dash";
import { q } from "./db";

export interface WeekStats {
  calls: number;
  lines: { label: string; value: string }[];
}

export interface DayStats {
  calls: number;
  lines: { label: string; value: string }[];
  /** Open items on the dashboard's Needs-you list. */
  needsYou: number;
}

/** Today so far, in the tenant's timezone, for the close-of-business email. */
export async function dayStats(tenantId: string, tz: string): Promise<DayStats> {
  const today = dayStartUtc(tz);
  const [s] = await q<{ calls: number; after_hours: number; booked: number; revenue: number }>(
    `select count(*)::int as calls,
            count(*) filter (where after_hours)::int as after_hours,
            count(*) filter (where booked)::int as booked,
            coalesce(sum(ticket_value) filter (where booked), 0)::float as revenue
       from demo_calls where tenant_id = $1 and started_at >= $2`,
    [tenantId, today],
  );
  const [open] = await q<{ callbacks: number; requests: number }>(
    `select (select count(*)::int from callback_queue where tenant_id = $1 and handled_at is null) as callbacks,
            (select count(*)::int from demo_requests where tenant_id = $1 and status = 'new') as requests`,
    [tenantId],
  );
  return {
    calls: s.calls,
    lines: [
      { label: "Calls answered", value: String(s.calls) },
      { label: "Of which after hours", value: String(s.after_hours) },
      { label: "Jobs booked", value: String(s.booked) },
      { label: "Revenue booked, at your typical ticket values", value: `$${Math.round(s.revenue).toLocaleString()}` },
    ],
    needsYou: (open?.callbacks ?? 0) + (open?.requests ?? 0),
  };
}

export async function weekStats(tenantId: string): Promise<WeekStats> {
  const [s] = await q<{ calls: number; after_hours: number; booked: number; revenue: number }>(
    `select count(*)::int as calls,
            count(*) filter (where after_hours)::int as after_hours,
            count(*) filter (where booked)::int as booked,
            coalesce(sum(ticket_value) filter (where booked), 0)::float as revenue
       from demo_calls where tenant_id = $1 and started_at > now() - interval '7 days'`,
    [tenantId],
  );
  return {
    calls: s.calls,
    lines: [
      { label: "Calls answered", value: String(s.calls) },
      { label: "Of which after hours", value: String(s.after_hours) },
      { label: "Jobs booked", value: String(s.booked) },
      { label: "Revenue booked, at your typical ticket values", value: `$${Math.round(s.revenue).toLocaleString()}` },
    ],
  };
}
