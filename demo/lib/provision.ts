/**
 * Turning a customer's configuration into a working assistant.
 *
 * The demo flow and agent in retell/ are the templates. renderFlow() and
 * renderAgent() fill them from the tenant's configuration: the greeting,
 * the company facts in the global prompt, the transfer number, the webhook
 * host, the boosted keywords. provisionAgent() creates or updates the
 * conversation flow and the agent on Retell, publishes them, and records
 * the ids on the tenant, so the next tool call from that agent lands in the
 * right workspace. buyNumber() buys a number in the customer's area code
 * and binds it to the agent.
 *
 * Every Retell call goes through one function that takes the API key from
 * the environment; nothing here is reachable without a signed-in owner or
 * a platform admin.
 */

import { createHash } from "node:crypto";
import flowTemplate from "@/retell/demo-flow.json";
import agentTemplate from "@/retell/demo-agent.json";
import { q } from "./db";
import { PRODUCT } from "./product";
import { getTenant, updateTenant, type Tenant } from "./tenancy";
import { configOf, hoursSummary, readiness, serviceAreaSummary, servicesSummary, type TenantConfig } from "./tenant-config";

const BASE_URL = process.env.RETELL_BASE_URL ?? "https://api.retellai.com";
const DEFAULT_VOICE = process.env.RETELL_VOICE_ID || "cartesia-Cleo";

export class RetellError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export async function retell<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.RETELL_API_KEY;
  if (!key) throw new RetellError("RETELL_API_KEY is not set on this deployment");
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new RetellError(`Retell ${method} ${path} failed with ${res.status}: ${text.slice(0, 300)}`, res.status);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export function siteHost(): string {
  return PRODUCT.siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/* -------------------------------------------------------------- render */

function substituteAll(doc: unknown, values: Record<string, string>): any {
  let json = JSON.stringify(doc);
  for (const [tag, value] of Object.entries(values)) json = json.split(`<${tag}>`).join(value);
  return JSON.parse(json);
}

/** The company-facts half of the global prompt, rebuilt from the configuration. */
export function renderFacts(t: Tenant, c: TenantConfig): string {
  const afterHours =
    c.basics.afterHoursPolicy === "book"
      ? "Outside those hours this line is the after hours service line and an on call technician is carrying the phone. Emergencies are booked and the on call technician is paged; routine work is booked for the next open window."
      : "Outside those hours this line takes a message for the office and does not book or page anyone. Tell the caller the office will call back when it opens, and use take_message with reason callback_requested.";
  return [
    `COMPANY FACTS. Answer questions from this list and nothing else.`,
    ``,
    `Company: {{company_name}}. Office number {{callback_number}}.${c.basics.address ? ` Address: ${c.basics.address}.` : ""}${t.tagline ? ` ${t.tagline}.` : ""}`,
    ``,
    `Office hours: ${hoursSummary(c)} ${afterHours}`,
    ``,
    `Service area, these towns and postcodes only: ${serviceAreaSummary(c)}. Anything else is outside the area. Never decide this yourself, always let check_service_area decide.`,
    ``,
    `Work we take, and how long each one runs:`,
    servicesSummary(c),
    ``,
    `An estimate for a new system is never booked as a technician visit. It is logged for the team who handle replacements and they call the customer back to arrange it.`,
    ``,
    c.behaviour.cannotHelp ? `When you cannot help with something, say: "${c.behaviour.cannotHelp}"` : "",
    c.behaviour.tone === "friendly"
      ? `TONE: warm and friendly, first names, a little reassurance. Still brief.`
      : `TONE: calm and professional. Brief, plain sentences.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** The template's prompt with its demo facts block replaced by the tenant's. */
export function renderGlobalPrompt(t: Tenant, c: TenantConfig): string {
  const template = String((flowTemplate as { global_prompt: string }).global_prompt);
  const start = template.indexOf("COMPANY FACTS.");
  const end = template.indexOf("## Filling in the tools");
  const head = (start > 0 ? template.slice(0, start) : template)
    .replace("a heating and cooling contractor in the northwest suburbs of Chicago. It is heating season, so most callers are cold, worried, or both. This is a demonstration system with invented customers and it holds no real records.", `a business in ${PRODUCT.industry}.`)
    .replace("You are the automated after hours service line", "You are the automated service line");
  const tail = end > 0 ? template.slice(end) : "";
  return `${head}${renderFacts(t, c)}\n\n${tail}`;
}

export function renderFlow(t: Tenant, c: TenantConfig): Record<string, unknown> {
  const doc = substituteAll(flowTemplate, { DEMO_HOST: siteHost(), ...(c.behaviour.transferNumber ? { DISPATCH_E164: c.behaviour.transferNumber } : {}) });
  doc.global_prompt = renderGlobalPrompt(t, c);
  doc.default_dynamic_variables = {
    company_name: t.name,
    callback_number: c.basics.callbackNumber || t.main_number || "",
    dispatch_number: c.behaviour.transferNumber || "<DISPATCH_E164>",
  };
  for (const node of doc.nodes as { id: string; instruction?: { type: string; text: string } }[]) {
    if (node.id === "n_opening" && node.instruction?.type === "static_text") node.instruction.text = c.behaviour.greeting;
    if (node.id === "n_end" && node.instruction?.type === "static_text") node.instruction.text = `Thanks for calling ${t.name}. Goodbye.`;
  }
  return doc;
}

export function renderAgent(t: Tenant, c: TenantConfig, flowId: string): Record<string, unknown> {
  const doc = substituteAll(agentTemplate, { DEMO_HOST: siteHost(), CONVERSATION_FLOW_ID: flowId, VOICE_ID: c.agent.voiceId || DEFAULT_VOICE });
  doc.agent_name = `${PRODUCT.name}: ${t.name}`;
  const towns = [...new Set(c.serviceArea.map((s) => s.town))];
  const base = (agentTemplate as { boosted_keywords?: string[] }).boosted_keywords ?? [];
  const generic = base.filter((k) => !/^[A-Z]/.test(k) || /^(HVAC|AC)$/.test(k));
  doc.boosted_keywords = [...new Set([...generic, ...towns, t.short_name, ...c.technicians.map((x) => x.firstName)])].slice(0, 100);
  return doc;
}

export function renderedHash(flow: unknown, agent: unknown): string {
  return createHash("sha256").update(JSON.stringify([flow, agent])).digest("hex").slice(0, 16);
}

/* ------------------------------------------------------------ provision */

async function saveConfig(t: Tenant, patch: Record<string, unknown>): Promise<void> {
  await q(`update tenants set config = config || $2::jsonb, updated_at = now() where id = $1`, [t.id, JSON.stringify(patch)]);
}

export interface ProvisionResult {
  agentId: string;
  flowId: string;
  version: number | null;
  changed: boolean;
}

/** Creates or updates the tenant's flow and agent on Retell and publishes them. */
export async function provisionAgent(tenantId: string): Promise<ProvisionResult> {
  const t = await getTenant(tenantId);
  if (!t) throw new Error("tenant not found");
  const c = configOf(t);
  const ready = readiness(c);
  if (!ready.ok) throw new Error(`Not ready to publish: still missing ${ready.missing.join(", ")}.`);

  const flow = renderFlow(t, c);
  let flowId = c.agent.flowId;
  if (flowId) {
    await retell("PATCH", `/update-conversation-flow/${flowId}`, flow);
  } else {
    const res = await retell<{ conversation_flow_id: string }>("POST", "/create-conversation-flow", flow);
    flowId = res.conversation_flow_id;
  }

  const agent = renderAgent(t, c, flowId);
  let agentId = c.agent.agentId;
  let version: number | null = null;
  if (agentId) {
    const res = await retell<{ version?: number }>("PATCH", `/update-agent/${agentId}`, agent);
    version = res?.version ?? null;
  } else {
    const res = await retell<{ agent_id: string; version?: number }>("POST", "/create-agent", agent);
    agentId = res.agent_id;
    version = res?.version ?? null;
  }
  await retell("POST", `/publish-agent/${agentId}`);

  const hash = renderedHash(flow, agent);
  const changed = hash !== c.agent.renderedHash;
  await saveConfig(t, {
    agent: { ...c.agent, flowId, agentId, version, publishedAt: new Date().toISOString(), renderedHash: hash, voiceId: c.agent.voiceId || DEFAULT_VOICE },
  });
  await updateTenant(t.id, { retell_agent_id: agentId });
  return { agentId, flowId, version, changed };
}

/** True when the configuration has changed since the agent was last published. */
export function needsRepublish(t: Tenant): boolean {
  const c = configOf(t);
  if (!c.agent.agentId || !c.agent.flowId) return true;
  return renderedHash(renderFlow(t, c), renderAgent(t, c, c.agent.flowId)) !== c.agent.renderedHash;
}

/* ---------------------------------------------------------------- number */

export interface NumberResult {
  number: string;
  nickname: string;
}

/** Buys a number in the area code and binds it to the tenant's agent. */
export async function buyNumber(tenantId: string, areaCode: string): Promise<NumberResult> {
  const t = await getTenant(tenantId);
  if (!t) throw new Error("tenant not found");
  const c = configOf(t);
  if (!c.agent.agentId) throw new Error("Publish the assistant before buying a number.");
  const code = areaCode.replace(/\D/g, "").slice(0, 3);
  if (code.length !== 3) throw new Error("Area code must be three digits.");
  const nickname = `${PRODUCT.name}: ${t.name}`;
  const res = await retell<{ phone_number: string }>("POST", "/create-phone-number", {
    area_code: Number(code),
    inbound_agent_id: c.agent.agentId,
    nickname,
  });
  await saveConfig(t, { phone: { ...c.phone, mode: "buy", areaCode: code, number: res.phone_number } });
  await updateTenant(t.id, { phone_number: res.phone_number });
  return { number: res.phone_number, nickname };
}

export async function releaseNumber(tenantId: string): Promise<void> {
  const t = await getTenant(tenantId);
  if (!t) throw new Error("tenant not found");
  const c = configOf(t);
  if (!c.phone.number) return;
  await retell("DELETE", `/delete-phone-number/${encodeURIComponent(c.phone.number)}`);
  await saveConfig(t, { phone: { ...c.phone, number: "" } });
  await updateTenant(t.id, { phone_number: null });
}

/** Per-carrier forwarding instructions for customers keeping their own number. */
export function forwardingInstructions(carrier: string, target: string): string[] {
  const n = target.replace(/\D/g, "").replace(/^1/, "");
  const pretty = n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}` : target;
  const k = carrier.toLowerCase();
  if (k.includes("at&t") || k.includes("att")) return [`Dial *72, wait for the tone, then dial ${pretty}.`, `To send only unanswered calls: dial *92 then ${pretty}.`, `To stop forwarding: dial *73.`];
  if (k.includes("verizon")) return [`Dial *72${n} and press call; hang up after the confirmation.`, `To send only unanswered calls: *71${n}.`, `To stop forwarding: *73.`];
  if (k.includes("t-mobile") || k.includes("tmobile")) return [`Dial **21*${n}# and press call.`, `To send only unanswered calls: **61*${n}#.`, `To stop forwarding: ##21#.`];
  if (k.includes("comcast") || k.includes("xfinity") || k.includes("spectrum") || k.includes("cox")) return [`On your handset dial *72, wait for the tone, then dial ${pretty}.`, `Your provider's online account also has a Call Forwarding setting where you can enter ${pretty}.`, `To stop forwarding: dial *73.`];
  if (k.includes("ringcentral") || k.includes("voip") || k.includes("google voice") || k.includes("ooma") || k.includes("nextiva")) return [`In your phone system's admin, add ${pretty} as the forwarding destination for the main number, after-hours only or always.`, `Most systems call this "call handling" or "answering rules".`];
  return [`Most carriers forward with *72 followed by ${pretty}, and stop with *73.`, `If that does not work, your carrier's support line can switch it on in a minute.`];
}
