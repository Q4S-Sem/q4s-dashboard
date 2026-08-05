import * as React from "react";

// Platte, meerkleurige app-iconen (eigen ontwerp) voor het startscherm — één
// per hub, in de vlakke multicolor-stijl. Alle art zit binnen de 48×48-box met
// ~6px marge. Gerenderd op witte tegels, dus verzadigde vlakken die op wit poppen.

type IconProps = { className?: string };

const svg = (children: React.ReactNode) =>
  function Icon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {children}
      </svg>
    );
  };

// 1) Analytics — oplopende staven met een stijgende trendlijn erboven.
const Analytics = svg(
  <>
    {/* Staven op één basislijn (y=42), oplopend */}
    <rect x="7" y="27" width="9" height="15" rx="2.6" fill="#2563eb" />
    <rect x="19.5" y="20" width="9" height="22" rx="2.6" fill="#7c3aed" />
    <rect x="32" y="13" width="9" height="29" rx="2.6" fill="#10b981" />
    {/* Trendlijn erboven, met knikpunt en eindpunt */}
    <path
      d="M11.5 23 L24 16 L36.5 9"
      stroke="#f59e0b"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="36.5" cy="9" r="3.4" fill="#f59e0b" />
    <circle cx="11.5" cy="23" r="2.4" fill="#fbbf24" />
  </>,
);

// 2) Facturatie — bonnetje + groene munt.
const Facturatie = svg(
  <>
    <rect x="9" y="6" width="21" height="30" rx="3" fill="#dbeafe" />
    <rect x="13" y="12" width="13" height="2.6" rx="1.3" fill="#2563eb" />
    <rect x="13" y="18" width="13" height="2.6" rx="1.3" fill="#93c5fd" />
    <rect x="13" y="24" width="8" height="2.6" rx="1.3" fill="#93c5fd" />
    <circle cx="32" cy="33" r="9.5" fill="#10b981" />
    <circle cx="32" cy="33" r="4.6" fill="#6ee7b7" />
  </>,
);

// 3) Stamgegevens — twee gebouwen met raampjes.
const Stamgegevens = svg(
  <>
    <rect x="7" y="15" width="15" height="27" rx="2.5" fill="#7c3aed" />
    <rect x="24" y="8" width="17" height="34" rx="2.5" fill="#14b8a6" />
    {[20, 26, 32].flatMap((y) =>
      [10.5, 16].map((x) => (
        <rect key={`v${x}-${y}`} x={x} y={y} width="3.2" height="3.2" rx="0.8" fill="#ffffff" opacity="0.85" />
      )),
    )}
    {[13, 19, 25, 31].flatMap((y) =>
      [27.5, 33].map((x) => (
        <rect key={`t${x}-${y}`} x={x} y={y} width="3.2" height="3.2" rx="0.8" fill="#ffffff" opacity="0.85" />
      )),
    )}
  </>,
);

// 4) Evaluaties — klembord + vinkje.
const Evaluaties = svg(
  <>
    <rect x="10" y="9" width="28" height="33" rx="4" fill="#f59e0b" />
    <rect x="14" y="13" width="20" height="25" rx="2" fill="#ffffff" />
    <rect x="18.5" y="5.5" width="11" height="7" rx="2.2" fill="#2563eb" />
    <path d="M18 26 l4 4 8 -9" stroke="#10b981" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>,
);

// 5) Agenda — kalender met gekleurde koptekst + dagen.
const Agenda = svg(
  <>
    <rect x="7" y="10" width="34" height="32" rx="4" fill="#ffffff" stroke="#e7e7e5" strokeWidth="1.5" />
    <path d="M7 14 a4 4 0 0 1 4 -4 h26 a4 4 0 0 1 4 4 v5 h-34 z" fill="#f43f5e" />
    <rect x="13" y="6" width="4" height="8" rx="2" fill="#be123c" />
    <rect x="31" y="6" width="4" height="8" rx="2" fill="#be123c" />
    <circle cx="16" cy="27" r="2.4" fill="#2563eb" />
    <circle cx="24" cy="27" r="2.4" fill="#10b981" />
    <circle cx="32" cy="27" r="2.4" fill="#f59e0b" />
    <circle cx="16" cy="35" r="2.4" fill="#7c3aed" />
    <circle cx="24" cy="35" r="2.4" fill="#f43f5e" />
  </>,
);

// 6) Recruitment — twee mensen + spark (vinden/AI).
const Recruitment = svg(
  <>
    <circle cx="30" cy="18" r="5.5" fill="#a78bfa" />
    <path d="M21 40 a9 8 0 0 1 18 0 Z" fill="#a78bfa" />
    <circle cx="18" cy="20" r="6.5" fill="#2563eb" />
    <path d="M7 42 a11 10 0 0 1 22 0 Z" fill="#2563eb" />
    <path d="M36 6 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" fill="#f59e0b" />
  </>,
);

// 7) Socials — megafoon + geluidsgolven.
const Socials = svg(
  <>
    <rect x="7" y="19" width="9" height="11" rx="2.5" fill="#7c3aed" />
    <path d="M15 18 L33 10 V38 L15 30 Z" fill="#f97316" />
    <path d="M37 16 q5 8 0 16" stroke="#14b8a6" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M42 12 q7 12 0 24" stroke="#06b6d4" strokeWidth="3" fill="none" strokeLinecap="round" />
    <rect x="18" y="30" width="4.5" height="9" rx="2" fill="#7c3aed" />
  </>,
);

// 8) Vacatures — vacaturekaart met tekstregels + koffer-badge (job).
const Vacatures = svg(
  <>
    {/* Vacaturekaart (paper) */}
    <rect x="8" y="6" width="24" height="33" rx="3.5" fill="#dbeafe" />
    <rect x="12" y="11" width="16" height="3.6" rx="1.8" fill="#2563eb" />
    <rect x="12" y="18.5" width="16" height="2.8" rx="1.4" fill="#93c5fd" />
    <rect x="12" y="24" width="11" height="2.8" rx="1.4" fill="#93c5fd" />
    {/* Koffer-badge (job) rechtsonder */}
    <rect x="24" y="26" width="18" height="14" rx="3" fill="#10b981" />
    <rect x="30" y="23.6" width="6" height="4" rx="1.6" fill="#059669" />
    <rect x="24" y="31" width="18" height="2.8" fill="#6ee7b7" />
  </>,
);

// 9) Data — gestapelde gekleurde schijven (database).
const Data = svg(
  <>
    <ellipse cx="24" cy="31" rx="14" ry="5.2" fill="#14b8a6" />
    <ellipse cx="24" cy="24" rx="14" ry="5.2" fill="#6366f1" />
    <ellipse cx="24" cy="17" rx="14" ry="5.2" fill="#2563eb" />
  </>,
);

// 10) Instellingen — één tandwiel (beheer/instellingen).
const Instellingen = svg(
  <>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <rect key={a} x="21" y="3.5" width="6" height="9" rx="1.6" fill="#7c3aed" transform={`rotate(${a} 24 24)`} />
    ))}
    <circle cx="24" cy="24" r="14" fill="#7c3aed" />
    <circle cx="24" cy="24" r="9" fill="#a78bfa" />
    <circle cx="24" cy="24" r="4.5" fill="#ffffff" />
  </>,
);

// 11) MSP — trechter die inkomende MSP-vacatures filtert tot één groene match.
const Msp = svg(
  <>
    {/* Inkomende vacatures vanaf de MSP-platforms */}
    <rect x="8" y="5" width="8" height="6" rx="1.6" fill="#2563eb" />
    <rect x="20" y="5" width="8" height="6" rx="1.6" fill="#f59e0b" />
    <rect x="32" y="5" width="8" height="6" rx="1.6" fill="#f43f5e" />
    {/* Trechter (filter) */}
    <path d="M8 15 h32 l-11 13 v9 h-8 v-9 Z" fill="#7c3aed" />
    <path d="M8 15 h32 l-3.5 4.4 H11.5 Z" fill="#a78bfa" />
    {/* Gefilterde match eruit */}
    <circle cx="24" cy="42" r="4.2" fill="#10b981" />
  </>,
);

/** Custom icoon per hub-href. Ontbreekt er één, dan valt het startscherm terug
 *  op het lucide-icoon uit nav.ts. */
export const APP_ICONS: Record<string, React.FC<IconProps>> = {
  "/dashboard": Analytics,
  "/verwerken": Facturatie,
  "/klanten": Stamgegevens,
  "/evaluaties": Evaluaties,
  "/agenda": Agenda,
  "/recruitment": Recruitment,
  "/socials": Socials,
  "/website": Vacatures,
  "/data": Data,
  "/gebruikers": Instellingen,
};
