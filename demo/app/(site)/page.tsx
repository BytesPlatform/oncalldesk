/**
 * The home page. Result first, then the recorded calls, then how it works,
 * the handover rules, pricing and a short FAQ. Every button leads to a
 * conversation with us or to the live demo, never to a sign-up form.
 */
import { PRODUCT } from "@/lib/product";
import { RECORDINGS } from "@/lib/recordings";
import HearIt from "./components/HearIt";
import Pricing from "./components/Pricing";

export default function Home() {
  const first = RECORDINGS[0];
  return (
    <main>
      <section className="s-hero">
        <div className="s-wrap">
          <div>
            <p className="s-kicker">AI receptionist for {PRODUCT.industry}</p>
            <h1 className="s-h1">{PRODUCT.headline}</h1>
            <p className="s-lead">{PRODUCT.subhead}</p>
            <div className="s-btn-row">
              <a className="s-btn s-btn-primary" href="#hear-it">
                Hear it
              </a>
              <a className="s-btn" href="/book-a-demo">
                Book a demo
              </a>
            </div>
            <div className="s-hero-proof" aria-label="What it does">
              <div className="s-proof">
                <span className="s-proof-n">24/7</span>
                <span className="s-proof-l">answers every call</span>
              </div>
              <div className="s-proof">
                <span className="s-proof-n">&lt; 1 s</span>
                <span className="s-proof-l">to pick up, no hold music</span>
              </div>
              <div className="s-proof">
                <span className="s-proof-n">1 page</span>
                <span className="s-proof-l">to your on-call tech, only when it matters</span>
              </div>
            </div>
          </div>

          <aside className="s-call" aria-label="Example call">
            <div className="s-call-head">
              <span className="s-call-dot" aria-hidden="true" />
              <div>
                <div className="s-call-title">Tuesday, 2:07 a.m.</div>
                <div className="s-call-sub">Inbound, after hours</div>
              </div>
            </div>
            <div className="s-bubbles">
              {first.transcript.slice(0, 5).map((line, i) => (
                <div key={i} className={`s-bubble ${line.who === "agent" ? "s-bubble-agent" : "s-bubble-caller"}`}>
                  {line.text}
                </div>
              ))}
            </div>
            <div className="s-call-foot">
              <span className="s-pill">Booked, tech paged</span>
              <span className="s-small">40 seconds</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="s-section s-section-alt" id="hear-it">
        <div className="s-wrap">
          <p className="s-kicker">Hear it</p>
          <h2 className="s-h2">This is what your customers will hear</h2>
          <p className="s-p">
            Real scenario, the assistant answering as a fictional contractor. Press play, then read the transcript to see
            what it checked before it booked.
          </p>
          <HearIt recordings={RECORDINGS} />
          <p className="s-note">
            Want to speak to it yourself? The{" "}
            <a href="/demo">live demo</a> answers in your browser, no signup.
          </p>
        </div>
      </section>

      <section className="s-section">
        <div className="s-wrap">
          <p className="s-kicker">How it works</p>
          <h2 className="s-h2">Answers, books, hands over</h2>
          <div className="s-grid-3">
            <div className="s-card">
              <span className="s-step-n">1</span>
              <h3 className="s-h3">It answers</h3>
              <p className="s-p">
                Every call, day or night, with your business name. It asks what is wrong and works out whether it is an
                emergency, a routine visit or an estimate.
              </p>
            </div>
            <div className="s-card">
              <span className="s-step-n">2</span>
              <h3 className="s-h3">It books</h3>
              <p className="s-p">
                It checks your service area, finds the customer or sets them up, offers arrival windows that are actually
                open, and writes the job to your schedule and to {PRODUCT.integration.name}.
              </p>
            </div>
            <div className="s-card">
              <span className="s-step-n">3</span>
              <h3 className="s-h3">It hands over</h3>
              <p className="s-p">
                A genuine after-hours emergency pages your on-call technician. Anything it should not handle goes to a
                person, or into a callback list for the morning.
              </p>
            </div>
          </div>
          <p style={{ marginTop: "1.5rem" }}>
            <a className="s-btn" href="/how-it-works">
              The full walk-through
            </a>
          </p>
        </div>
      </section>

      <section className="s-section s-section-alt">
        <div className="s-wrap">
          <div className="s-grid-2">
            <div>
              <p className="s-kicker">When a person takes over</p>
              <h2 className="s-h2">It knows what it is not allowed to do</h2>
              <p className="s-p">
                The assistant works inside rules you set. When a call crosses one, it transfers to your desk, takes a
                message with a callback promise, or pages the on-call tech. It never bluffs.
              </p>
              <a className="s-btn" href="/handover">
                Read the handover rules
              </a>
            </div>
            <div className="s-card">
              {PRODUCT.rules.map((rule) => (
                <p key={rule} className="s-rule">
                  <span className="s-rule-x" aria-hidden="true">
                    ×
                  </span>
                  <span>{rule}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="s-section" id="pricing">
        <div className="s-wrap">
          <p className="s-kicker">Pricing</p>
          <h2 className="s-h2">Priced by the minute it talks, not the seat</h2>
          <Pricing />
        </div>
      </section>

      <section className="s-section s-section-alt">
        <div className="s-wrap">
          <p className="s-kicker">Questions</p>
          <h2 className="s-h2">The ones every contractor asks</h2>
          <div className="s-faq">
            <details>
              <summary>Does it replace my dispatcher?</summary>
              <p>
                No. It answers the phone so your dispatcher does not have to, and it books into the same schedule. Your
                dispatcher sees every booking with a note on what the caller said, and takes over any call that needs a
                person.
              </p>
            </details>
            <details>
              <summary>What if the internet is down?</summary>
              <p>
                The assistant runs in the cloud, not in your office. If your office is offline, calls still get answered
                and booked; you see them when you are back. If our side were ever down, calls fall through to the number
                you choose, usually your mobile.
              </p>
            </details>
            <details>
              <summary>Will it quote prices?</summary>
              <p>
                Never. It books a diagnostic or estimate visit and says the technician will price the work on site. You
                can give it a call-out fee to state if you want, and nothing else.
              </p>
            </details>
            <details>
              <summary>How do I cancel?</summary>
              <p>Month to month. Tell us and we forward your number back the same day.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="s-cta">
        <div className="s-wrap">
          <h2 className="s-h2">See it on your own service area</h2>
          <p className="s-p">
            The demo call takes twenty minutes. We set it up with your towns, your hours and your on-call rota, then you
            call it.
          </p>
          <div className="s-btn-row">
            <a className="s-btn s-btn-primary" href="/book-a-demo">
              Book a demo
            </a>
            <a className="s-btn" href="/demo">
              Try the live demo now
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
