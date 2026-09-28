/**
 * The "Hear it" recordings on the landing site. Synthetic for now (two neural
 * voices, caller side band-limited like a phone line); replaced with real
 * calls to the product's own agent once phone numbers exist.
 */

export interface RecordingLine {
  who: "agent" | "caller";
  text: string;
}

export interface Recording {
  id: string;
  title: string;
  scene: string;
  file: string;
  seconds: number;
  transcript: RecordingLine[];
}

export const RECORDINGS: Recording[] = [
  {
    id: "no-heat",
    title: "No heat at 2 a.m.",
    scene: "A known customer calls after hours. The furnace is dead. Booked and the on-call tech paged in forty seconds.",
    file: "/audio/hvac-no-heat.mp3",
    seconds: 40,
    transcript: [
      { who: "agent", text: "Thanks for calling Northline Heating and Cooling. What's going on with your system?" },
      { who: "caller", text: "Our furnace just quit. No heat at all, and it's freezing in here." },
      { who: "agent", text: "That's urgent, we'll get someone out today. Your name and street address?" },
      { who: "caller", text: "Karen Whitfield, 42 Maple Street, Arlington Heights." },
      { who: "agent", text: "Got it, Karen. Mike can be there between two and four today. Does that work?" },
      { who: "caller", text: "Yes, please." },
      { who: "agent", text: "You're booked. I've texted Mike, and your confirmation is on its way. Stay warm." },
    ],
  },
];
