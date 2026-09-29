"use client";

/** The day board, live, with the same picker the desk uses. */

import { useState } from "react";
import DayPicker from "@/app/components/DayPicker";
import DispatchBoard from "@/app/components/DispatchBoard";
import { useDemoState } from "@/app/hooks/useDemoState";

export default function ScheduleClient() {
  const [dayOffset, setDayOffset] = useState(0);
  const { state } = useDemoState(dayOffset, "app");
  return (
    <section className="panel dash-board">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">Schedule</h2>
          <p className="panel-sub">The assistant's bookings carry an AI badge</p>
        </div>
        <DayPicker dayOffset={dayOffset} onChange={setDayOffset} />
      </header>
      <div className="panel-body">
        <DispatchBoard board={state.board} visits={state.visits} dayOffset={dayOffset} loaded={state.loaded} />
      </div>
    </section>
  );
}
