/**
 * The step forms. Server components; each renders one step's fields from
 * the tenant's configuration and posts to its action. Used by the setup
 * flow (mode "setup") and by Settings (mode "settings"), where every form
 * shows at once and saving re-publishes the assistant.
 */
import { PRODUCT } from "@/lib/product";
import { needsRepublish } from "@/lib/provision";
import type { Tenant } from "@/lib/tenancy";
import { DAY_KEYS, DAY_NAMES, configOf, type DayKey } from "@/lib/tenant-config";
import {
  saveAccountAction,
  saveBehaviourAction,
  saveBusinessAction,
  saveServicesAction,
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





/** The go-live summary, one row per thing the assistant now knows. */



