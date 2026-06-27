// A single recommended teammate, with a one-sentence human reason.
export type Match = {
  id: string; // doc id of the matched attendee
  name: string; // their name (so you can find them)
  avatar?: string; // their chosen emoji avatar (for a face in the list)
  role?: string; // their role key (see lib/profile ROLES)
  building?: string; // what they're building (extra "find them" context)
  reason: string; // one warm, specific sentence on why to team up
};

// One attendee in the room. Onboarding is just name + avatar + role; the three
// free-text fields are optional context the matcher uses when present.
export type Attendee = {
  id: string;
  name: string;
  avatar: string; // emoji identity
  role: string; // role key (see lib/profile ROLES)
  building: string; // what they want to build / their direction (optional)
  skills: string; // what they bring (optional)
  lookingFor: string; // the kind of teammate they want (optional)
  createdAt: number; // ms epoch, used for ordering the live feed
  matches?: Match[]; // top 3, populated after the match call
  matchedAt?: number;
};

// The payload the profile form POSTs to /api/match. Only name + role are required;
// building/skills/lookingFor may be empty (the form collapses them by default).
export type ProfileInput = {
  name: string;
  avatar: string;
  role: string;
  building: string;
  skills: string;
  lookingFor: string;
};
