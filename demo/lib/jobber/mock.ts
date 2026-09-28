/**
 * Mock Jobber, backed by the demo database.
 *
 * It implements the same interface as the live client and behaves the same
 * way, including the rules that matter for the demo: a visit always belongs to
 * a job, clients are matched before being created, and open slots are computed
 * from what is already on the board rather than invented.
 *
 * The seeded board looks like a real contractor's week, so the dispatch panel
 * is full before anyone calls.
 */

import { q } from "../db";
import { tenantId } from "../tenancy";
import { ARRIVAL_WINDOW_MINUTES, DAY_END_HOUR, DAY_START_HOUR } from "../config";
import { cfg, isAfterHoursFor, jobTypeByIdFor, onCallTechnicianFor, technicianByIdFor } from "../tenant-config";

const isAfterHours = () => isAfterHoursFor(cfg());
const jobTypeById = (id: string) => jobTypeByIdFor(cfg(), id);
const onCallTechnician = () => onCallTechnicianFor(cfg());
const technicianById = (id: string) => technicianByIdFor(cfg(), id);
import type {
  CreateJobInput,
  CreateJobResult,
  CreateRequestInput,
  JobberClient,
  JobberClientInput,
  JobberGateway,
  OpenSlot,
  ScheduledVisit,
} from "./types";

const SPEAK_DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const SPEAK_HOUR = new Intl.DateTimeFormat("en-US", { hour: "numeric" });

/** "today between 4 and 6 with Mike" reads better than a precise minute. */
export function speakWindow(start: Date, technicianId: string): string {
  const tech = technicianById(technicianId);
  const end = new Date(start.getTime() + ARRIVAL_WINDOW_MINUTES * 60_000);

  const today = new Date();
  const sameDay = start.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60_000);
  const isTomorrow = start.toDateString() === tomorrow.toDateString();

  const day = sameDay ? "today" : isTomorrow ? "tomorrow" : SPEAK_DAY.format(start);
  const from = SPEAK_HOUR.format(start);
  const to = SPEAK_HOUR.format(end);

  return `${day} between ${from} and ${to} with ${tech?.firstName ?? "one of our technicians"}`;
}

export function encodeSlot(start: Date, technicianId: string, minutes: number): string {
  return [start.toISOString(), technicianId, String(minutes)].join("|");
}

export function decodeSlot(id: string) {
  const [iso, technicianId, minutes] = String(id ?? "").split("|");
  const start = new Date(iso);
  if (Number.isNaN(start.getTime()) || !technicianId) return null;
  return { start, technicianId, minutes: Number(minutes) || 90 };
}

export class MockJobber implements JobberGateway {
  readonly mode = "mock" as const;

  async findClientByPhone(phone: string): Promise<JobberClient | null> {
    const digits = String(phone ?? "").replace(/\D/g, "").slice(-10);
    // A placeholder number is not an identity. Matching on it handed one
    // browser caller another caller's record.
    if (digits.length < 10 || /^0{10}$/.test(digits)) return null;

    const rows = await q<{
      id: string;
      first_name: string;
      last_name: string;
      phone: string;
      property_id: string;
    }>(
      `select id, first_name, last_name, phone, property_id
       from demo_clients
       where tenant_id = $2 and right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $1
       limit 1`,
      [digits, tenantId()],
    );

    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      phone: r.phone,
      propertyId: r.property_id,
      existing: true,
    };
  }

  async findClientByName(args: { firstName: string; lastName?: string; street?: string }): Promise<JobberClient | null> {
    const first = String(args.firstName ?? "").trim().toLowerCase();
    if (!first) return null;
    const last = String(args.lastName ?? "").trim().toLowerCase();
    const street = String(args.street ?? "").trim().toLowerCase();

    const rows = await q<{ id: string; first_name: string; last_name: string; phone: string; property_id: string; street1: string }>(
      `select id, first_name, last_name, phone, property_id, street1 from demo_clients
       where tenant_id = $2 and lower(first_name) = $1 order by created_at desc`,
      [first, tenantId()],
    );
    const streetKey = street.replace(/[^a-z0-9]/g, "");
    const hit =
      rows.find((r) => last && r.last_name.toLowerCase() === last && (!streetKey || r.street1.toLowerCase().replace(/[^a-z0-9]/g, "").includes(streetKey.slice(0, 8)))) ??
      rows.find((r) => streetKey && r.street1.toLowerCase().replace(/[^a-z0-9]/g, "").includes(streetKey.slice(0, 8))) ??
      (rows.length === 1 ? rows[0] : null);
    if (!hit) return null;
    return { id: hit.id, firstName: hit.first_name, lastName: hit.last_name, phone: hit.phone, propertyId: hit.property_id, existing: true };
  }

  async findNextVisit(clientId: string): Promise<(ScheduledVisit & { jobTypeId: string }) | null> {
    const rows = await q<{
      id: string; job_id: string; title: string; starts_at: string; ends_at: string; technician_id: string;
      urgency: string; created_by_agent: boolean; first_name: string | null; last_name: string | null; job_type_id: string | null;
    }>(
      `select v.id, v.job_id, v.title, v.starts_at, v.ends_at, v.technician_id, v.urgency, v.created_by_agent,
              c.first_name, c.last_name, j.job_type_id
       from demo_visits v
       left join demo_clients c on c.id = v.client_id
       left join demo_jobs j on j.id = v.job_id
       where v.tenant_id = $2 and v.client_id = $1 and v.status <> 'cancelled' and v.ends_at > now()
       order by v.starts_at asc limit 1`,
      [clientId, tenantId()],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      jobId: r.job_id,
      title: r.title,
      startAt: new Date(r.starts_at).toISOString(),
      endAt: new Date(r.ends_at).toISOString(),
      assignedTechnicianId: r.technician_id,
      urgency: r.urgency,
      clientName: [r.first_name, r.last_name ? `${r.last_name[0]}.` : null].filter(Boolean).join(" ") || "Customer",
      createdByAgent: Boolean(r.created_by_agent),
      jobTypeId: r.job_type_id ?? "furnace_tuneup",
    };
  }

  async cancelVisit(visitId: string): Promise<void> {
    await q(`update demo_visits set status = 'cancelled' where id = $1 and tenant_id = $2`, [visitId, tenantId()]);
  }

  async createClient(input: JobberClientInput): Promise<JobberClient> {
    const existing =
      (await this.findClientByPhone(input.phone)) ??
      (await this.findClientByName({ firstName: input.firstName, lastName: input.lastName, street: input.address.street1 }));
    if (existing) return existing;

    const id = `cli_${Date.now().toString(36)}`;
    const propertyId = `prop_${Date.now().toString(36)}`;

    await q(
      `insert into demo_clients
         (id, first_name, last_name, phone, email, property_id,
          street1, city, province, postal_code, created_by_agent, tenant_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)`,
      [
        id,
        input.firstName,
        input.lastName,
        input.phone,
        input.email ?? null,
        propertyId,
        input.address.street1,
        input.address.city,
        input.address.province,
        input.address.postalCode,
        tenantId(),
      ],
    );

    return {
      id,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      propertyId,
      existing: false,
    };
  }

  async findOpenSlots(args: {
    fromDate: Date;
    days: number;
    minutes: number;
    skill: string;
    urgency: string;
  }): Promise<OpenSlot[]> {
    const from = new Date(args.fromDate);
    const to = new Date(from.getTime() + args.days * 24 * 60 * 60_000);

    const busy = await q<{ technician_id: string; starts_at: string; ends_at: string }>(
      `select technician_id, starts_at, ends_at from demo_visits
       where tenant_id = $3 and status <> 'cancelled' and starts_at between $1 and $2`,
      [from.toISOString(), to.toISOString(), tenantId()],
    );

    const taken = busy.map((b) => ({
      technicianId: b.technician_id,
      start: new Date(b.starts_at).getTime(),
      end: new Date(b.ends_at).getTime(),
    }));

    // An emergency may interrupt the on-call technician's evening, so the
    // search runs later into the day than a routine call would.
    const emergency = args.urgency === "emergency";
    const latestHour = emergency ? DAY_END_HOUR + 3 : DAY_END_HOUR;

    const technicians = cfg().technicians;
    let candidates = technicians.filter(
      (t) => args.skill === "any" || t.skills.includes(args.skill),
    );
    if (!candidates.length) candidates = [...technicians];

    // Out of hours an emergency goes to whoever is carrying the pager. The
    // rest of the crew is at home, so offering their names would be a lie and
    // would contradict the text message we are about to send.
    if (emergency && isAfterHours()) {
      candidates = [onCallTechnician()];
    }

    const slots: OpenSlot[] = [];

    for (let day = 0; day < args.days && slots.length < 3; day++) {
      const date = new Date(from);
      date.setDate(date.getDate() + day);
      if (date.getDay() === 0 && !emergency) continue;

      for (let hour = DAY_START_HOUR; hour < latestHour && slots.length < 3; hour++) {
        for (const minute of [0, 30]) {
          const start = new Date(date);
          start.setHours(hour, minute, 0, 0);
          if (start.getTime() < Date.now() + 30 * 60_000) continue;

          const end = new Date(start.getTime() + args.minutes * 60_000);

          const tech = candidates.find(
            (t) =>
              !taken.some(
                (b) =>
                  b.technicianId === t.id &&
                  start.getTime() < b.end &&
                  end.getTime() > b.start,
              ),
          );
          if (!tech) continue;

          slots.push({
            id: encodeSlot(start, tech.id, args.minutes),
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            technicianId: tech.id,
            say: speakWindow(start, tech.id),
          });

          taken.push({ technicianId: tech.id, start: start.getTime(), end: end.getTime() });
          if (slots.length >= 3) break;
        }
      }
    }

    return slots;
  }

  async createScheduledJob(input: CreateJobInput): Promise<CreateJobResult> {
    const jobId = `job_${Date.now().toString(36)}`;
    const visitId = `vis_${Date.now().toString(36)}`;
    const type = jobTypeById(input.jobTypeId);

    await q(
      `insert into demo_jobs
         (id, client_id, property_id, title, instructions, job_type_id, urgency, created_by_agent, tenant_id)
       values ($1,$2,$3,$4,$5,$6,$7,true,$8)`,
      [jobId, input.clientId, input.propertyId, input.title, input.instructions, input.jobTypeId, input.urgency, tenantId()],
    );

    await q(
      `insert into demo_visits
         (id, job_id, client_id, technician_id, title, starts_at, ends_at,
          urgency, status, created_by_agent, tenant_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',true,$9)`,
      [
        visitId,
        jobId,
        input.clientId,
        input.technicianId,
        type?.name ?? input.title,
        input.startAt.toISOString(),
        input.endAt.toISOString(),
        input.urgency,
        tenantId(),
      ],
    );

    return { jobId, visitId, say: speakWindow(input.startAt, input.technicianId) };
  }

  async createRequest(input: CreateRequestInput): Promise<{ requestId: string }> {
    const requestId = `req_${Date.now().toString(36)}`;
    await q(
      `insert into demo_requests (id, client_id, property_id, title, details, tenant_id)
       values ($1,$2,$3,$4,$5,$6)`,
      [requestId, input.clientId, input.propertyId, input.title, input.details, tenantId()],
    );
    return { requestId };
  }

  async addNote(args: { clientId: string; message: string }): Promise<void> {
    await q(`insert into demo_notes (client_id, message, tenant_id) values ($1,$2,$3)`, [
      args.clientId,
      args.message,
      tenantId(),
    ]);
  }

  async listVisits(args: { fromDate: Date; days: number }): Promise<ScheduledVisit[]> {
    const from = new Date(args.fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + args.days * 24 * 60 * 60_000);

    const rows = await q<{
      id: string;
      job_id: string;
      title: string;
      starts_at: string;
      ends_at: string;
      technician_id: string;
      urgency: string;
      status: string;
      created_by_agent: boolean;
      first_name: string | null;
      last_name: string | null;
    }>(
      `select v.id, v.job_id, v.title, v.starts_at, v.ends_at, v.technician_id,
              v.urgency, v.status, v.created_by_agent,
              c.first_name, c.last_name
       from demo_visits v
       left join demo_clients c on c.id = v.client_id
       where v.tenant_id = $3 and v.starts_at >= $1 and v.starts_at < $2 and v.status <> 'cancelled'
       order by v.starts_at asc`,
      [from.toISOString(), to.toISOString(), tenantId()],
    );

    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      title: r.title,
      startAt: new Date(r.starts_at).toISOString(),
      endAt: new Date(r.ends_at).toISOString(),
      assignedTechnicianId: r.technician_id,
      urgency: r.urgency,
      // Surname stays off the board. A dispatcher needs to know who, not everything.
      clientName: [r.first_name, r.last_name ? `${r.last_name[0]}.` : null].filter(Boolean).join(" ") || "Customer",
      createdByAgent: Boolean(r.created_by_agent),
    }));
  }
}
