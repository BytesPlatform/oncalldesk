/**
 * The product, as opposed to the customer. COMPANY in config.ts is the
 * business the demo agent answers for; this is what we sell and every word
 * the landing site and the emails use. The site pages and the email
 * templates are shared across the three products verbatim; this file and
 * lib/recordings.ts are what differ.
 */

export interface Step {
  title: string;
  body: string;
}

export const PRODUCT = {
  name: "OnCallDesk",
  company: "Bytes Platform",
  /** One accent per product, used by the site and the emails. */
  accent: { main: "#ee4f1c", deep: "#c93c10", gradientFrom: "#ff7a4d", gradientTo: "#ee3d63" },
  /** One line, the result. */
  headline: "Every no-heat call booked, even at 2 a.m.",
  /** The same line split for the hero: the second half carries the accent. */
  headlineParts: { lead: "Every no-heat call booked,", accent: "even at 2 a.m." },
  subhead:
    "An AI receptionist for heating, cooling and home services. It answers every call, triages the emergency, books the job into your schedule and pages your on-call tech. Your customers hear a calm voice; you see the booking.",
  industry: "HVAC and home services",
  /** Who the buyer is, in their own words. */
  buyer: "contractors",
  /** What the buyer calls the person who does the work. */
  worker: "technician",
  /** What the buyer calls a booking. */
  booking: "job",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://oncalldesk.vercel.app",
  salesInbox: process.env.SALES_INBOX || "bytesuite@bytesplatform.com",
  /** Where product email is sent from. Must be a verified sender in SendGrid. */
  fromEmail: process.env.SENDGRID_FROM_EMAIL || "hello@bytesplatform.com",
  fromName: process.env.SENDGRID_FROM_NAME || "OnCallDesk",
  /** The same consent line the intake demo uses, so a prospect can be texted when SMS is on. */
  consentText:
    "By submitting, you agree that OnCallDesk may call, text and email you about your inquiry, including with automated technology. Consent is not a condition of purchase. Reply STOP to any text to opt out.",

  /** The three numbers under the hero. */
  proof: [
    { n: "24/7", label: "answers every call" },
    { n: "< 1 s", label: "to pick up, no hold music" },
    { n: "1 page", label: "to your on-call tech, only when it matters" },
  ],
  /** The example call card in the hero. */
  heroCall: { when: "Tuesday, 2:07 a.m.", kind: "Inbound, after hours", result: "Booked, tech paged", length: "40 seconds" },
  /** One line about the recording, used on the site and in the day-1 email. */
  recordingPitch: "A customer with no heat, after hours, booked and the on-call tech paged before the caller hung up.",
  recordingDescription: "Real scenario, the assistant answering as a fictional contractor. Press play, then read the transcript to see what it checked before it booked.",

  /** How it works, the three steps. Site and email. */
  steps: [
    { title: "It answers", body: "Every call, day or night, with your business name. It asks what is wrong and works out whether it is an emergency, a routine visit or an estimate." },
    { title: "It books", body: "It checks your service area, finds the customer or sets them up, offers arrival windows that are actually open, and writes the job to your schedule and to Jobber." },
    { title: "It hands over", body: "A genuine after-hours emergency pages your on-call technician. Anything it should not handle goes to a person, or into a callback list for the morning." },
  ] as Step[],
  /** What the demo call covers, for the day-3 email. */
  demoPitch: "The demo call takes twenty minutes and we run it on your own service area and hours.",

  /** The nine-step ladder on the how-it-works page. */
  ladder: [
    { title: "Call answered", body: "Picks up before the second ring with your business name. No hold music, no menu. Says it is an assistant if asked." },
    { title: "Reason understood", body: "Asks what is going on and listens. A dead furnace, a noisy AC, a quote for a replacement, a question about an existing booking." },
    { title: "Urgency triaged", body: "Your rules, not a generic script. No heat in winter is an emergency; a tune-up is routine; a smell of gas gets the safety script and a transfer." },
    { title: "Service area checked", body: "The postcode or the town against the list of areas you cover. Out of area callers get a polite no and a message for you, never a booking." },
    { title: "Caller qualified", body: "The two or three questions your dispatcher asks first: is anyone at risk, is the system off, what kind of system is it." },
    { title: "Customer matched", body: "A known number is greeted by name. A new caller is set up once, with their address, so the technician has what they need." },
    { title: "Job created", body: "Offers up to three arrival windows that are genuinely open on your schedule, and writes the job with the caller's own words as the note." },
    { title: "Technician notified", body: "A real after-hours emergency pages whoever is on call with the address and the problem. Routine work waits for the morning dispatch." },
    { title: "Caller confirmed", body: "Reads the booking back, texts a confirmation when SMS is on, and ends the call. Every step is in the log you can read afterwards." },
  ] as Step[],
  setup: [
    { title: "What we need from you", body: "Onboarding is a guided setup inside the product and takes under an hour. You give it your business name and hours, the towns or postcodes you cover, your technicians and who carries the after-hours phone, and the services you offer. You choose what it says when it answers and what it must never do. Then you make a test call and forward your number." },
    { title: "Forwarding your number", body: "You keep your number. Forward it to the assistant's number always, after hours only, or only when nobody picks up in four rings. Most contractors start with after hours and widen it once they trust it." },
    { title: "What you see", body: "A dashboard with three numbers that matter (calls answered, jobs booked, revenue booked), the day's board, the list of calls with what happened on each, and the texts it sent. Technical detail sits behind an Advanced page for when you want it." },
  ] as Step[],

  /** What the agent will not do, for the handover section. */
  rules: [
    "Never quotes a price. It books a diagnostic or an estimate visit and says the technician will price the work on site.",
    "Never promises an arrival time it cannot see. It offers windows that are actually open on your schedule.",
    "Never wakes the on-call technician for routine work. Only a genuine emergency, after hours, sends the page.",
    "Never argues with a caller. When someone insists on a person, it transfers or takes a message with a callback promise.",
  ],
  moreRules: [
    "Never gives safety advice beyond the script you approve. A smell of gas gets \"leave the house and call the gas company\", then a transfer.",
    "Never records a call without the disclosure your state requires; the opening line carries it.",
  ],
  handover: [
    { title: "Warm transfer", body: "During office hours, a caller who asks for a person, or a call the assistant cannot place, is transferred to your desk with a one-line summary spoken first, so nobody repeats themselves." },
    { title: "Emergency page", body: "After hours, a genuine emergency by your definition (no heat below a temperature you set, no cooling for a vulnerable household, a leak, a gas smell) is booked into the first window and the on-call technician is texted the address and the problem. Nothing else wakes them." },
    { title: "Callback queue", body: "Out-of-area callers, non-urgent after-hours calls, and anyone who would rather wait for a person get a callback promise. The message lands in a list your office works in the morning, with the caller's own words." },
    { title: "Voicemail to task", body: "If a transfer is not answered, the assistant takes a message and creates a task instead of dropping the caller into a voicemail box nobody checks." },
  ] as Step[],

  /** The integration table. */
  integration: { name: "Jobber", what: "customers, jobs and visits" },
  integrations: [
    { system: "Jobber", what: "Finds and creates customers, jobs and visits, books into open windows, adds the call note.", status: "Connect in onboarding. Housecall Pro and ServiceTitan on request." },
    { system: "Built-in calendar", what: "The dispatch board inside the product, for shops without field software.", status: "Included on every plan." },
    { system: "Twilio (SMS)", what: "Confirmation texts to customers, pages to the on-call technician, STOP handling.", status: "Switched on per customer once carrier registration clears." },
    { system: "Retell (voice)", what: "The phone line itself: numbers, call recording, transcripts.", status: "Included; you never deal with it directly." },
    { system: "Email", what: "Daily summary, weekly report, missed-call alerts to the owner.", status: "Included." },
  ],
  integrationsMore: "Housecall Pro, ServiceTitan and Google Calendar are on the list. If your shop runs on something not named here, say so on the demo call; the booking step is built to be pointed at a new system without touching the rest.",

  plans: [
    { id: "starter", name: "Starter", price: 149, minutes: 300, blurb: "One number, one location, email notifications and the built-in calendar." },
    { id: "practice", name: "Practice", price: 349, minutes: 1000, blurb: "Three locations, Jobber and calendar integration, texts to customers when SMS is switched on, the weekly report.", popular: true },
    { id: "group", name: "Group", price: 799, minutes: 3000, blurb: "Unlimited locations, several agents, priority support.", from: true },
  ],
  overagePerMinute: 0.25,
  pricingLead: "A typical service call lasts two to three minutes. Three hundred minutes is about a hundred calls a month; a thousand is a busy shop in heating season.",
  planIncludes: [
    "A dedicated number, or forwarding from yours, with after-hours or overflow rules.",
    "The dashboard, the call log with what happened on every call, and the daily summary email.",
    "Emergency paging to the on-call technician, with your own definition of emergency.",
    "A callback list for out-of-area and after-hours non-emergencies, worked in the morning.",
    "Onboarding with a person, and a test call before your number is forwarded.",
  ],

  faq: [
    { q: "Does it replace my dispatcher?", a: "No. It answers the phone so your dispatcher does not have to, and it books into the same schedule. Your dispatcher sees every booking with a note on what the caller said, and takes over any call that needs a person." },
    { q: "What if the internet is down?", a: "The assistant runs in the cloud, not in your office. If your office is offline, calls still get answered and booked; you see them when you are back. If our side were ever down, calls fall through to the number you choose, usually your mobile." },
    { q: "Will it quote prices?", a: "Never. It books a diagnostic or estimate visit and says the technician will price the work on site. You can give it a call-out fee to state if you want, and nothing else." },
    { q: "How do I cancel?", a: "Month to month. Tell us and we forward your number back the same day." },
  ],
  faqTitle: "The ones every contractor asks",
  cta: { title: "See it on your own service area", body: "The demo call takes twenty minutes. We set it up with your towns, your hours and your on-call rota, then you call it." },
  bookLead: "Leave your details and someone from our team calls you within one business day to set a time. On the call we configure the assistant with your towns, hours and on-call rota, and you phone it yourself.",
  bookTitle: "Twenty minutes, on your own service area",
  /** Placeholders on the demo form. */
  formExample: { name: "Dana Whitlock", business: "Northline Heating and Cooling", message: "Answer after-hours calls and book emergencies without waking me up unless it's real." },

  /** Product-specific paragraphs on the security and privacy pages. */
  securityExtra: [
    { title: "What the assistant is told", body: "Only what it needs for the call: your hours, your service area, your technicians' first names, the customer's first name and the booking. It never sees payment details, and it never quotes prices." },
  ] as Step[],
  privacyCaller: "The assistant records the call after telling you so, transcribes it, and stores your name, phone number, address and the reason for the call so the business can do the work you asked for.",
  /** Whether a HIPAA business associate agreement is offered. */
  baa: false,
} as const;

export type Plan = (typeof PRODUCT.plans)[number];
