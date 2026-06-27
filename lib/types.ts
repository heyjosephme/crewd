// A single recommended teammate, with a one-sentence human reason.
export type Match = {
  id: string; // doc id of the matched attendee
  name: string; // their name (so you can find them)
  building?: string; // what they're building (extra "find them" context)
  reason: string; // one warm, specific sentence on why to team up
};

// One attendee in the room. The 4 profile fields are the entire onboarding.
export type Attendee = {
  id: string;
  name: string;
  building: string; // what they want to build / their direction
  skills: string; // what they bring
  lookingFor: string; // the kind of teammate they want
  createdAt: number; // ms epoch, used for ordering the live feed
  matches?: Match[]; // top 3, populated after the match call
  matchedAt?: number;
};

// The payload the profile form POSTs to /api/match.
export type ProfileInput = {
  name: string;
  building: string;
  skills: string;
  lookingFor: string;
};
