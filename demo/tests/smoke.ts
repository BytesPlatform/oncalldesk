/**
 * End to end check of the HVAC pipeline without Next.js, Retell or a database
 * server. Runs against PGlite, so it works on a clean machine with no accounts.
 *
 *   npx tsx tests/smoke.ts
 *
 * It walks the emergency scene the way a real call would, then the out of area
 * scene, then the estimate scene, and prints what the demo panels will show.
 */

// The emergency scene is an after hours call, so pin that regardless of when
// the test runs. The demo uses the same switch.
process.env.DEMO_FORCE_AFTER_HOURS = "true";
// Never against the real database: the local env may carry DATABASE_URL.
for (const k of ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "DATABASE_POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "DATABASE_URL_UNPOOLED"]) delete process.env[k];

import { rm } from "node:fs/promises";
import { q, resetDemo } from "../lib/db";
import { DEMO_TENANT_ID, addMembership, createTenant, getTenant, membershipsForUser, tenantByAgentId, withTenant } from "../lib/tenancy";
import { runTool } from "../lib/tools";
import { createLead, getLead, setLeadStatus } from "../lib/leads";
import { runDueJobs } from "../lib/jobs";
import { configOf, defaultConfig, isAfterHoursFor, mergeConfig, readiness } from "../lib/tenant-config";
import { renderFlow, renderGlobalPrompt } from "../lib/provision";
import { jobber } from "../lib/jobber";
import type { ToolRequest } from "../lib/retell";

function call(callId: string, name: string, args: Record<string, unknown>, fromNumber?: string): ToolRequest {
  return { name, call: { call_id: callId, from_number: fromNumber }, args };
}

function heading(text: string) {
  console.log(`\n=== ${text} ===`);
}

async function main() {
  await rm(process.env.PGLITE_DIR || "./.pgdata", { recursive: true, force: true });

  heading("seed");
  await resetDemo();
  const demo = await getTenant(DEMO_TENANT_ID);
  if (!demo) throw new Error("bootstrap did not create the demo tenant");
  if (!(await tenantByAgentId(undefined))) throw new Error("a call without an agent id must fall back to the demo tenant");
  if (await tenantByAgentId("agent_nobody_owns")) throw new Error("an unknown agent must not resolve to any tenant");
  await withTenant(demo, scenes);
  await isolation();
  await landingSite();
  await onboardingConfig();
  await automation();
  await hardening();
}

/** Phase 5: the secret box, the durable rate limit, billing arithmetic, retention and alerting. */
async function hardening() {
  heading("hardening: secrets, rate limits, usage, retention, alerts");
  const { encryptSecret, decryptSecret } = await import("../lib/secretbox");
  const { allowRate } = await import("../lib/ratelimit");
  const { tenantUsage } = await import("../lib/usage");
  const { setTenantSecret, getTenantSecret } = await import("../lib/tenancy");
  const { enqueue } = await import("../lib/jobs");

  const boxed = encryptSecret("jobber-token-123");
  if (decryptSecret(boxed) !== "jobber-token-123") throw new Error("the secret box must round-trip");
  if (boxed.includes("jobber-token-123")) throw new Error("the ciphertext must not contain the plaintext");
  let tampered = false;
  try {
    decryptSecret("v1:" + Buffer.from("tampered-nonsense-payload-1234567890abcd").toString("base64"));
    tampered = true;
  } catch { /* expected */ }
  if (tampered) throw new Error("a tampered secret must fail to decrypt");

  if (!(await allowRate("smoke:limit", 2, 10))) throw new Error("first hit must pass");
  await allowRate("smoke:limit", 2, 10);
  if (await allowRate("smoke:limit", 2, 10)) throw new Error("the third hit in the window must be limited");

  const biller = await createTenant({ name: "Meter Test Heating", mainNumber: "(847) 555-0199" });
  await setTenantSecret(biller.id, "jobber", "sk-very-secret");
  const back = await getTenant(biller.id);
  const [rawCfg] = await q<{ config: { secrets?: Record<string, string> } }>(`select config from tenants where id = $1`, [biller.id]);
  if (JSON.stringify(rawCfg.config).includes("sk-very-secret")) throw new Error("the stored config must never hold the plaintext");
  if ((await getTenantSecret(back!, "jobber")) !== "sk-very-secret") throw new Error("the tenant secret must round-trip");

  // Two calls, 5s and 65s: billable minutes must be 1 + 2 = 3, per-call rounding.
  await q(
    `insert into demo_calls (call_id, tenant_id, started_at, ended_at) values
       ('meter_1', $1, now() - interval '10 minutes', now() - interval '10 minutes' + interval '5 seconds'),
       ('meter_2', $1, now() - interval '9 minutes', now() - interval '9 minutes' + interval '65 seconds')`,
    [biller.id],
  );
  const usage = await tenantUsage(back!);
  if (usage.minutes !== 3) throw new Error(`per-call rounding must give 3 minutes, got ${usage.minutes}`);

  // Retention: an ancient event goes, a fresh one stays, old call media is stripped.
  await q(`insert into pipeline_events (tenant_id, call_id, step, status, occurred_at) values ($1,'old_call','call_answered','ok', now() - interval '200 days')`, [biller.id]);
  await q(`insert into demo_calls (call_id, tenant_id, started_at, ended_at, transcript) values ('old_media', $1, now() - interval '120 days', now() - interval '120 days', 'ancient words')`, [biller.id]);
  await enqueue("retention", {}, new Date(Date.now() - 1000));
  const ranRetention = await runDueJobs();
  const retention = ranRetention.results.find((r) => r.kind === "retention");
  if (!retention || !/purged/.test(retention.outcome)) throw new Error(`retention must purge, got ${retention?.outcome}`);
  const [oldRows] = await q<{ n: number }>(`select count(*)::int as n from pipeline_events where call_id = 'old_call'`);
  if (oldRows.n !== 0) throw new Error("the ancient pipeline event must be gone");
  const [medias] = await q<{ t: string | null }>(`select transcript as t from demo_calls where call_id = 'old_media'`);
  if (medias.t !== null) throw new Error("old call media must be stripped");

  // A job that runs out of retries alerts the platform admins, once.
  process.env.PLATFORM_ADMIN_EMAILS = process.env.PLATFORM_ADMIN_EMAILS || "ops@example.com";
  await q(`insert into jobs (kind, payload, run_at, attempts, status) values ('no_such_kind','{}', now() - interval '1 minute', 2, 'queued')`);
  await runDueJobs();
  const [alerts] = await q<{ n: number }>(`select count(*)::int as n from messages where template = 'platform_alert'`);
  if (alerts.n !== 1) throw new Error(`one platform alert must be logged, found ${alerts.n}`);

  console.log("secrets, rate limits, usage, retention and alerts hold");
}

/** Phase 4: STOP handling, the suppression check, and the recurring emails. */
async function automation() {
  heading("automation: consent, suppression and the scheduled emails");
  const { stopKeyword, recordSmsConsent, sendMessage } = await import("../lib/sms");
  const { enqueue } = await import("../lib/jobs");
  const { nextLocalTime } = await import("../lib/automation");

  if (stopKeyword("STOP") !== "stop" || stopKeyword("  unsubscribe please") !== "stop") throw new Error("STOP keywords must be recognised");
  if (stopKeyword("Start") !== "start" || stopKeyword("HELP") !== "help") throw new Error("START and HELP must be recognised");
  if (stopKeyword("can you stop by tomorrow") !== null) throw new Error("STOP must only match as the first word");

  const owner = await createTenant({ name: "Borealis Air", mainNumber: "(773) 555-0100" });
  await addMembership({ tenantId: owner.id, email: "boss@borealis.example", name: "Robin Vale", role: "owner" });
  await q(`update tenants set status = 'active', config = config || $2::jsonb where id = $1`, [
    owner.id,
    JSON.stringify({ onboarding: { step: 8, startedAt: new Date().toISOString(), completedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(), checklist: {}, testCallId: null } }),
  ]);

  await withTenant(owner, async () => {
    await recordSmsConsent({ phone: "+17735550111", kind: "sms_opt_out", source: "inbound_sms" });
    const blocked = await sendMessage({ to: "(773) 555-0111", label: "caller", body: "should never go" });
    if (blocked.status !== "suppressed") throw new Error(`a STOP number must be suppressed, got ${blocked.status}`);
    await recordSmsConsent({ phone: "+17735550111", kind: "sms_opt_in", source: "inbound_sms" });
    const allowed = await sendMessage({ to: "(773) 555-0111", label: "caller", body: "welcome back" });
    if (allowed.status !== "queued") throw new Error(`after START the message must queue, got ${allowed.status}`);
  });

  const soon = nextLocalTime(owner.timezone, 18);
  if (soon.getTime() <= Date.now()) throw new Error("the next summary time must be in the future");

  // A silent week on an active tenant: the daily job skips the summary and sends the nudge.
  await enqueue("daily_summary", { tenant_id: owner.id }, new Date(Date.now() - 1000), { tenantId: owner.id });
  const ran = await runDueJobs();
  const daily = ran.results.find((r) => r.kind === "daily_summary");
  if (!daily || !/re-engagement sent/.test(daily.outcome)) throw new Error(`expected the re-engagement nudge, got ${daily?.outcome}`);
  const [mail] = await q<{ n: number }>(`select count(*)::int as n from messages where tenant_id = $1 and template = 're_engagement'`, [owner.id]);
  if (mail.n < 1) throw new Error("the re-engagement email must be logged in messages");
  const [next] = await q<{ n: number }>(`select count(*)::int as n from jobs where tenant_id = $1 and kind = 'daily_summary' and status = 'queued'`, [owner.id]);
  if (next.n !== 1) throw new Error("the daily job must reschedule itself exactly once");

  await enqueue("weekly_report", { tenant_id: owner.id }, new Date(Date.now() - 1000), { tenantId: owner.id });
  const ran2 = await runDueJobs();
  const weekly = ran2.results.find((r) => r.kind === "weekly_report");
  if (!weekly || !/sent/.test(weekly.outcome)) throw new Error(`expected the weekly report to send, got ${weekly?.outcome}`);

  console.log("consent, suppression and the scheduled emails hold");
}

/** The tenant configuration: defaults, merge, hours in a time zone, and what the agent is rendered from. */
async function onboardingConfig() {
  heading("onboarding: configuration and agent rendering");
  const acme = await createTenant({ name: "Acme Heating", mainNumber: "(847) 555-0100" });
  const base = configOf(acme);
  if (base.technicians.length !== 4 || base.serviceArea.length < 10) throw new Error("a new tenant must start on the product defaults");
  if (readiness(base).ok !== true) throw new Error("the defaults must be publishable as they are");

  const patched = mergeConfig(defaultConfig(), {
    basics: { timezone: "America/New_York", hours: { mon: { open: "09:00", close: "17:00" }, sun: null }, holidays: ["2026-12-25"] },
    serviceArea: [{ zip: "10001", town: "Manhattan" }],
    behaviour: { greeting: "Thanks for calling Acme. This call is recorded. How can I help?" },
  });
  if (patched.basics.hours.tue?.open !== "07:00") throw new Error("merging must keep untouched days from the defaults");
  if (patched.serviceArea.length !== 1) throw new Error("arrays are replaced whole");
  const saved = process.env.DEMO_FORCE_AFTER_HOURS; delete process.env.DEMO_FORCE_AFTER_HOURS;
  // 2026-09-28 is a Monday. 14:00 UTC is 10:00 in New York: open. 23:00 UTC is 19:00: after hours.
  if (isAfterHoursFor(patched, new Date("2026-09-28T14:00:00Z"))) throw new Error("10 am on a Monday in New York must be office hours");
  if (!isAfterHoursFor(patched, new Date("2026-09-28T23:00:00Z"))) throw new Error("7 pm in New York must be after hours");
  if (!isAfterHoursFor(patched, new Date("2026-12-25T15:00:00Z"))) throw new Error("a holiday must count as closed");
  if (!isAfterHoursFor(patched, new Date("2026-10-04T15:00:00Z"))) throw new Error("a closed Sunday must count as after hours");
  process.env.DEMO_FORCE_AFTER_HOURS = saved;

  const flow = renderFlow(acme, patched) as { nodes: { id: string; instruction?: { text: string } }[]; default_dynamic_variables: Record<string, string>; global_prompt: string; tools: { url?: string }[] };
  const opening = flow.nodes.find((n) => n.id === "n_opening");
  if (opening?.instruction?.text !== patched.behaviour.greeting) throw new Error("the opening line must be the tenant's greeting");
  if (flow.default_dynamic_variables.company_name !== "Acme Heating") throw new Error("dynamic variables must carry the tenant");
  const prompt = renderGlobalPrompt(acme, patched);
  if (!prompt.includes("Manhattan 10001") || !prompt.includes("Monday, 9 in the morning until 5 in the afternoon") || prompt.includes("northwest suburbs")) throw new Error("the prompt must carry the tenant's facts and none of the demo's");
  if (flow.tools.some((t) => t.url && t.url.includes("<DEMO_HOST>"))) throw new Error("tool urls must point at the site");
  console.log("config merge, hours and rendering hold");
}

/**
 * The Book a demo form end to end, in preview mode: the lead row, the two
 * immediate emails, the three follow-up jobs, the worker running them, and
 * the sequence stopping when sales marks the lead contacted.
 */
async function landingSite() {
  heading("landing site: demo request, emails and follow-ups");
  const made = await createLead({
    name: "Dana Whitlock",
    business: "Acme Comfort Systems",
    email: "Dana@Acme.example",
    phone: "+18475550100",
    message: "Answer after hours and only wake me for real emergencies.",
    consent: true,
    followUpMs: { 1: 0, 2: 0, 3: 60 * 60_000 },
  });
  console.log(`lead ${made.lead.id}, notification ${made.notification}, auto-reply ${made.autoReply}, jobs ${made.jobs.join(",")}`);
  if (made.lead.email !== "dana@acme.example") throw new Error("email must be stored lower case");
  const [emails] = await q<{ n: number; previews: number }>(
    `select count(*)::int as n, count(*) filter (where status = 'preview')::int as previews from messages where lead_id = $1`,
    [made.lead.id],
  );
  if (emails.n !== 2 || emails.previews !== 2) throw new Error(`expected two preview emails, found ${emails.n} (${emails.previews} previews)`);

  const first = await runDueJobs();
  console.log("worker:", first.results.map((r) => `${r.id} ${r.outcome}`).join(" | "));
  if (first.done !== 2) throw new Error(`two follow-ups were due, ${first.done} ran`);
  const [after] = await q<{ n: number }>(`select count(*)::int as n from messages where lead_id = $1 and template like 'lead_followup_%'`, [made.lead.id]);
  if (after.n !== 2) throw new Error("the two due follow-ups must each produce an email");

  await setLeadStatus(made.lead.id, "contacted");
  const lead = await getLead(made.lead.id);
  if (!lead?.sequence_stopped_at) throw new Error("marking contacted must stop the sequence");
  const [left] = await q<{ n: number }>(`select count(*)::int as n from jobs where lead_id = $1 and status = 'queued'`, [made.lead.id]);
  if (left.n !== 0) throw new Error("the remaining follow-up must be cancelled once contacted");
  console.log("demo request flow holds");
  console.log("\nAll checks passed.\n");
}

/**
 * A second customer must never see the demo's rows, and the demo must never
 * see theirs. This is the one property tenancy exists for.
 */
async function isolation() {
  heading("tenant isolation");
  const acme = await createTenant({ name: "Acme Comfort Systems", retellAgentId: "agent_acme_test" });
  const resolved = await tenantByAgentId("agent_acme_test");
  if (resolved?.id !== acme.id) throw new Error("the agent id must resolve to the tenant that owns it");

  const demoBefore = await withTenant((await getTenant(DEMO_TENANT_ID))!, () =>
    q<{ n: number }>(`select count(*)::int as n from demo_calls where tenant_id = $1`, [DEMO_TENANT_ID]),
  );

  await withTenant(acme, async () => {
    const CALL = "call_acme_001";
    await runTool(call(CALL, "triage_problem", { description: "no heat" }, "+13125550188"));
    // Karen is a demo customer. Inside Acme she must be a stranger.
    const who = (await runTool(call(CALL, "find_or_create_customer", { first_name: "Karen", last_name: "Dolan", street: "812 North Dunton Avenue", city: "Arlington Heights", postal_code: "60004" }, "+13125550188"))) as { status: string };
    console.log("acme sees Karen as:", who.status);
    if (who.status === "existing") throw new Error("a demo customer leaked into another tenant");
    const visits = await jobber().listVisits({ fromDate: new Date(), days: 14 });
    if (visits.length !== 0) throw new Error(`Acme should have an empty board, found ${visits.length} visits`);
  });

  const [demoAfter] = await q<{ n: number }>(`select count(*)::int as n from demo_calls where tenant_id = $1`, [DEMO_TENANT_ID]);
  if (demoAfter.n !== demoBefore[0].n) throw new Error("an Acme call was counted against the demo tenant");
  const [acmeCalls] = await q<{ n: number }>(`select count(*)::int as n from demo_calls where tenant_id = $1`, [acme.id]);
  if (acmeCalls.n !== 1) throw new Error(`Acme should own exactly one call, found ${acmeCalls.n}`);

  // Invitation binding: the row is created by email, claimed on first sign-in.
  await addMembership({ tenantId: acme.id, email: "Owner@Acme.com", role: "owner" });
  const mine = await membershipsForUser({ id: "user_clerk_123", email: "owner@acme.com" });
  if (mine.length !== 1 || mine[0].clerk_user_id !== "user_clerk_123" || mine[0].invite_status !== "accepted") {
    throw new Error("first sign-in must claim the membership created for that email");
  }
  const again = await membershipsForUser({ id: "user_clerk_123", email: null });
  if (again.length !== 1) throw new Error("a bound membership must be found by Clerk id alone");
  const stranger = await membershipsForUser({ id: "user_clerk_999", email: "nobody@acme.com" });
  if (stranger.length !== 0) throw new Error("an uninvited email must not get a workspace");
  console.log("isolation and invitation binding hold");
  console.log("\nAll checks passed.\n");
}

async function scenes() {
  const [counts] = await q<{ clients: number; visits: number }>(
    `select (select count(*)::int from demo_clients) as clients,
            (select count(*)::int from demo_visits)  as visits`,
  );
  console.log(`gateway: ${jobber().mode}, clients ${counts.clients}, seeded visits ${counts.visits}`);
  if (counts.clients === 0 || counts.visits === 0) throw new Error("seed produced no data");

  // ---------------------------------------------------------------- scene 1
  const CALL_1 = "call_emergency_001";
  const KAREN = "+13125550188";

  heading("scene one, no heat emergency from a known customer");

  const triaged = (await runTool(
    call(CALL_1, "triage_problem", { description: "my furnace is dead and there is no heat, the house is freezing" }, KAREN),
  )) as { urgency: string; reason: string; job_type: string; dispatch_tonight: boolean; questions: string[] };
  console.log("triage:", triaged.urgency, "|", triaged.reason, "| job type:", triaged.job_type);
  if (triaged.urgency !== "emergency") throw new Error(`no heat must triage as emergency, got ${triaged.urgency}`);
  if (!triaged.questions?.length) throw new Error("emergency triage must return qualifying questions");

  const area = (await runTool(call(CALL_1, "check_service_area", { postal_code: "60004" }, KAREN))) as {
    covered: boolean;
    town?: string;
  };
  console.log("service area:", area);
  if (!area.covered) throw new Error("60004 is in the service area and must be covered");

  const customer = (await runTool(call(CALL_1, "find_or_create_customer", {}, KAREN))) as {
    status: string;
    client_id: string;
    property_id: string;
    first_name: string;
  };
  console.log("customer:", customer.status, customer.first_name);
  if (customer.status !== "existing") throw new Error("a known caller must be matched, not created again");

  const windows = (await runTool(
    call(CALL_1, "get_arrival_windows", { urgency: "emergency", job_type: triaged.job_type }, KAREN),
  )) as { windows?: { id: string; say: string }[] };
  console.log("windows offered:");
  for (const w of windows.windows ?? []) console.log("   ", w.say);
  if (!windows.windows?.length) throw new Error("expected at least one arrival window");
  if (windows.windows.length > 3) throw new Error("never offer more than three windows");

  const booked = (await runTool(
    call(
      CALL_1,
      "book_visit",
      {
        window_id: windows.windows[0].id,
        client_id: customer.client_id,
        property_id: customer.property_id,
        urgency: triaged.urgency,
        job_type: triaged.job_type,
        symptom: "Furnace not responding, no heat.",
      },
      KAREN,
    ),
  )) as { status: string; say?: string; job_id?: string };
  console.log("booked:", booked.status, "|", booked.say);
  if (booked.status !== "booked") throw new Error(`expected booked, got ${booked.status}`);

  const notified = (await runTool(
    call(CALL_1, "notify_on_call", { urgency: "emergency", summary: "No heat, Arlington Heights", window: booked.say }, KAREN),
  )) as { status: string; technician: string };
  console.log("notify:", notified);

  // The technician who is paged must be the technician who got the job, or
  // the demo contradicts itself on screen.
  if (!String(booked.say).includes(notified.technician)) {
    throw new Error(
      `paged ${notified.technician} but booked "${booked.say}". After hours emergencies must go to the on call technician.`,
    );
  }

  // ---------------------------------------------------------------- scene 2
  heading("scene two, caller outside the service area");
  const CALL_2 = "call_outofarea_002";
  await runTool(call(CALL_2, "triage_problem", { description: "no heat at all" }, "+13125550999"));
  const declined = (await runTool(call(CALL_2, "check_service_area", { postal_code: "60614" }, "+13125550999"))) as {
    covered: boolean;
    say: string;
  };
  console.log(declined);
  if (declined.covered) throw new Error("60614 must not be covered");

  // An out of area caller must still leave a trace, or the office never hears
  // about them and the contractor is back where they started.
  const message = (await runTool(
    call(CALL_2, "take_message", {
      name: "Owen Marsh",
      phone: "+13125550999",
      town: "Chicago, Lincoln Park",
      reason: "out_of_area",
      note: "No heat, wants a recommendation for someone who covers the city.",
    }, "+13125550999"),
  )) as { status: string };
  console.log("message:", message);
  if (message.status !== "recorded") throw new Error("take_message must record something");

  const queued = await q<{ n: number }>(`select count(*)::int as n from callback_queue where reason = 'out_of_area'`);
  if (queued[0].n !== 1) throw new Error("the out of area caller must land in the callback queue");

  const outOfAreaVisits = await q<{ n: number }>(
    `select count(*)::int as n from demo_visits where created_by_agent and job_id in
       (select id from demo_jobs where client_id in (select id from demo_clients where postal_code = '60614'))`,
  );
  if (outOfAreaVisits[0].n > 0) throw new Error("an out of area caller must never reach the dispatch board");

  // ---------------------------------------------------------------- scene 3
  heading("scene three, a browser caller books, calls back, is found, and cancels");
  const C_A = "call_browser_a";
  const C_B = "call_browser_b";
  // No caller id on a browser call. Two different people must not share a record.
  const sam = (await runTool(call(C_A, "find_or_create_customer", { first_name: "Sam", last_name: "Reilly", street: "40 Elm Court", postal_code: "60194", city: "Schaumburg" }))) as { status: string; client_id: string; property_id: string; first_name: string };
  const pat = (await runTool(call(C_B, "find_or_create_customer", { first_name: "Pat", last_name: "Quinn", street: "9 Oak Lane", postal_code: "60067", city: "Palatine" }))) as { status: string; client_id: string; first_name: string };
  console.log("sam:", sam.status, sam.first_name, "| pat:", pat.status, pat.first_name);
  if (sam.client_id === pat.client_id) throw new Error("two browser callers were given the same customer record");
  if (pat.first_name !== "Pat") throw new Error(`Pat was matched to ${pat.first_name}`);

  const samWindows = (await runTool(call(C_A, "get_arrival_windows", { urgency: "routine", job_type: "furnace_tuneup" }))) as { windows: { id: string; say: string }[] };
  const samBooked = (await runTool(call(C_A, "book_visit", { window_id: samWindows.windows[0].id, client_id: sam.client_id, property_id: sam.property_id, urgency: "routine", job_type: "furnace_tuneup", symptom: "System not running." }))) as { status: string; say: string };
  console.log("sam booked:", samBooked.status, samBooked.say);

  // Sam calls back the next day from the browser: no number, just a name and street.
  const found = (await runTool(call("call_browser_c", "find_visit", { first_name: "Sam", last_name: "Reilly", street: "40 Elm Court" }))) as { status: string; visit_id: string; say: string };
  console.log("call back:", found.status, "|", found.say);
  if (found.status !== "found") throw new Error(`a returning caller must find their booking, got ${found.status}`);
  if (!found.say.includes(samBooked.say)) throw new Error("the read back must match the window that was booked");

  const cancelled = (await runTool(call("call_browser_c", "cancel_visit", { visit_id: found.visit_id }))) as { status: string };
  if (cancelled.status !== "cancelled") throw new Error("cancel_visit must cancel");
  const again = (await runTool(call("call_browser_c", "find_visit", { first_name: "Sam", last_name: "Reilly", street: "40 Elm Court" }))) as { status: string };
  if (again.status !== "no_visit") throw new Error(`after cancelling, find_visit must report no_visit, got ${again.status}`);

  const unknown = (await runTool(call("call_browser_d", "find_visit", { first_name: "Nobody", last_name: "Here", street: "" }))) as { status: string };
  if (unknown.status !== "not_found") throw new Error("an unknown caller must be not_found");

  const byTown = (await runTool(call("call_town_x", "check_service_area", { postal_code: "Palatine" }))) as { covered: boolean; town?: string; postal_code?: string };
  if (!byTown.covered || byTown.town !== "Palatine") throw new Error("a town name must pass the coverage check");
  const byBadTown = (await runTool(call("call_town_y", "check_service_area", { postal_code: "Milwaukee" }))) as { covered: boolean };
  if (byBadTown.covered) throw new Error("Milwaukee must not be covered");

  const down = (await runTool(call("call_triage_x", "triage_problem", { description: "My HVAC system is down" }))) as { urgency: string };
  if (down.urgency !== "urgent") throw new Error(`"system is down" must triage as urgent, got ${down.urgency}`);

  // ---------------------------------------------------------------- scene 4
  heading("scene four, replacement estimate");
  const CALL_3 = "call_estimate_003";
  const quoteTriage = (await runTool(
    call(CALL_3, "triage_problem", { description: "I want a quote on a new furnace, mine is twenty years old" }, "+13125550142"),
  )) as { urgency: string; job_type: string };
  console.log("triage:", quoteTriage.urgency, "| job type:", quoteTriage.job_type);
  if (quoteTriage.urgency !== "quote") throw new Error(`expected quote, got ${quoteTriage.urgency}`);

  const quoteCustomer = (await runTool(call(CALL_3, "find_or_create_customer", {}, "+13125550142"))) as {
    client_id: string;
    property_id: string;
  };
  console.log(
    "estimate:",
    await runTool(
      call(CALL_3, "log_estimate_request", {
        client_id: quoteCustomer.client_id,
        property_id: quoteCustomer.property_id,
        details: "Twenty year old furnace, single family, wants replacement pricing.",
      }, "+13125550142"),
    ),
  );

  const estimateVisits = await q<{ n: number }>(
    `select count(*)::int as n from demo_visits where created_by_agent and job_id in
       (select id from demo_jobs where urgency = 'quote')`,
  );
  if (estimateVisits[0].n > 0) throw new Error("an estimate must not book a technician visit");

  // ---------------------------------------------------------------- results
  heading("dispatch board, agent created visits");
  const agentVisits = await q<{ id: string; technician_id: string; starts_at: string; urgency: string }>(
    `select id, technician_id, starts_at, urgency from demo_visits where created_by_agent order by starts_at`,
  );
  console.log(agentVisits);
  if (agentVisits.filter((v) => v.urgency !== "routine").length !== 1) throw new Error(`expected exactly one emergency agent visit, found ${agentVisits.length}`);

  heading("pipeline, scene one");
  const pipeline = await q<{ step: string; status: string; detail: string | null }>(
    `select step, status, detail from pipeline_events where call_id = $1 order by id asc`,
    [CALL_1],
  );
  for (const p of pipeline) console.log(`  ${p.status.padEnd(6)} ${p.step.padEnd(22)} ${p.detail ?? ""}`);

  heading("texts composed");
  const messages = await q<{ to_label: string; status: string; provider: string; body: string }>(
    `select to_label, status, provider, body from outbound_messages order by id asc`,
  );
  for (const m of messages) console.log(`  [${m.to_label}/${m.status}/${m.provider}] ${m.body}`);
  if (!messages.some((m) => m.to_label === "technician")) throw new Error("an after hours emergency must page the on call technician");
  if (!messages.some((m) => m.to_label === "caller")) throw new Error("the caller must get a confirmation text");

  heading("revenue panel totals");
  const [totals] = await q<{ after_hours: number; booked: number; revenue: number }>(
    `select count(*) filter (where after_hours)::int as after_hours,
            count(*) filter (where booked)::int      as booked,
            coalesce(sum(ticket_value),0)::float     as revenue
     from demo_calls`,
  );
  console.log(totals);
  if (totals.booked !== 2) throw new Error(`two calls should be marked booked, found ${totals.booked}`);

  console.log("\nAll checks passed.\n");
}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED\n", err);
  process.exit(1);
});
