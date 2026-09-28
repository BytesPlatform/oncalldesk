/**
 * Public configuration for the call widget. The Retell public key is meant to
 * be visible in the browser; the API key and the Jobber secret never leave
 * the server. With ?scope=app the agent is the signed-in workspace's own.
 */
import { NextRequest, NextResponse } from "next/server";
import { COMPANY } from "@/lib/config";
import { configOf } from "@/lib/tenant-config";
import { connectionSource, databaseMode, databaseWarning } from "@/lib/db";
import { jobber, jobberConfigured } from "@/lib/jobber";
import { tenantForRequest } from "@/lib/scope";
import { smsConfigured, smsMode } from "@/lib/sms";
import { DEMO_TENANT_ID } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resolved = await tenantForRequest(request);
  if (resolved instanceof NextResponse) return resolved;
  const { tenant } = resolved;
  const c = configOf(tenant);

  const agentId = tenant.retell_agent_id ?? (tenant.id === DEMO_TENANT_ID ? process.env.NEXT_PUBLIC_RETELL_AGENT_ID ?? "" : "");
  const phoneNumber = tenant.phone_number ?? (tenant.id === DEMO_TENANT_ID ? process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER ?? "" : "");

  return NextResponse.json({
    company: {
      ...COMPANY,
      name: tenant.name,
      shortName: tenant.short_name,
      tagline: tenant.tagline ?? COMPANY.tagline,
      mainNumber: c.basics.callbackNumber || tenant.main_number || COMPANY.mainNumber,
    },
    tenant: { id: tenant.id, status: tenant.status, plan: tenant.plan },
    technicians: c.technicians.map((t) => ({ id: t.id, firstName: t.firstName, name: t.name, tone: t.tone })),
    serviceArea: c.serviceArea,
    retell: {
      publicKey: process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY ?? "",
      agentId,
      phoneNumber,
      configured: Boolean(process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY && agentId),
    },
    integrations: {
      database: { mode: databaseMode(), source: connectionSource(), warning: databaseWarning() },
      jobber: { mode: jobber().mode, credentialsPresent: jobberConfigured() },
      sms: { mode: smsMode(), credentialsPresent: smsConfigured() },
    },
  });
}
