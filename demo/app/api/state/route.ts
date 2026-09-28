/**
 * Everything the screen needs, in one poll.
 *
 * The browser sends the highest id it has already seen, so rows come back only
 * when they are new and the panels append rather than redraw. Polling rather
 * than a socket is deliberate: it survives a cold start, a conference network
 * and a laptop waking from sleep, which is the situation a live demo runs in.
 *
 * ?scope=demo (the default) reads the public demo workspace. ?scope=app reads
 * the signed-in person's workspace and needs a session.
 */

import { NextRequest, NextResponse } from "next/server";
import { databaseWarning, q } from "@/lib/db";
import { DAY_END_HOUR, DAY_START_HOUR } from "@/lib/config";
import { cfg, isAfterHoursFor, onCallTechnicianFor, onboardingComplete } from "@/lib/tenant-config";
import { jobber } from "@/lib/jobber";
import { tenantForRequest } from "@/lib/scope";
import { smsMode } from "@/lib/sms";
import { DEMO_TENANT_ID, tenantId, withTenant, type Tenant } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(value: string | null, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await tenantForRequest(request);
    if (resolved instanceof NextResponse) return resolved;
    return await withTenant(resolved.tenant, () => readState(request, resolved.tenant));
  } catch (err) {
    // A blank 500 on the endpoint that drives every panel is the worst
    // possible failure to debug during a demo, so say what went wrong.
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "could not read the demo state", detail: message, hint: databaseWarning() },
      { status: 500 },
    );
  }
}

async function readState(request: NextRequest, tenant: Tenant) {
  const params = request.nextUrl.searchParams;
  const sincePipeline = num(params.get("pipeline"));
  const sinceEvents = num(params.get("events"));
  const sinceMessages = num(params.get("messages"));
  const sinceCallbacks = num(params.get("callbacks"));
  const dayOffset = num(params.get("day"), 0);
  const t = tenantId();
  const c = cfg();
  const afterHours = isAfterHoursFor(c);
  const onCall = onCallTechnicianFor(c);

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + dayOffset);

  const [visits, pipeline, events, messages, callbacks, calls, totals] = await Promise.all([
    jobber().listVisits({ fromDate: from, days: 1 }),
    q(
      `select id, occurred_at, call_id, step, status, detail, duration_ms
       from pipeline_events where tenant_id = $2 and id > $1 order by id asc limit 200`,
      [sincePipeline, t],
    ),
    q(
      `select id, occurred_at, call_id, action, outcome, urgency, detail
       from call_events where tenant_id = $2 and id > $1 order by id asc limit 200`,
      [sinceEvents, t],
    ),
    q(
      `select id, created_at, call_id, to_number, to_label, body, status, provider
       from outbound_messages where tenant_id = $2 and id > $1 order by id asc limit 50`,
      [sinceMessages, t],
    ),
    q(
      `select id, created_at, call_id, caller_name, caller_phone, town, reason, note, handled_at
       from callback_queue where tenant_id = $2 and id > $1 order by id asc limit 50`,
      [sinceCallbacks, t],
    ),
    q(
      `select call_id, started_at, ended_at, channel, from_number, urgency,
              outcome, after_hours, booked, ticket_value, summary
       from demo_calls where tenant_id = $1 order by started_at desc limit 10`,
      [t],
    ),
    q(
      `select
         (select count(*)::int from demo_calls where tenant_id = $1)                                  as calls_total,
         (select count(*)::int from demo_calls where tenant_id = $1 and after_hours)                  as calls_after_hours,
         (select count(*)::int from demo_calls where tenant_id = $1 and booked)                       as jobs_booked,
         (select coalesce(sum(ticket_value),0)::float from demo_calls where tenant_id = $1 and booked) as revenue_booked,
         (select count(*)::int from demo_visits where tenant_id = $1 and created_by_agent and status <> 'cancelled') as visits_by_agent,
         (select count(*)::int from outbound_messages where tenant_id = $1)                           as messages_total,
         (select count(*)::int from callback_queue where tenant_id = $1 and handled_at is null)       as callbacks_open`,
      [t],
    ),
  ]);

  return NextResponse.json({
    company: {
      name: tenant.name,
      shortName: tenant.short_name,
      tagline: tenant.tagline ?? "",
      mainNumber: tenant.main_number ?? "",
    },
    mode: {
      // Shown in the header so nobody has to guess what is live.
      jobber: jobber().mode,
      sms: smsMode(),
      afterHours,
      onCall: onCall.firstName,
      onboarded: tenant.id === DEMO_TENANT_ID || onboardingComplete(c),
      phoneNumber: tenant.phone_number ?? (tenant.id === "demo" ? process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER ?? "" : ""),
    },
    board: {
      dayOffset,
      date: from.toISOString(),
      startHour: DAY_START_HOUR,
      endHour: DAY_END_HOUR,
      hours: c.basics.hours,
      technicians: c.technicians.map((tech) => ({
        id: tech.id,
        name: tech.name,
        firstName: tech.firstName,
        tone: tech.tone,
        onCall: onCall.id === tech.id,
      })),
      jobTypes: c.services.map((j) => ({ id: j.id, name: j.name, minutes: j.minutes, urgency: j.urgency })),
      serviceArea: c.serviceArea,
    },
    visits,
    pipeline,
    events,
    messages,
    callbacks,
    calls,
    totals: totals[0] ?? {
      calls_total: 0,
      calls_after_hours: 0,
      jobs_booked: 0,
      revenue_booked: 0,
      visits_by_agent: 0,
      messages_total: 0,
      callbacks_open: 0,
    },
    cursors: {
      pipeline: pipeline.length ? Number(pipeline[pipeline.length - 1].id) : sincePipeline,
      events: events.length ? Number(events[events.length - 1].id) : sinceEvents,
      messages: messages.length ? Number(messages[messages.length - 1].id) : sinceMessages,
      callbacks: callbacks.length ? Number(callbacks[callbacks.length - 1].id) : sinceCallbacks,
    },
  });
}
