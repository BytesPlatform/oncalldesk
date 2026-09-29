/**
 * Outbound texts.
 *
 * Twilio is not connected yet, so every message is written to the database
 * with status queued and rendered on the phone mock up in the demo. The
 * conversation, the pipeline and the panel all behave exactly as they will
 * once Twilio is live, which means adding Twilio changes one function and
 * nothing else.
 *
 * To go live set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER.
 */

import { q } from "./db";
import { phoneHash } from "./retell";
import { tenantId } from "./tenancy";

export type MessageTarget = "caller" | "technician";

export type QueuedMessage = {
  id: number;
  to: string;
  label: MessageTarget;
  body: string;
  status: "queued" | "sent" | "failed" | "suppressed";
  provider: "preview" | "twilio";
};

/* ------------------------------------------------- consent and STOP */

/** The carrier keywords, per CTIA. Anything else is a normal reply. */
export function stopKeyword(body: string): "stop" | "start" | "help" | null {
  const word = body.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(word)) return "stop";
  if (["START", "YES", "UNSTOP"].includes(word)) return "start";
  if (word === "HELP") return "help";
  return null;
}

/**
 * One number, one hash: "(773) 555-0111" and "+17735550111" are the same
 * phone, so the US country code is dropped before hashing. Otherwise a
 * STOP recorded from Twilio's E.164 would not match the number we dial.
 */
function smsHash(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return phoneHash(digits);
}

export async function isSuppressed(phone: string): Promise<boolean> {
  const rows = await q<{ ok: number }>(
    `select 1 as ok from suppression_list where tenant_id = $1 and phone_hash = $2`,
    [tenantId(), smsHash(phone)],
  );
  return rows.length > 0;
}

/**
 * Records the consent event and keeps the suppression list in step: an
 * opt-out lands on the list, an opt-in takes the number off it.
 */
export async function recordSmsConsent(args: {
  phone: string;
  kind: "sms_opt_in" | "sms_opt_out";
  source: string;
  callId?: string;
}): Promise<void> {
  const hash = smsHash(args.phone);
  const last4 = args.phone.replace(/\D/g, "").slice(-4) || null;
  await q(
    `insert into consent_events (tenant_id, call_id, phone_hash, phone_last4, kind, source) values ($1,$2,$3,$4,$5,$6)`,
    [tenantId(), args.callId ?? null, hash, last4, args.kind, args.source],
  );
  if (args.kind === "sms_opt_out") {
    await q(
      `insert into suppression_list (tenant_id, phone_hash, source) values ($1,$2,$3)
       on conflict (tenant_id, phone_hash) do nothing`,
      [tenantId(), hash, args.source],
    );
  } else {
    await q(`delete from suppression_list where tenant_id = $1 and phone_hash = $2`, [tenantId(), hash]);
  }
}

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export function smsMode(): "preview" | "twilio" {
  return smsConfigured() ? "twilio" : "preview";
}

async function sendViaTwilio(to: string, body: string): Promise<{ sid: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const token = process.env.TWILIO_AUTH_TOKEN as string;
  const from = process.env.TWILIO_FROM_NUMBER as string;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );

  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Twilio returned ${res.status}`);
  return { sid: json.sid ?? "" };
}

/**
 * Queues a message, and sends it when Twilio is configured. Never throws into
 * the call: a text that fails must not take down the booking that earned it.
 */
export async function sendMessage(args: {
  callId?: string;
  to: string;
  label: MessageTarget;
  body: string;
}): Promise<QueuedMessage> {
  const provider = smsMode();

  // A number that replied STOP never gets another message, on any provider.
  if (args.label === "caller" && (await isSuppressed(args.to))) {
    const rows = await q<{ id: number }>(
      `insert into outbound_messages (tenant_id, call_id, to_number, to_label, body, provider, status, error)
       values ($6,$1,$2,$3,$4,$5,'suppressed','the number opted out') returning id`,
      [args.callId ?? null, args.to, args.label, args.body, provider, tenantId()],
    );
    return { id: rows[0]?.id ?? 0, to: args.to, label: args.label, body: args.body, status: "suppressed", provider };
  }

  const rows = await q<{ id: number }>(
    `insert into outbound_messages (tenant_id, call_id, to_number, to_label, body, provider, status)
     values ($6,$1,$2,$3,$4,$5,'queued') returning id`,
    [args.callId ?? null, args.to, args.label, args.body, provider, tenantId()],
  );
  const id = rows[0]?.id ?? 0;

  if (provider === "twilio") {
    try {
      const { sid } = await sendViaTwilio(args.to, args.body);
      await q(`update outbound_messages set status = 'sent', provider_id = $2 where id = $1`, [id, sid]);
      return { id, to: args.to, label: args.label, body: args.body, status: "sent", provider };
    } catch (err) {
      await q(`update outbound_messages set status = 'failed', error = $2 where id = $1`, [
        id,
        err instanceof Error ? err.message : "unknown error",
      ]);
      return { id, to: args.to, label: args.label, body: args.body, status: "failed", provider };
    }
  }

  return { id, to: args.to, label: args.label, body: args.body, status: "queued", provider };
}
