/**
 * What the dashboard shows before the first real call: believable rows
 * marked "Example", so a new customer sees what the screens will hold.
 * They disappear on the first real event. Product-specific copy.
 */

import type { CallRow, NeedsYouItem, StatCard, UpcomingVisit } from "./dash";
import { dayStartUtc } from "./dash";

export interface ExampleHome {
  stats: StatCard[];
  needsYou: NeedsYouItem[];
  todaysCalls: CallRow[];
  upcoming: UpcomingVisit[];
}

function at(base: Date, hours: number, minutes = 0): string {
  return new Date(base.getTime() + (hours * 60 + minutes) * 60_000).toISOString();
}

export function exampleHome(tz: string): ExampleHome {
  const today = dayStartUtc(tz);
  const call = (n: number, row: Partial<CallRow>): CallRow => ({
    call_id: `example_${n}`,
    flagged: false,
    started_at: at(today, 8),
    ended_at: null,
    channel: "phone",
    from_number: null,
    urgency: null,
    outcome: "completed",
    after_hours: false,
    booked: false,
    ticket_value: null,
    summary: null,
    has_transcript: false,
    has_recording: false,
    ...row,
  });
  return {
    stats: [
      { label: "Calls today", today: 12, yesterday: 9 },
      { label: "Jobs booked", today: 7, yesterday: 5 },
      { label: "Urgent jobs", today: 2, yesterday: 1 },
    ],
    needsYou: [
      {
        kind: "callback",
        id: "ex_1",
        title: "Call back Marta G.",
        detail: "Out of the service area. Asked whether you still cover Elm Grove.",
        when: at(today, 9, 12),
        phone: "(847) 555-0119",
        canDone: false,
        callId: null,
      },
      {
        kind: "request",
        id: "ex_2",
        title: "Furnace replacement estimate",
        detail: "Twenty year old furnace, single family home, wants replacement pricing.",
        when: at(today, 8, 3),
        phone: null,
        canDone: false,
        callId: null,
      },
    ],
    todaysCalls: [
      call(1, {
        started_at: at(today, 2, 7),
        after_hours: true,
        urgency: "emergency",
        booked: true,
        ticket_value: 340,
        summary: "No heat, known customer. Booked the first morning window and paged the on-call technician.",
      }),
      call(2, {
        started_at: at(today, 9, 41),
        urgency: "routine",
        booked: true,
        ticket_value: 189,
        summary: "Annual tune-up for a new customer on Cedar Lane. Booked Thursday afternoon.",
      }),
      call(3, {
        started_at: at(today, 11, 26),
        urgency: "quote",
        summary: "Replacement quote request. Took the details and created an estimate request.",
      }),
    ],
    upcoming: [
      {
        id: "ex_v1",
        title: "No heat, emergency visit",
        starts_at: at(today, 32),
        ends_at: at(today, 33, 30),
        client_name: "Karen W.",
        worker_name: "Dave",
        urgency: "emergency",
        by_agent: true,
      },
      {
        id: "ex_v2",
        title: "Furnace tune-up",
        starts_at: at(today, 38),
        ends_at: at(today, 39),
        client_name: "Louis P.",
        worker_name: "Priya",
        urgency: "routine",
        by_agent: true,
      },
    ],
  };
}
