/**
 * The step forms. Server components; each renders one step's fields from
 * the tenant's configuration and posts to its action. Used by the setup
 * flow (mode "setup") and by Settings (mode "settings"), where every form
 * shows at once and saving re-publishes the assistant.
 */
import { PRODUCT } from "@/lib/product";
import { forwardingInstructions, needsRepublish } from "@/lib/provision";
import type { Tenant } from "@/lib/tenancy";
import { DAY_KEYS, DAY_NAMES, configOf, readiness, type DayKey } from "@/lib/tenant-config";
import {
  buyNumberAction,
  forwardNumberAction,
  publishAgentAction,
  releaseNumberAction,
  saveAccountAction,
  saveBehaviourAction,
  saveBusinessAction,
  saveServicesAction,
  saveSoftwareAction,
} from "./actions";

export type Mode = "setup" | "settings";

function Submit({ mode, label }: { mode: Mode; label?: string }) {
  return (
    <div className="admin-actions">
      <button className="btn btn-cta" type="submit">
        {label ?? (mode === "setup" ? "Save and continue" : "Save")}
      </button>
    </div>
  );
}

export function AccountForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveAccountAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field">
        <span>Business name, as the assistant will say it</span>
        <input name="name" defaultValue={tenant.name} required />
      </label>
      <label className="admin-field">
        <span>Short name, for texts</span>
        <input name="short_name" defaultValue={tenant.short_name} />
      </label>
      <label className="admin-field">
        <span>Time zone</span>
        <select name="timezone" defaultValue={c.basics.timezone}>
          {["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"].map((z) => (
            <option key={z} value={z}>
              {z.replace("America/", "").replace("Pacific/", "").replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Website</span>
        <input name="website" defaultValue={c.basics.website} placeholder="https://" />
      </label>
      {mode === "setup" ? (
        <>
          <div className="admin-divider" />
          <p className="admin-help" style={{ gridColumn: "1 / -1" }}>
            Invite someone else who should see the dashboard, for example your dispatcher. Optional; you can add people
            later under Settings.
          </p>
          <label className="admin-field">
            <span>Their name</span>
            <input name="invite_name" />
          </label>
          <label className="admin-field">
            <span>Their email</span>
            <input name="invite_email" type="email" />
          </label>
        </>
      ) : null}
      <Submit mode={mode} />
    </form>
  );
}

export function BusinessForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveBusinessAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field admin-field-wide">
        <span>Business address, for the assistant to confirm when asked</span>
        <input name="address" defaultValue={c.basics.address} placeholder="812 North Dunton Avenue, Arlington Heights, IL 60004" />
      </label>
      <label className="admin-field">
        <span>The phone number the assistant gives out</span>
        <input name="callback_number" defaultValue={c.basics.callbackNumber} required placeholder="(847) 555-0100" />
      </label>
      <label className="admin-field">
        <span>Outside office hours the assistant should</span>
        <select name="after_hours" defaultValue={c.basics.afterHoursPolicy}>
          <option value="book">Answer, book emergencies and page the on-call technician</option>
          <option value="message">Answer and take a message for the morning</option>
        </select>
      </label>
      <div className="admin-field-wide">
        <span className="admin-field" style={{ display: "block", marginBottom: "0.4rem" }}>
          Office hours
        </span>
        <table className="admin-table setup-hours">
          <tbody>
            {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DayKey[]).map((d) => {
              const h = c.basics.hours[d];
              return (
                <tr key={d}>
                  <td>{DAY_NAMES[d]}</td>
                  <td>
                    <input type="time" name={`open_${d}`} defaultValue={h?.open ?? "08:00"} />
                  </td>
                  <td>to</td>
                  <td>
                    <input type="time" name={`close_${d}`} defaultValue={h?.close ?? "17:00"} />
                  </td>
                  <td>
                    <label className="admin-check">
                      <input type="checkbox" name={`closed_${d}`} defaultChecked={!h} />
                      <span>Closed</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="admin-field admin-field-wide">
        <span>Holidays, one date per line as YYYY-MM-DD. The assistant treats them as closed days.</span>
        <textarea name="holidays" rows={2} defaultValue={c.basics.holidays.join("\n")} />
      </label>
      <Submit mode={mode} />
    </form>
  );
}

export function ServicesForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveServicesAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field admin-field-wide">
        <span>
          Services, one per line: <code className="admin-code">name | minutes | urgency | skill | typical ticket $</code>. Urgency is emergency, urgent, routine or quote. The assistant never quotes the ticket; the dashboard uses it for the revenue figure.
        </span>
        <textarea name="services" rows={8} defaultValue={c.services.map((s) => `${s.name} | ${s.minutes} | ${s.urgency} | ${s.skill} | ${s.typicalTicket}`).join("\n")} />
      </label>
      <label className="admin-field admin-field-wide">
        <span>
          Service area, one per line: <code className="admin-code">postcode town</code>. Callers outside it get a polite no and a message for you.
        </span>
        <textarea name="service_area" rows={6} defaultValue={c.serviceArea.map((s) => `${s.zip} ${s.town}`).join("\n")} />
      </label>
      <label className="admin-field admin-field-wide">
        <span>
          Technicians, one per line: <code className="admin-code">name | skills | on-call days</code>. Skills match the service skill column (furnace, ac, install, any). On-call days are the days that person carries the after-hours phone, for example Mon, Thu.
        </span>
        <textarea
          name="technicians"
          rows={5}
          defaultValue={c.technicians.map((t) => `${t.name} | ${t.skills.join(", ")} | ${t.onCallDays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`).join("\n")}
        />
      </label>
      <p className="admin-help admin-field-wide">The price rule is fixed: the assistant never quotes a price, a rate or a call-out fee. It books the visit and says the technician prices the work on site.</p>
      <Submit mode={mode} />
    </form>
  );
}

export function BehaviourForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveBehaviourAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field admin-field-wide">
        <span>Greeting. It must tell the caller the call is recorded; the wording below is fine in every state.</span>
        <textarea name="greeting" rows={3} defaultValue={c.behaviour.greeting} required />
      </label>
      <label className="admin-field">
        <span>Tone</span>
        <select name="tone" defaultValue={c.behaviour.tone}>
          <option value="calm">Calm and professional</option>
          <option value="friendly">Warm and friendly</option>
        </select>
      </label>
      <label className="admin-field">
        <span>Transfer number for "I want to speak to a person"</span>
        <input name="transfer_number" defaultValue={c.behaviour.transferNumber} placeholder="Your office or dispatcher's mobile" />
      </label>
      <label className="admin-field admin-field-wide">
        <span>What it says when it cannot help</span>
        <input name="cannot_help" defaultValue={c.behaviour.cannotHelp} />
      </label>
      <label className="admin-check admin-field-wide">
        <input type="checkbox" name="take_message" defaultChecked={c.behaviour.takeMessageWhenUnanswered} />
        <span>If the transfer is not answered, take a message and create a task instead of dropping the caller into voicemail</span>
      </label>
      <Submit mode={mode} />
    </form>
  );
}

export function SoftwareForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  return (
    <form action={saveSoftwareAction} className="admin-form">
      <input type="hidden" name="mode" value={mode} />
      <label className="admin-field">
        <span>Calendar</span>
        <select name="calendar" defaultValue={c.software.calendar}>
          <option value="builtin">The built-in schedule (works today)</option>
          <option value="google">Google Calendar (our team connects it with you)</option>
          <option value="microsoft">Microsoft 365 (our team connects it with you)</option>
        </select>
      </label>
      <label className="admin-field">
        <span>Field service software</span>
        <select name="field_software" defaultValue={c.software.fieldSoftware}>
          <option value="none">None, use the built-in schedule</option>
          <option value="jobber">Jobber (our team connects it with you)</option>
          <option value="housecall">Housecall Pro (on request)</option>
          <option value="servicetitan">ServiceTitan (on request)</option>
        </select>
      </label>
      <label className="admin-field admin-field-wide">
        <span>Anything we should know about your setup</span>
        <textarea name="note" rows={2} defaultValue={c.software.note} placeholder="We use Jobber for invoicing but the schedule lives on a whiteboard..." />
      </label>
      <p className="admin-help admin-field-wide">
        Everything works on the built-in schedule from day one. Choosing a connection here tells our team to set it up with you; nothing changes until they do.
      </p>
      <Submit mode={mode} />
    </form>
  );
}

export function PhoneForm({ tenant, mode }: { tenant: Tenant; mode: Mode }) {
  const c = configOf(tenant);
  const ready = readiness(c);
  const published = Boolean(c.agent.agentId);
  const stale = published && needsRepublish(tenant);
  return (
    <div className="setup-stack">
      <section className="admin-section">
        <h2 className="admin-title-sm">1. Publish the assistant</h2>
        {ready.ok ? (
          <p className="admin-help">
            {published
              ? stale
                ? "Your configuration changed since the assistant was last published. Publish again so the next call uses it."
                : `Published${c.agent.publishedAt ? ` ${new Date(c.agent.publishedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}. It answers with your greeting, hours, service area, services and team.`
              : "This turns everything you entered into your assistant. It takes a few seconds."}
          </p>
        ) : (
          <p className="admin-warn">Still missing: {ready.missing.join(", ")}. Go back and fill those in first.</p>
        )}
        <form action={publishAgentAction}>
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="step" value="phone" />
          <div className="admin-actions">
            <button className={`btn ${published && !stale ? "btn-quiet" : "btn-cta"}`} type="submit" disabled={!ready.ok}>
              {published ? "Publish again" : "Publish the assistant"}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section">
        <h2 className="admin-title-sm">2. A number for it to answer</h2>
        {c.phone.number ? (
          <>
            <p className="admin-help">
              Your assistant answers on <strong>{c.phone.number}</strong>. Call it from your mobile to hear it.
            </p>
            {mode === "settings" ? (
              <form action={releaseNumberAction}>
                <div className="admin-actions">
                  <button className="btn btn-quiet" type="submit">
                    Release this number
                  </button>
                </div>
              </form>
            ) : null}
          </>
        ) : (
          <>
            <p className="admin-help">
              We buy a local number in your area code and bind it to your assistant. About $2 a month, included in your plan. You can keep your existing number and forward it to this one; the carrier steps are below.
            </p>
            <form action={buyNumberAction} className="admin-form admin-form-inline">
              <label className="admin-field">
                <span>Area code</span>
                <input name="area_code" defaultValue={c.phone.areaCode || (c.basics.callbackNumber.replace(/\D/g, "").replace(/^1/, "").slice(0, 3))} maxLength={3} placeholder="847" />
              </label>
              <div className="admin-actions">
                <button className="btn btn-cta" type="submit" disabled={!published}>
                  Buy the number
                </button>
              </div>
            </form>
            {!published ? <p className="admin-sub">Publish the assistant first.</p> : null}
          </>
        )}
      </section>

      <section className="admin-section">
        <h2 className="admin-title-sm">3. Keeping your existing number</h2>
        <p className="admin-help">
          Most businesses keep their number and forward it: always, after hours only, or when nobody picks up. Tell us the number and the carrier and we show the exact steps.
        </p>
        <form action={forwardNumberAction} className="admin-form admin-form-inline">
          <label className="admin-field">
            <span>Your current business number</span>
            <input name="existing_number" defaultValue={c.phone.existingNumber} placeholder="(847) 555-0100" />
          </label>
          <label className="admin-field">
            <span>Carrier or phone system</span>
            <input name="carrier" defaultValue={c.phone.carrier} placeholder="AT&T, Verizon, Comcast, RingCentral..." />
          </label>
          <div className="admin-actions">
            <button className="btn btn-quiet" type="submit">
              Show the steps
            </button>
          </div>
        </form>
        {c.phone.mode === "forward" && c.phone.number ? (
          <ol className="setup-steps-list">
            {forwardingInstructions(c.phone.carrier, c.phone.number).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : c.phone.mode === "forward" ? (
          <p className="admin-sub">Buy the number above first; the forwarding steps need it.</p>
        ) : null}
        <p className="admin-sub">Text messages to your customers come from a separate number and are switched on by our team once carrier registration clears. Consent is already being collected on every call.</p>
      </section>

      {mode === "setup" ? (
        <div className="admin-actions">
          <a className={`btn ${c.phone.number || c.phone.mode === "forward" ? "btn-cta" : "btn-quiet"}`} href="/app/setup/test">
            Continue to the test call
          </a>
        </div>
      ) : null}
      <p className="admin-sub">{PRODUCT.name} numbers are provided through Retell.</p>
    </div>
  );
}
