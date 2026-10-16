// All site copy lives here so it can be edited without touching layout code.

export const profile = {
  name: "Ezepue James",
  role: "Fullstack software engineer",
  location: "Lagos, Nigeria",
  timezone: "UTC+1",
  email: "jasperezepue@gmail.com",
  cv: "/Resume-Ezepue-James.pdf",
  github: "https://github.com/ezepuejames",
  linkedin: "https://linkedin.com/in/ezepue-james",
  headline: [
    "I build web and",
    "mobile products that",
    "stay quick when the",
    "data gets big.",
  ],
  intro:
    "Fullstack engineer working in TypeScript across React, Next.js, React Native, Node.js and PostgreSQL. Three years shipping production software for companies in finance, energy, education and engineering.",
  availability: "Available for remote roles, full overlap with UK and EU hours",
};

/**
 * 3D model slots.
 * Drop a .glb/.gltf file into /public/models and put its path here,
 * e.g. hero: "/models/hero.glb". While a slot is null, a shader-based
 * placeholder renders in its place.
 */
export const models: { hero: string | null; contact: string | null } = {
  hero: null, // MODEL SLOT: main object floating above the point field in the hero
  contact: null, // MODEL SLOT: smaller object beside the contact section
};

export type WorkEntry = {
  title: string;
  org: string;
  year: string;
  summary: string;
  details: string[];
  stack: string[];
  link?: { href: string; label: string };
  status?: string;
};

export const work: WorkEntry[] = [
  {
    title: "AGM platform",
    org: "Schull Technologies",
    year: "2026",
    summary: "Admin dashboard for running shareholder meetings for a securities firm",
    details: [
      "Register management for shareholder registers of up to 2M+ records, with server-side pagination and debounced search across name, email, phone and CHN.",
      "CSV bulk import with row-level validation, a preview step, and append or replace modes.",
      "Event setup, live sessions, e-voting and proxies, KYC, audit logs and role-based team permissions.",
      "Zoom integrated end to end: SDK signatures, ZAK tokens, waiting rooms, session control and a managed pool of host accounts.",
      "Contributed to the companion React Native app, including the native Android setup for the Zoom Meeting SDK.",
    ],
    stack: ["Next.js", "TypeScript", "TanStack Query", "Zoom SDK", "React Native"],
  },
  {
    title: "The Energy Vanguard",
    org: "Schull Technologies",
    year: "2026",
    summary: "Full stack build, from database to interface",
    details: [
      "REST APIs with Node.js, PostgreSQL, Prisma and Supabase.",
      "Real-time sync and webhooks so the app updates live.",
      "Containerised with Docker for consistent local and cloud deployments.",
    ],
    stack: ["Next.js", "Node.js", "PostgreSQL", "Prisma", "Supabase", "Docker"],
  },
  {
    title: "Brillianda",
    org: "Matte Design Agency",
    year: "2026",
    status: "In development",
    summary: "Backend for a multi-tenant, enterprise school management platform",
    details: [
      "Designed to scale to 1M users from the start.",
      "Custom authentication, with SAML SSO and SCIM planned as a later phase.",
    ],
    stack: ["Node.js", "PostgreSQL", "Neon", "AWS"],
  },
  {
    title: "RouteLink Microfinance Bank",
    org: "Matte Design Agency",
    year: "2026",
    summary: "Website and web app interface for a microfinance bank",
    details: [
      "Dashboard pages, forms and account-opening flows into the RoutePay portal.",
      "Notice-only cookie banner and privacy policy, since the site runs no trackers.",
    ],
    stack: ["Next.js", "Tailwind CSS"],
    link: { href: "https://routelink-mfb.vercel.app/", label: "Visit site" },
  },
  {
    title: "RoutePay",
    org: "Matte Design Agency",
    year: "2026",
    summary: "Corporate and marketing sites for a payments company",
    details: ["Built from Figma designs, with a focus on load speed and responsiveness."],
    stack: ["Next.js", "Tailwind CSS"],
    link: { href: "https://routepay.com", label: "Visit site" },
  },
  {
    title: "Crafwell Engineering",
    org: "Matte Design Agency",
    year: "2026",
    summary: "Corporate website for an engineering company",
    details: ["GSAP page transitions and interactive sections presenting the company's services."],
    stack: ["React", "GSAP"],
    link: { href: "https://crafwellengineering.com/", label: "Visit site" },
  },
  {
    title: "DeFi Liquidation Shield",
    org: "Personal project",
    year: "2026",
    summary: "On-chain risk monitor that alerts lenders before liquidation",
    details: [
      "A Solidity contract scores each lending position's health as safe, warning or critical.",
      "Kwala workflows fire Telegram alerts the moment a position turns critical, with no backend server.",
      "Reentrancy guards and overflow protection, covered by 40+ Hardhat tests.",
    ],
    stack: ["Solidity", "Hardhat", "React", "Viem", "Wagmi"],
    link: { href: "https://github.com/ezepuejames/Defi-Liquidation-Risk-Shield", label: "View code" },
  },
  {
    title: "Lead Radar",
    org: "Matte Design Agency",
    year: "2026",
    summary: "Internal console the agency team uses to manage and track outreach",
    details: ["Tracks leads across channels so the team can see progress in one place."],
    stack: ["Next.js", "Vercel"],
  },
  {
    title: "YouMeHungry",
    org: "Matte Design Agency",
    year: "2025",
    summary: "Landing site for a food delivery service",
    details: ["Navigation and visual hierarchy built to steer visitors to app downloads and partnerships."],
    stack: ["Next.js", "Tailwind CSS"],
    link: { href: "https://youmehungry.com/", label: "Visit site" },
  },
  {
    title: "Global Harvest Church",
    org: "Matte Design Agency",
    year: "2025",
    summary: "Church website, pages and navigation",
    details: ["Responsive layouts and a simpler navigation structure across devices."],
    stack: ["React"],
    link: { href: "https://www.gharvest.us/", label: "Visit site" },
  },
  {
    title: "HerRising",
    org: "Matte Design Agency",
    year: "2026",
    summary: "Web presence for a girls' empowerment initiative",
    details: ["Set up, built and deployed end to end, including server and file management."],
    stack: ["WordPress"],
    link: { href: "https://herrising.org/", label: "Visit site" },
  },
];

export const experience = [
  {
    period: "Feb 2026 – now",
    role: "Fullstack Software Developer",
    org: "Schull Technologies",
    place: "Remote",
    note: "Admin dashboard for an AGM platform handling 2M+ record registers, The Energy Vanguard full stack, and contributions to a React Native app.",
  },
  {
    period: "2025 – now",
    role: "Software Engineer",
    org: "Matte Design Agency",
    place: "Lagos",
    note: "Websites, dashboards and backend systems for clients in fintech, education, food delivery and the non-profit sector.",
  },
  {
    period: "Jan 2024 – Sep 2025",
    role: "Frontend Software Developer",
    org: "Crafwell Engineering",
    place: "Port Harcourt",
    note: "Web applications in React, TypeScript, Next.js and Tailwind CSS, with reusable component-driven UI.",
  },
];

export const education = {
  period: "2019 – 2024",
  degree: "B.Eng., Metallurgical and Materials Engineering",
  school: "University of Nigeria",
};

export const skills = [
  { group: "Frontend and mobile", items: ["TypeScript", "React", "Next.js", "React Native (Expo)", "Tailwind CSS", "TanStack Query"] },
  { group: "Backend and data", items: ["Node.js", "Express", "PostgreSQL", "Prisma", "Supabase", "Neon", "REST APIs", "Webhooks"] },
  { group: "Motion and 3D", items: ["Three.js", "React Three Fiber", "GLSL", "GSAP"] },
  { group: "Tooling", items: ["Docker", "Git", "Vercel", "Postman", "Solidity", "Hardhat"] },
];
