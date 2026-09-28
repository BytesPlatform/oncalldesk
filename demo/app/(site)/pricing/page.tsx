import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";
import Pricing from "../components/Pricing";

export const metadata: Metadata = {
  title: `Pricing | ${PRODUCT.name}`,
  description: `${PRODUCT.name} plans from $${PRODUCT.plans[0].price} a month, priced by the minutes it talks. No setup fee, no contract longer than a month.`,
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <main>
      <section className="s-section">
        <div className="s-wrap">
          <p className="s-kicker">Pricing</p>
          <h1 className="s-h2">Priced by the minute it talks, not the seat</h1>
          <p className="s-lead">
            A typical service call lasts two to three minutes. Three hundred minutes is about a hundred calls a month;
            a thousand is a busy shop in heating season.
          </p>
          <Pricing />
        </div>
      </section>
      <section className="s-section s-section-alt">
        <div className="s-wrap s-prose">
          <h2 className="s-h2">What every plan includes</h2>
          <ul>
            <li>A dedicated number, or forwarding from yours, with after-hours or overflow rules.</li>
            <li>The dashboard, the call log with what happened on every call, and the daily summary email.</li>
            <li>Emergency paging to the on-call technician, with your own definition of emergency.</li>
            <li>A callback list for out-of-area and after-hours non-emergencies, worked in the morning.</li>
            <li>Onboarding with a person, and a test call before your number is forwarded.</li>
          </ul>
          <h2 className="s-h2">How minutes are counted</h2>
          <p>
            From the moment the assistant answers to the moment the call ends, rounded up to the next minute per call.
            Transfers to your desk stop the clock. Unused minutes do not roll over; overage is billed at $
            {PRODUCT.overagePerMinute.toFixed(2)} a minute on the next invoice. Usage is shown on your dashboard every day,
            so an overage is never a surprise.
          </p>
          <h2 className="s-h2">Invoicing</h2>
          <p>
            Monthly, by invoice from {PRODUCT.company}. No card required to start. Cancel by email and we forward your number
            back the same day.
          </p>
        </div>
      </section>
    </main>
  );
}
