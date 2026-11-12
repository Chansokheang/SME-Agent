import type { Scope } from "@/lib/api";

/** Example scope shown on the home page, so visitors see what Stage 1 produces. */
export const SAMPLE_SCOPE: Scope = {
  status: "ready",
  business: {
    name: "Bean There",
    industry: "Coffee shop",
    description: "A small, cozy café serving specialty coffee, tea and baked goods.",
    location: "Cheongju",
    target_customers: ["Local residents", "Students and remote workers"],
    goals: ["Show the menu online", "Let customers reserve a table"],
    languages: ["Korean", "English"],
  },
  brief: {
    main_action: { label: "Reserve a table", why: "Fewer phone calls at busy times." },
    goals: [
      { goal: "Take table requests online", measure: "About 20 requests a month" },
      { goal: "Show the menu with prices", measure: "Fewer calls asking about prices" },
    ],
  },
  site_type: "Café with online menu and reservations",
  roles: [
    { name: "Visitor", description: "Anyone browsing the site" },
    { name: "Owner", description: "Manages the menu and reservations" },
  ],
  pages: [
    { name: "Home", path: "/", purpose: "Welcome visitors and show today's highlights", roles: [], sections: [] },
    { name: "Menu", path: "/menu", purpose: "Drinks and food with prices", roles: [], sections: [] },
    { name: "Reserve", path: "/reserve", purpose: "Request a table for a date and time", roles: [], sections: [] },
    { name: "Visit us", path: "/about", purpose: "Opening hours, map and contact", roles: [], sections: [] },
  ],
  features: [
    { id: "F1", name: "Online menu", description: "Owner edits items and prices from the admin page.", priority: "must", roles: [], pages: [] },
    { id: "F2", name: "Table requests", description: "Customers request a table, the owner confirms by email.", priority: "must", roles: [], pages: [] },
    { id: "F3", name: "Photo gallery", description: "Show the space and seasonal drinks.", priority: "could", roles: [], pages: [] },
  ],
  entities: [],
  integrations: [],
  branding: { tone: "", colors: [], style_notes: "" },
  assumptions: [],
  open_questions: [],
};
