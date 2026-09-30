/**
 * What onboarding collects, and how the rest of the product reads it.
 *
 * Everything a customer tells us lives in tenants.config as one JSON
 * document, typed here. cfg() returns the effective configuration for the
 * tenant in scope: the customer's answers merged over the product defaults
 * in config.ts, which is also exactly what the demo tenant runs on. The
 * tools, the board, the state route and the agent renderer all read from
 * cfg(), so a change made in onboarding or Settings is what the assistant
 * does on the next call.
 *
 * Product-specific by design: steps 3 and 4 differ per product.
 */

import {
  BUSINESS_HOURS,
  COMPANY,
  JOB_TYPES,
  NEAR_MISS_ZIPS,
  SERVICE_AREA,
  TECHNICIANS,
  type JobType,
  type Technician,
} from "./config";
import { tenant, tenantInScope, type Tenant } from "./tenancy";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DAY_NAMES: Record<DayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

/** "07:00" to "17:00", or null when closed that day. */
export type DayHours = { open: string; close: string } | null;

export const ONBOARDING_STEPS = [
  { id: "account", title: "Account", blurb: "Your business name, time zone and who else needs access." },
  { id: "business", title: "Business basics", blurb: "Address, the number the assistant gives out, hours and the after-hours policy." },
  { id: "services", title: "What you do", blurb: "Services and how urgent each one is, the area you cover, your technicians and the on-call rota." },
  { id: "behaviour", title: "How it should behave", blurb: "The greeting, the tone, what it says when it cannot help, and where to transfer." },
] as const;

export type StepId = (typeof ONBOARDING_STEPS)[number]["id"];

export interface TenantConfig {
  onboarding: {
    /** Highest step reached, 0 to 8. 8 means complete. */
    step: number;
    startedAt: string | null;
    completedAt: string | null;
    /** The test-call checklist, keyed by pipeline step. */
    checklist: Record<string, boolean>;
    /** The call id the test was made with. */
    testCallId: string | null;
  };
  basics: {
    address: string;
    website: string;
    timezone: string;
    /** The number the assistant reads out for callbacks. */
    callbackNumber: string;
    hours: Record<DayKey, DayHours>;
    /** Dates as YYYY-MM-DD. Closed all day. */
    holidays: string[];
    /** What happens outside hours: book emergencies and page the on-call tech, or only take messages. */
    afterHoursPolicy: "book" | "message";
  };
  services: JobType[];
  serviceArea: { zip: string; town: string }[];
  technicians: Technician[];
  behaviour: {
    greeting: string;
    tone: "calm" | "friendly";
    cannotHelp: string;
    /** E.164, where "speak to a person" goes. */
    transferNumber: string;
    takeMessageWhenUnanswered: boolean;
  };
  software: {
    calendar: "builtin" | "google" | "microsoft";
    fieldSoftware: "none" | "jobber" | "housecall" | "servicetitan";
    /** Anything the customer told us about their setup, for our team. */
    note: string;
  };
  phone: {
    mode: "buy" | "forward" | null;
    areaCode: string;
    /** The Retell number bound to the agent, E.164. */
    number: string;
    /** The customer's own number when forwarding. */
    existingNumber: string;
    carrier: string;
  };
  agent: {
    flowId: string | null;
    agentId: string | null;
    version: number | null;
    publishedAt: string | null;
    /** Hash of what was rendered, so Settings can tell whether a re-publish is needed. */
    renderedHash: string | null;
    voiceId: string | null;
  };
}

/**
 * The starting point for a new workspace. The business name is woven into
 * the greeting, because the first sentence a caller hears is the most
 * noticeable thing in a demo and it must never name someone else.
 */
export function defaultConfig(businessName: string = COMPANY.name): TenantConfig {
  const name = businessName;
  const weekday: DayHours = { open: pad(BUSINESS_HOURS.weekdayOpenHour), close: pad(BUSINESS_HOURS.weekdayCloseHour) };
  return {
    onboarding: { step: 0, startedAt: null, completedAt: null, checklist: {}, testCallId: null },
    basics: {
      address: "",
      website: "",
      timezone: COMPANY.timezone,
      callbackNumber: COMPANY.mainNumber,
      hours: {
        mon: weekday,
        tue: weekday,
        wed: weekday,
        thu: weekday,
        fri: weekday,
        sat: { open: pad(BUSINESS_HOURS.saturdayOpenHour), close: pad(BUSINESS_HOURS.saturdayCloseHour) },
        sun: BUSINESS_HOURS.sundayClosed ? null : weekday,
      },
      holidays: [],
      afterHoursPolicy: "book",
    },
    services: JOB_TYPES.map((j) => ({ ...j })),
    serviceArea: SERVICE_AREA.map((s) => ({ ...s })),
    technicians: TECHNICIANS.map((t) => ({ ...t, skills: [...t.skills], onCallDays: [...t.onCallDays] })),
    behaviour: {
      greeting: `Thanks for calling ${name}, this is the service line. This call is recorded. What's going on with your system?`,
      tone: "calm",
      cannotHelp: "I can't help with that one, but I'll make sure the office gets your message and calls you back.",
      transferNumber: "",
      takeMessageWhenUnanswered: true,
    },
    software: { calendar: "builtin", fieldSoftware: "none", note: "" },
    phone: { mode: null, areaCode: "", number: "", existingNumber: "", carrier: "" },
    agent: { flowId: null, agentId: null, version: null, publishedAt: null, renderedHash: null, voiceId: null },
  };
}

function pad(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Customer answers over defaults. Arrays are replaced whole, objects merged. */
export function mergeConfig(base: TenantConfig, patch: unknown): TenantConfig {
  if (!isObject(patch)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = (out as Record<string, unknown>)[k];
    out[k] = isObject(cur) && isObject(v) ? mergeConfig(cur as unknown as TenantConfig, v) : v;
  }
  return out as unknown as TenantConfig;
}

export function configOf(t: Tenant): TenantConfig {
  const c = mergeConfig(defaultConfig(t.name), t.config);
  // The tenant row is the source of truth for the two fields the console also edits.
  if (t.retell_agent_id && !c.agent.agentId) c.agent.agentId = t.retell_agent_id;
  if (t.phone_number && !c.phone.number) c.phone.number = t.phone_number;
  return c;
}

/** The effective configuration for the tenant in scope; product defaults when none. */
export function cfg(): TenantConfig {
  return tenantInScope() ? configOf(tenant()) : defaultConfig();
}

/* -------------------------------------------------------------- lookups */

export function technicianByIdFor(c: TenantConfig, id: string): Technician | undefined {
  return c.technicians.find((t) => t.id === id);
}

export function jobTypeByIdFor(c: TenantConfig, id: string): JobType | undefined {
  return c.services.find((j) => j.id === id);
}

export function inServiceAreaFor(c: TenantConfig, zip: string): { covered: boolean; town?: string; zip?: string } {
  const raw = String(zip ?? "").trim();
  const clean = raw.replace(/\D/g, "").slice(0, 5);
  if (clean.length === 5) {
    const hit = c.serviceArea.find((s) => s.zip === clean);
    if (hit) return { covered: true, town: hit.town, zip: hit.zip };
    const near = NEAR_MISS_ZIPS.find((s) => s.zip === clean);
    return { covered: false, town: near?.town, zip: clean };
  }
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (key.length >= 4) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
    const town = c.serviceArea.find((s) => norm(s.town) === key || norm(s.town).startsWith(key));
    if (town) return { covered: true, town: town.town, zip: town.zip };
    const near = NEAR_MISS_ZIPS.find((s) => norm(s.town).includes(key));
    if (near) return { covered: false, town: near.town };
  }
  return { covered: false };
}

/** Local weekday and hour in the tenant's time zone. */
export function localParts(when: Date, timezone: string): { day: number; hour: number; minute: number; date: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(when);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day: day < 0 ? when.getDay() : day, hour: Number(get("hour")) % 24, minute: Number(get("minute")), date: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    return { day: when.getDay(), hour: when.getHours(), minute: when.getMinutes(), date: when.toISOString().slice(0, 10) };
  }
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isAfterHoursFor(c: TenantConfig, when: Date = new Date()): boolean {
  if (process.env.DEMO_FORCE_AFTER_HOURS === "true") return true;
  if (process.env.DEMO_FORCE_AFTER_HOURS === "false") return false;
  const { day, hour, minute, date } = localParts(when, c.basics.timezone);
  if (c.basics.holidays.includes(date)) return true;
  const hours = c.basics.hours[DAY_KEYS[day]];
  if (!hours) return true;
  const now = hour * 60 + minute;
  return now < minutes(hours.open) || now >= minutes(hours.close);
}

export function onCallTechnicianFor(c: TenantConfig, when: Date = new Date()): Technician {
  const { day } = localParts(when, c.basics.timezone);
  return c.technicians.find((t) => t.onCallDays.includes(day)) ?? c.technicians[0];
}

/* ------------------------------------------------------ spoken summaries */

function speakTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "in the afternoon" : "in the morning";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const min = m ? `:${String(m).padStart(2, "0")}` : "";
  return h >= 18 ? `${hour12}${min} in the evening` : `${hour12}${min} ${suffix}`;
}

/** "Monday to Friday, 7 in the morning until 5 in the afternoon. Saturday, 8 ... Closed on Sunday." */
export function hoursSummary(c: TenantConfig): string {
  const order: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const groups: { days: DayKey[]; hours: DayHours }[] = [];
  for (const d of order) {
    const h = c.basics.hours[d];
    const last = groups[groups.length - 1];
    if (last && JSON.stringify(last.hours) === JSON.stringify(h)) last.days.push(d);
    else groups.push({ days: [d], hours: h });
  }
  return groups
    .map((g) => {
      const label = g.days.length > 1 ? `${DAY_NAMES[g.days[0]]} to ${DAY_NAMES[g.days[g.days.length - 1]]}` : DAY_NAMES[g.days[0]];
      return g.hours ? `${label}, ${speakTime(g.hours.open)} until ${speakTime(g.hours.close)}.` : `Closed on ${label}.`;
    })
    .join(" ");
}

export function serviceAreaSummary(c: TenantConfig): string {
  const byTown = new Map<string, string[]>();
  for (const s of c.serviceArea) byTown.set(s.town, [...(byTown.get(s.town) ?? []), s.zip]);
  return [...byTown.entries()].map(([town, zips]) => `${town} ${zips.join(" and ")}`).join(", ");
}

export function servicesSummary(c: TenantConfig): string {
  return c.services
    .map((s) => `- ${s.name}, ${s.minutes} minutes, ${s.urgency === "quote" ? "a sales visit, not a technician dispatch" : s.urgency}.`)
    .join("\n");
}

/** What is still missing before the assistant can go live, in the customer's words. */
export function readiness(c: TenantConfig): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!c.basics.callbackNumber.trim()) missing.push("the number the assistant gives out");
  if (!c.serviceArea.length) missing.push("at least one town or postcode in the service area");
  if (!c.services.length) missing.push("at least one service");
  if (!c.technicians.length) missing.push("at least one technician");
  if (!c.behaviour.greeting.trim()) missing.push("the greeting");
  if (!/record/i.test(c.behaviour.greeting)) missing.push("a recording notice in the greeting");
  return { ok: missing.length === 0, missing };
}

export function onboardingComplete(c: TenantConfig): boolean {
  return Boolean(c.onboarding.completedAt);
}
