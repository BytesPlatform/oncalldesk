import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `How it works | ${PRODUCT.name}`,
  description: `What ${PRODUCT.name} does on every call, step by step: answer, triage, check the service area, find the customer, book, notify, and hand over when it should.`,
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  ["Call answered", "Picks up before the second ring with your business name. No hold music, no menu. Says it is an assistant if asked."],
  ["Reason understood", "Asks what is going on and listens. A dead furnace, a noisy AC, a quote for a replacement, a question about an existing booking."],
  ["Urgency triaged", "Your rules, not a generic script. No heat in winter is an emergency; a tune-up is routine; a smell of gas gets the safety script and a transfer."],
  ["Service area checked", "The postcode or the town against the list of areas you cover. Out of area callers get a polite no and a message for you, never a booking."],
  ["Caller qualified", "The two or three questions your dispatcher asks first: is anyone at risk, is the system off, what kind of system is it."],
  ["Customer matched", "A known number is greeted by name. A new caller is set up once, with their address, so the technician has what they need."],
  ["Job created", "Offers up to three arrival windows that are genuinely open on your schedule, and writes the job with the caller's own words as the note."],
  ["Technician notified", "A real after-hours emergency pages whoever is on call with the address and the problem. Routine work waits for the morning dispatch."],
  ["Caller confirmed", "Reads the booking back, texts a confirmation when SMS is on, and ends the call. Every step is in the log you can read afterwards."],
];

export default function HowItWorks() {
  return (
    <main>
      <section className="s-section">
        <div className="s-wrap">
          <p className="s-kicker">How it works</p>
          <h1 className="s-h2">The same nine steps on every call</h1>
          <p className="s-lead">
            This is the ladder you watch fill in on the dashboard during a call. It is the same for a 2 a.m. emergency and a
            Tuesday tune-up; only the branches differ.
          </p>
          <div className="s-grid-3">
            {STEPS.map(([title, body], i) => (
              <div key={title} className="s-card">
                <span className="s-step-n">{i + 1}</span>
                <h3 className="s-h3">{title}</h3>
                <p className="s-p" style={{ margin: 0 }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section s-section-alt">
        <div className="s-wrap s-prose">
          <p className="s-kicker">Setup</p>
          <h2 className="s-h2">What we need from you</h2>
          <p>
            Onboarding is a guided setup inside the product and takes under an hour. You give it your business name and
            hours, the towns or postcodes you cover, your technicians and who carries the after-hours phone, and the
            services you offer. You choose what it says when it answers and what it must never do. Then you make a test
            call and forward your number.
          </p>
          <h2 className="s-h2">Forwarding your number</h2>
          <p>
            You keep your number. Forward it to the assistant's number always, after hours only, or only when nobody picks
            up in four rings. Most contractors start with after hours and widen it once they trust it.
          </p>
          <h2 className="s-h2">What you see</h2>
          <p>
            A dashboard with three numbers that matter (calls answered, jobs booked, revenue booked), the day's board, the
            list of calls with what happened on each, and the texts it sent. Technical detail sits behind an Advanced page
            for when you want it.
          </p>
          <div className="s-btn-row" style={{ marginTop: "1.5rem" }}>
            <a className="s-btn s-btn-primary" href="/book-a-demo">
              Book a demo
            </a>
            <a className="s-btn" href="/demo">
              Try the live demo
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
