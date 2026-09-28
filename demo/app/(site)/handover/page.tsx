import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `When a person takes over | ${PRODUCT.name}`,
  description: `The rules ${PRODUCT.name} will not cross, and exactly what happens when a call needs a person: warm transfer, voicemail to task, callback queue, emergency page.`,
  alternates: { canonical: "/handover" },
};

export default function Handover() {
  return (
    <main className="s-section">
      <div className="s-wrap s-prose">
        <p className="s-kicker">When a person takes over</p>
        <h1 className="s-h2">It knows what it is not allowed to do</h1>
        <p>
          An assistant that tries to handle everything ends up promising things you cannot deliver. {PRODUCT.name} works
          inside rules you set, and when a call crosses one it hands over. These are the defaults; you change them in
          onboarding.
        </p>

        <h2 className="s-h2">The lines it will not cross</h2>
        <ul>
          {PRODUCT.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
          <li>Never gives safety advice beyond the script you approve. A smell of gas gets "leave the house and call the gas company", then a transfer.</li>
          <li>Never records a call without the disclosure your state requires; the opening line carries it.</li>
        </ul>

        <h2 className="s-h2">The four ways a call reaches a person</h2>
        <h3>Warm transfer</h3>
        <p>
          During office hours, a caller who asks for a person, or a call the assistant cannot place, is transferred to your
          desk with a one-line summary spoken first, so nobody repeats themselves.
        </p>
        <h3>Emergency page</h3>
        <p>
          After hours, a genuine emergency by your definition (no heat below a temperature you set, no cooling for a
          vulnerable household, a leak, a gas smell) is booked into the first window and the on-call technician is texted
          the address and the problem. Nothing else wakes them.
        </p>
        <h3>Callback queue</h3>
        <p>
          Out-of-area callers, non-urgent after-hours calls, and anyone who would rather wait for a person get a callback
          promise. The message lands in a list your office works in the morning, with the caller's own words.
        </p>
        <h3>Voicemail to task</h3>
        <p>
          If a transfer is not answered, the assistant takes a message and creates a task instead of dropping the caller
          into a voicemail box nobody checks.
        </p>

        <h2 className="s-h2">What you can read afterwards</h2>
        <p>
          Every call has a transcript and a step-by-step log of what the assistant checked and decided. If it ever gets
          one wrong, you can see exactly where, and change the rule.
        </p>
      </div>
    </main>
  );
}
