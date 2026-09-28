/**
 * The numbers a customer is sent about their week. Product-specific: each
 * product counts what its dashboard counts.
 */
import { q } from "./db";

export interface WeekStats {
  calls: number;
  lines: { label: string; value: string }[];
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
