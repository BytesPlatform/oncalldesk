/**
 * The record of what the agent did on a call.
 *
 * Two audiences. The pipeline table drives the live trace on screen during the
 * demo. The call_events and demo_calls tables are what the contractor reviews
 * on the monthly retainer, which is the part of this job that is a service
 * rather than a piece of software.
 */

import { q } from "./db";
import { jobTypeById } from "./config";
import { tenantId } from "./tenancy";

export type PipelineStatus = "running" | "ok" | "warn" | "error";

/** Fixed order, so the trace renders as a stable ladder. */
export const PIPELINE_STEPS = [
  "call_answered",
  "intent_classified",
  "urgency_triaged",
  "service_area_checked",
  "caller_qualified",
  "client_matched",
  "job_created",
  "technician_notified",
  "caller_confirmed",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export async function logPipeline(
  callId: string,
  step: PipelineStep | string,
  status: PipelineStatus,
  detail?: string,
  durationMs?: number,
): Promise<void> {
  await q(
    `insert into pipeline_events (tenant_id, call_id, step, status, detail, duration_ms)
     values ($6,$1,$2,$3,$4,$5)`,
    [callId, step, status, detail ?? null, durationMs ?? null, tenantId()],
  );
}

export async function logCallEvent(input: {
  callId: string;
  action: string;
  outcome: string;
  urgency?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  await q(
    `insert into call_events (tenant_id, call_id, action, outcome, urgency, detail)
     values ($6,$1,$2,$3,$4,$5)`,
    [
      input.callId,
      input.action,
      input.outcome,
      input.urgency ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
      tenantId(),
    ],
  );
}

export async function touchCall(
  callId: string,
  args: { channel?: "web" | "phone"; fromNumber?: string; afterHours?: boolean } = {},
): Promise<void> {
  await q(
    `insert into demo_calls (tenant_id, call_id, channel, from_number, after_hours)
     values ($5,$1,$2,$3,$4)
     on conflict (call_id) do nothing`,
    [callId, args.channel ?? "web", args.fromNumber ?? null, args.afterHours ?? false, tenantId()],
  );
}

export async function setCallUrgency(callId: string, urgency: string): Promise<void> {
  await q(`update demo_calls set urgency = $2 where call_id = $1 and tenant_id = $3`, [callId, urgency, tenantId()]);
}

/**
 * Records the booking and the ticket value it represents. The revenue panel
 * sums these, which is the number the owner actually cares about.
 */
export async function markBooked(callId: string, jobTypeId: string): Promise<void> {
  const ticket = jobTypeById(jobTypeId)?.typicalTicket ?? 0;
  await q(`update demo_calls set booked = true, ticket_value = $2 where call_id = $1 and tenant_id = $3`, [
    callId,
    ticket,
    tenantId(),
  ]);
}

export async function closeCall(callId: string, outcome: string, summary?: string): Promise<void> {
  await q(
    `update demo_calls set ended_at = now(), outcome = $2, summary = coalesce($3, summary)
     where call_id = $1 and tenant_id = $4`,
    [callId, outcome, summary ?? null, tenantId()],
  );
}

/** The words and the audio, from Retell's post-call webhook. */
export async function saveCallMedia(callId: string, media: { transcript?: string | null; recordingUrl?: string | null }): Promise<void> {
  await q(
    `update demo_calls set transcript = coalesce($2, transcript), recording_url = coalesce($3, recording_url)
     where call_id = $1 and tenant_id = $4`,
    [callId, media.transcript ?? null, media.recordingUrl ?? null, tenantId()],
  );
}
