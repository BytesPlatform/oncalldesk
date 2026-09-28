import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `Integrations | ${PRODUCT.name}`,
  description: `${PRODUCT.name} writes bookings to ${PRODUCT.integration.name} and to its own calendar, texts customers through Twilio when SMS is on, and runs on Retell for voice.`,
  alternates: { canonical: "/integrations" },
};

export default function Integrations() {
  return (
    <main className="s-section">
      <div className="s-wrap s-prose">
        <p className="s-kicker">Integrations</p>
        <h1 className="s-h2">It writes to the tools you already run</h1>
        <p>
          The assistant has to put the job somewhere your team will see it. These are the places it can write to today,
          stated plainly.
        </p>
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>What it does</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{PRODUCT.integration.name}</td>
              <td>Finds and creates {PRODUCT.integration.what}, books visits into open windows, adds the call note.</td>
              <td>{PRODUCT.integration.status}</td>
            </tr>
            <tr>
              <td>Built-in calendar</td>
              <td>The dispatch board inside the product, for shops without field software.</td>
              <td>Included on every plan.</td>
            </tr>
            <tr>
              <td>Twilio (SMS)</td>
              <td>Confirmation texts to customers, pages to the on-call technician, STOP handling.</td>
              <td>Switched on per customer once carrier registration clears.</td>
            </tr>
            <tr>
              <td>Retell (voice)</td>
              <td>The phone line itself: numbers, call recording, transcripts.</td>
              <td>Included; you never deal with it directly.</td>
            </tr>
            <tr>
              <td>Email</td>
              <td>Daily summary, weekly report, missed-call alerts to the owner.</td>
              <td>Included.</td>
            </tr>
          </tbody>
        </table>
        <h2 className="s-h2">Something else?</h2>
        <p>
          Housecall Pro, ServiceTitan and Google Calendar are on the list. If your shop runs on something not named here,
          say so on the demo call; the booking step is built to be pointed at a new system without touching the rest.
        </p>
        <p>
          <a className="s-btn s-btn-primary" href="/book-a-demo">
            Book a demo
          </a>
        </p>
      </div>
    </main>
  );
}
