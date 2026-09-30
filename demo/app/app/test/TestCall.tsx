"use client";

/**
 * Call your own assistant from the browser. The checklist ticks itself from
 * the pipeline steps the call produces, so a prospect can watch the thing
 * work rather than take our word for it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import CallPanel from "@/app/components/CallPanel";
import { useDemoState } from "@/app/hooks/useDemoState";
import { useRetellCall } from "@/app/hooks/useRetellCall";
import { saveChecklistAction } from "./actions";

const CHECKS: { key: string; label: string; steps: string[] }[] = [
  { key: "greeted", label: "It answered with your greeting", steps: ["call_answered"] },
  { key: "triaged", label: "It understood the problem and judged how urgent it was", steps: ["urgency_triaged"] },
  { key: "area", label: "It checked the postcode against your service area", steps: ["service_area_checked"] },
  { key: "customer", label: "It found or set up the customer", steps: ["client_matched"] },
  { key: "windows", label: "It offered arrival windows from your schedule", steps: ["caller_qualified"] },
  { key: "booked", label: "It booked the job", steps: ["job_created"] },
  { key: "notified", label: "It paged the on-call technician, or queued it for the morning", steps: ["technician_notified"] },
  { key: "confirmed", label: "It confirmed the booking to the caller", steps: ["caller_confirmed"] },
];

export default function TestCall({ companyName, saved }: { companyName: string; saved: Record<string, boolean> }) {
  const call = useRetellCall("app");
  const { state } = useDemoState(0, "app");
  const [ticks, setTicks] = useState<Record<string, boolean>>(saved);
  const lastSaved = useRef("");

  const done = useMemo(() => {
    const out: Record<string, boolean> = { ...ticks };
    if (call.callId) {
      const steps = new Set(state.pipeline.filter((r) => r.call_id === call.callId && (r.status === "ok" || r.status === "warn")).map((r) => r.step));
      for (const c of CHECKS) if (c.steps.some((s) => steps.has(s))) out[c.key] = true;
    }
    return out;
  }, [ticks, call.callId, state.pipeline]);

  useEffect(() => {
    if (!call.callId) return;
    const key = JSON.stringify(done);
    if (key === lastSaved.current) return;
    lastSaved.current = key;
    setTicks(done);
    void saveChecklistAction(call.callId, done);
  }, [done, call.callId]);

  const count = CHECKS.filter((c) => done[c.key]).length;

  return (
    <div className="setup-test">
      <div className="setup-test-call">
        <CallPanel
          phase={call.phase}
          isLive={call.isLive}
          configured={call.config?.retell.configured ?? false}
          scope="app"
          callId={call.callId}
          startedAt={call.startedAt}
          agentTalking={call.agentTalking}
          ringing={call.ringing}
          muted={call.muted}
          turns={call.turns}
          urgency={null}
          urgencyDetail={null}
          phoneNumber={call.config?.retell.phoneNumber ?? ""}
          companyName={companyName}
          error={call.error}
          endedReason={call.endedReason}
          onStart={() => void call.start()}
          onEnd={() => void call.end()}
          onToggleMute={call.toggleMute}
        />
      </div>
      <div className="admin-section">
        <h2 className="admin-title-sm">
          Checklist, {count} of {CHECKS.length}
        </h2>
        <p className="admin-help">
          Press Call and speak the way a customer would: "my furnace is dead and there's no heat", then give a postcode in
          your area, a name and a street. Each line ticks as the assistant does it.
        </p>
        <ul className="setup-checklist">
          {CHECKS.map((c) => (
            <li key={c.key} className={done[c.key] ? "is-done" : ""}>
              <span className="setup-tick" aria-hidden="true">
                {done[c.key] ? "✓" : ""}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
        <p className="admin-sub">Nothing from a test call is real: the booking lands on your board marked as made by the assistant, and you can delete it.</p>
      </div>
    </div>
  );
}
