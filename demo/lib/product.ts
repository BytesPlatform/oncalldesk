/**
 * The product, as opposed to the customer. COMPANY in config.ts is the
 * business the demo agent answers for; this is what we sell and the words
 * the landing site and the emails use. One of the three files that differ
 * on purpose between the products.
 */

export const PRODUCT = {
  name: "OnCallDesk",
  company: "Bytes Platform",
  /** One line, the result. */
  headline: "Every no-heat call booked, even at 2 a.m.",
  subhead:
    "An AI receptionist for heating, cooling and home services. It answers every call, triages the emergency, books the job into your schedule and pages your on-call tech. Your customers hear a calm voice; you see the booking.",
  industry: "HVAC and home services",
  /** Who the buyer is, in their own words. */
  buyer: "contractors",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://hvac-ai-receptionist-lovat.vercel.app",
  salesInbox: process.env.SALES_INBOX || "bytesuite@bytesplatform.com",
  /** Where product email is sent from. Must be a verified sender in SendGrid. */
  fromEmail: process.env.SENDGRID_FROM_EMAIL || "hello@bytesplatform.com",
  fromName: process.env.SENDGRID_FROM_NAME || "OnCallDesk",
  /** The same consent line the intake demo uses, so a prospect can be texted when SMS is on. */
  consentText:
    "By submitting, you agree that OnCallDesk may call, text and email you about your inquiry, including with automated technology. Consent is not a condition of purchase. Reply STOP to any text to opt out.",
  /** What the agent will not do, for the handover section. */
  rules: [
    "Never quotes a price. It books a diagnostic or an estimate visit and says the technician will price the work on site.",
    "Never promises an arrival time it cannot see. It offers windows that are actually open on your schedule.",
    "Never wakes the on-call technician for routine work. Only a genuine emergency, after hours, sends the page.",
    "Never argues with a caller. When someone insists on a person, it transfers or takes a message with a callback promise.",
  ],
  /** The integration the product writes to, stated honestly. */
  integration: { name: "Jobber", what: "customers, jobs and visits", status: "Connect in onboarding. Housecall Pro and ServiceTitan on request." },
  plans: [
    { id: "starter", name: "Starter", price: 149, minutes: 300, blurb: "One number, one location, email notifications and the built-in calendar." },
    { id: "practice", name: "Practice", price: 349, minutes: 1000, blurb: "Three locations, Jobber and calendar integration, texts to customers when SMS is switched on, the weekly report.", popular: true },
    { id: "group", name: "Group", price: 799, minutes: 3000, blurb: "Unlimited locations, several agents, priority support.", from: true },
  ],
  overagePerMinute: 0.25,
} as const;

export type Plan = (typeof PRODUCT.plans)[number];
