"use server";

/**
 * What each onboarding step saves. Every action re-checks the session and
 * writes only to the signed-in tenant. The same actions back Settings.
 */

import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { e164 } from "@/lib/leads";
import { goLive, saveConfig, stepIndex } from "@/lib/onboarding";
import { buyNumber, provisionAgent, releaseNumber } from "@/lib/provision";
import { addMembership, recordInvitation, updateTenant } from "@/lib/tenancy";
import { requestOrigin, sendInvitation } from "@/lib/auth";
import { DAY_KEYS, ONBOARDING_STEPS, configOf, type DayHours, type DayKey, type StepId } from "@/lib/tenant-config";
import type { JobType, Technician, Urgency } from "@/lib/config";

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function next(form: FormData, step: StepId): never {
  const mode = text(form, "mode");
  if (mode === "settings") redirect(`/app/settings?ok=${encodeURIComponent("Saved.")}#${step}`);
  const i = stepIndex(step);
  const target = ONBOARDING_STEPS[i + 1]?.id;
  redirect(target ? `/app/setup/${target}` : "/app");
}

function back(step: StepId, message: string, form?: FormData): never {
  const mode = form ? text(form, "mode") : "";
  redirect(mode === "settings" ? `/app/settings?error=${encodeURIComponent(message)}#${step}` : `/app/setup/${step}?error=${encodeURIComponent(message)}`);
}

/* 1 */
export async function saveAccountAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const name = text(form, "name");
  if (!name) back("account", "The business name is required.", form);
  const c = configOf(ctx.tenant);
  await updateTenant(ctx.tenant.id, { name, short_name: text(form, "short_name") || name.split(/\s+/)[0], timezone: text(form, "timezone") || c.basics.timezone });
  await saveConfig(ctx.tenant.id, { basics: { ...c.basics, timezone: text(form, "timezone") || c.basics.timezone, website: text(form, "website") } }, 1);

  const invite = text(form, "invite_email").toLowerCase();
  if (invite) {
    const member = await addMembership({ tenantId: ctx.tenant.id, email: invite, name: text(form, "invite_name") || undefined, role: "staff" });
    const origin = await requestOrigin();
    await recordInvitation(member.id, await sendInvitation({ email: invite, tenantId: ctx.tenant.id, role: "staff", origin }));
  }
  next(form, "account");
}

/* 2 */
export async function saveBusinessAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const callback = text(form, "callback_number");
  if (!callback) back("business", "The number the assistant gives out is required.", form);
  const hours = {} as Record<DayKey, DayHours>;
  for (const d of DAY_KEYS) {
    const closed = form.get(`closed_${d}`) === "on";
    const open = text(form, `open_${d}`);
    const close = text(form, `close_${d}`);
    hours[d] = closed || !open || !close ? null : { open, close };
  }
  const holidays = text(form, "holidays")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
  await updateTenant(ctx.tenant.id, { main_number: callback });
  await saveConfig(
    ctx.tenant.id,
    { basics: { ...c.basics, address: text(form, "address"), callbackNumber: callback, hours, holidays, afterHoursPolicy: text(form, "after_hours") === "message" ? "message" : "book" } },
    2,
  );
  next(form, "business");
}

/* 3 */
const URGENCIES: Urgency[] = ["emergency", "urgent", "routine", "quote"];
const TONES = ["blue", "rust", "moss", "slate"] as const;
const DAY_WORDS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "item";
}

export async function saveServicesAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);

  const services: JobType[] = [];
  for (const line of text(form, "services").split(/\r?\n/)) {
    const [name, minutes, urgency, skill, ticket] = line.split("|").map((s) => s.trim());
    if (!name) continue;
    const u = URGENCIES.includes(urgency as Urgency) ? (urgency as Urgency) : "routine";
    services.push({ id: slug(name), name, minutes: Math.max(15, Number(minutes) || 60), urgency: u, skill: (skill || "any").toLowerCase(), typicalTicket: Number(ticket) || 0 });
  }
  const serviceArea: { zip: string; town: string }[] = [];
  for (const line of text(form, "service_area").split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{5})\s*[,;:]?\s*(.*)$/);
    if (m) serviceArea.push({ zip: m[1], town: m[2].trim() || m[1] });
  }
  const technicians: Technician[] = [];
  let i = 0;
  for (const line of text(form, "technicians").split(/\r?\n/)) {
    const [name, skills, days] = line.split("|").map((s) => s.trim());
    if (!name) continue;
    const onCallDays = (days || "")
      .split(/[,\s]+/)
      .map((d) => DAY_WORDS[d.toLowerCase().slice(0, 3)])
      .filter((d) => d !== undefined);
    technicians.push({ id: `tech_${slug(name)}`, name, firstName: name.split(/\s+/)[0], skills: (skills || "any").split(/[,\s]+/).map((s) => s.toLowerCase()).filter(Boolean), onCallDays, tone: TONES[i++ % TONES.length] });
  }
  if (!services.length) back("services", "Add at least one service.", form);
  if (!serviceArea.length) back("services", "Add at least one postcode in the service area.", form);
  if (!technicians.length) back("services", "Add at least one technician.", form);
  await saveConfig(ctx.tenant.id, { services, serviceArea, technicians }, 3);
  void c;
  next(form, "services");
}

/* 4 */
export async function saveBehaviourAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const c = configOf(ctx.tenant);
  const greeting = text(form, "greeting");
  if (!greeting) back("behaviour", "The greeting is required.", form);
  if (!/record/i.test(greeting)) back("behaviour", "The greeting must tell the caller the call is recorded.", form);
  const transfer = text(form, "transfer_number");
  const transferE164 = transfer ? e164(transfer) : "";
  if (transfer && !transferE164) back("behaviour", "The transfer number does not look like a phone number.", form);
  await saveConfig(
    ctx.tenant.id,
    { behaviour: { ...c.behaviour, greeting, tone: text(form, "tone") === "friendly" ? "friendly" : "calm", cannotHelp: text(form, "cannot_help") || c.behaviour.cannotHelp, transferNumber: transferE164 || "", takeMessageWhenUnanswered: form.get("take_message") === "on" } },
    4,
  );
  if (text(form, "mode") === "settings") next(form, "behaviour");

  // This is the last step. Publish what they just described and open the
  // dashboard, where the test call is the obvious next thing to do. A
  // publish that fails must not trap them on the form; the console can
  // publish it for them.
  let notice = "Your assistant is ready. Call it and hear how it answers.";
  try {
    await provisionAgent(ctx.tenant.id);
    await goLive(ctx.tenant.id);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    notice = err instanceof Error ? `Saved, but the assistant could not be published: ${err.message}` : "Saved, but the assistant could not be published.";
  }
  redirect(`/app?ok=${encodeURIComponent(notice)}`);
}

/* 5 */
/* 6 */
export async function publishAgentAction(form: FormData): Promise<void> {
  const ctx = await requireTenant();
  const step = (text(form, "step") || "phone") as StepId;
  try {
    const r = await provisionAgent(ctx.tenant.id);
    const mode = text(form, "mode");
    // A published assistant is what the test call needs, so publishing unlocks it.
    if (mode !== "settings") await saveConfig(ctx.tenant.id, {}, 6);
    redirect(mode === "settings" ? `/app/settings?ok=${encodeURIComponent(`Assistant published, version ${r.version ?? "1"}.`)}` : `/app/setup/${step}?ok=${encodeURIComponent("Assistant published.")}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    back(step, err instanceof Error ? err.message : "Could not publish the assistant.", form);
  }
}

/* 7 */
/* 8 */
