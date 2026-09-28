import type { Metadata } from "next";
import { PRODUCT } from "@/lib/product";
import DemoForm from "../components/DemoForm";

export const metadata: Metadata = {
  title: `Book a demo | ${PRODUCT.name}`,
  description: `Twenty minutes on your own service area and hours. Leave your details and a person from ${PRODUCT.name} calls you within one business day.`,
  alternates: { canonical: "/book-a-demo" },
};

export default function BookADemo() {
  return (
    <main className="s-section">
      <div className="s-wrap">
        <div className="s-grid-2">
          <div>
            <p className="s-kicker">Book a demo</p>
            <h1 className="s-h2">Twenty minutes, on your own service area</h1>
            <p className="s-p">
              Leave your details and someone from our team calls you within one business day to set a time. On the
              call we configure the assistant with your towns, hours and on-call rota, and you phone it yourself.
            </p>
            <p className="s-p">
              Prefer to hear it first? The <a href="/#hear-it">recorded calls</a> are on the home page and the{" "}
              <a href="/demo">live demo</a> is open now.
            </p>
            <p className="s-small">
              We do not run a self-serve trial. Every customer starts with this call, so the assistant is set up right the
              first time.
            </p>
          </div>
          <div className="s-card">
            <DemoForm consentText={PRODUCT.consentText} productName={PRODUCT.name} />
          </div>
        </div>
      </div>
    </main>
  );
}
