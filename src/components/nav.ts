import {
  LayoutDashboard,
  HardHat,
  Building2,
  Briefcase,
  CalendarClock,
  Receipt,
  Settings,
  Globe,
  FileText,
  FileUser,
  Database,
  FolderOpen,
  Cloud,
  BarChart3,
  ChartNoAxesCombined,
  Target,
  Inbox,
  TrendingUp,
  Sparkles,
  Factory,
  PencilLine,
  Filter,
  Users,
  ClipboardList,
  CalendarDays,
  ListTodo,
  Plane,
  ClipboardCheck,
  ShieldCheck,
  Award,
  UserCog,
  Archive,
  IdCard,
  UserCheck,
  Kanban,
  Contact,
  Zap,
  KeyRound,
  Lock,
  Wallet,
  Wand2,
  Mail,
  FileSignature,
  Plus,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for navigation — used by the app-launcher (home grid)
// and the per-app contextual sidebar.
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Key into the live nav-badge counts (e.g. "verwerken", "facturen", "inkoop"). */
  badge?: string;
  /** Optional sub-group heading; consecutive items with the same section are
   *  grouped together and separated from other groups by a divider. */
  section?: string;
  /** Wél onderdeel van deze hub (zodat de route zijn zijbalk houdt en een
   *  BackLink zijn label vindt), maar NIET in het menu zelf. Voor schermen die
   *  je alleen vanuit een ander scherm opent. */
  hidden?: boolean;
};

// A hub = an "app" on the launcher. `href` is its landing page; `items` are its
// contextual-sidebar entries.
export type NavHub = {
  label: string;
  href: string;
  icon: LucideIcon;
  items: NavItem[];
};

/** The standalone Analytics "app" (route blijft /dashboard). */
export const DASHBOARD_APP = {
  label: "Analytics",
  href: "/dashboard",
  icon: ChartNoAxesCombined,
};

const HUB_LIST: NavHub[] = [
  {
    label: "Analytics",
    href: "/dashboard",
    icon: ChartNoAxesCombined,
    items: [
      { href: "/dashboard", label: "Overzicht", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/te-doen", label: "Te doen", icon: ListTodo, badge: "teDoen" },
      // Geen "Facturatie"-tegel meer: die cijfers staan nu compleet onder
      // Facturatie → Rapportage, zodat er maar één plek is om naar te kijken.
      { href: "/dashboard/recruitment", label: "Recruitment", icon: Sparkles },
      { href: "/dashboard/kpi", label: "Recruitment-KPI's", icon: Target },
      { href: "/dashboard/plaatsingen", label: "Plaatsingen & marges", icon: Briefcase },
      { href: "/dashboard/evaluaties", label: "Evaluaties", icon: ClipboardCheck },
      { href: "/dashboard/rapportage", label: "Rapportage", icon: BarChart3 },
      { href: "/dashboard/automatisering", label: "Automatisering", icon: Zap },
    ],
  },
  {
    // Vijf items, meer niet. Het weekwerk staat bovenaan, daaronder de twee
    // geldstromen (eruit naar de klant, eruit naar de freelancer), dan het
    // overzicht en tot slot het beheer. Alles leeft onder /facturatie.
    label: "Facturatie",
    href: "/facturatie",
    icon: Receipt,
    items: [
      // Geen `exact`: de zijbalk kiest altijd de MEEST SPECIFIEKE treffer, dus
      // het dossier (/facturatie/<plaatsing>/<week>) laat hier netjes "Week
      // verwerken" oplichten terwijl /facturatie/verkoop zijn eigen item pakt.
      { href: "/facturatie", label: "Week verwerken", icon: Wand2, badge: "verwerken" },
      { href: "/facturatie/verkoop", label: "Verkoopfacturen", icon: Receipt, badge: "facturen" },
      { href: "/facturatie/inkoop", label: "Inkoop & betalingen", icon: Wallet, badge: "ontvangen" },
      { href: "/facturatie/rapportage", label: "Rapportage", icon: TrendingUp },
      { href: "/facturatie/instellingen", label: "Instellingen & regels", icon: Settings, section: "Beheer" },
    ],
  },
  {
    label: "Personeelsgegevens",
    href: "/klanten",
    icon: Building2,
    items: [
      { href: "/klanten", label: "Klanten", icon: Building2, section: "Klanten" },
      { href: "/plaatsingen", label: "Plaatsingen", icon: Briefcase, section: "Plaatsingen" },
      { href: "/medewerkers", label: "Medewerkers", icon: IdCard, section: "Medewerkers" },
      { href: "/certificeringen", label: "Certificeringen", icon: Award, section: "Medewerkers" },
    ],
  },
  {
    // Eigen werkplek: contracten invullen, controleren, printen en opslaan.
    label: "Contracten",
    href: "/contracten",
    icon: FileSignature,
    items: [
      { href: "/contracten", label: "Contracten", icon: FileSignature, exact: true },
      { href: "/contracten/nieuw", label: "Nieuw contract", icon: Plus },
      { href: "/contracten/blanco", label: "Blanco", icon: FileText },
    ],
  },
  {
    label: "Evaluaties",
    href: "/evaluaties",
    icon: ClipboardCheck,
    items: [
      { href: "/evaluaties/vcu", label: "VG Evaluatie", icon: ClipboardCheck, section: "Formulieren" },
      { href: "/evaluaties/inlener", label: "Inlener Evaluatie", icon: ClipboardList, section: "Formulieren" },
    ],
  },
  {
    label: "Agenda",
    href: "/agenda",
    icon: CalendarDays,
    items: [
      { href: "/agenda", label: "Kalender", icon: CalendarDays, exact: true },
      { href: "/agenda/taken", label: "Takenlijst", icon: ListTodo },
      { href: "/agenda/afwezigheid", label: "Afwezigheid", icon: Plane },
    ],
  },
  {
    label: "Recruitment",
    href: "/recruitment",
    icon: Sparkles,
    items: [
      { href: "/recruitment", label: "Cockpit", icon: LayoutDashboard, exact: true },
      { href: "/kandidaten", label: "Talentpool", icon: Users, section: "Kandidaten" },
      { href: "/kandidaten/beschikbaar", label: "Beschikbaar", icon: UserCheck, section: "Kandidaten" },
      { href: "/sollicitaties", label: "Sollicitaties", icon: ClipboardList, section: "Kandidaten" },
      { href: "/crm", label: "Pipeline", icon: Kanban, section: "CRM" },
      { href: "/crm/vacatures", label: "Vacatures", icon: Briefcase, section: "CRM" },
      { href: "/crm/contacten", label: "Contacten", icon: Contact, section: "CRM" },
      { href: "/crm/opvolging", label: "Opvolging", icon: CalendarClock, section: "CRM" },
      { href: "/opdrachtgevers", label: "Klanten", icon: Factory, section: "CRM" },
      { href: "/crm/inzichten", label: "Inzichten", icon: BarChart3, section: "CRM" },
    ],
  },
  {
    label: "Vacatures",
    href: "/website",
    icon: FileText,
    items: [
      { href: "/website", label: "Vacatures", icon: Briefcase, exact: true, section: "Website" },
      { href: "/website/sollicitaties", label: "Sollicitaties", icon: Inbox, section: "Website" },
      { href: "/website/linkedin", label: "LinkedIn", icon: Sparkles, section: "Website" },
      // Bereikbaar via de acties op de vacaturelijst, niet als los menu-item:
      // - /website/vacatures  = redirect naar /crm/vacatures; subroute
      //   /website/vacatures/[id]/sollicitaties toont sollicitaties per vacature
      // - /vacatures          = de uitwerk/publiceer-pagina per vacature
      // - /vacaturehub        = MSP-instroom, staat onder onderhoud
      { href: "/website/vacatures", label: "Op de website", icon: Globe, hidden: true },
      { href: "/vacatures", label: "Uitwerken & publiceren", icon: PencilLine, hidden: true },
      { href: "/vacaturehub", label: "Vacaturehub", icon: Filter, hidden: true },
    ],
  },
  {
    label: "CV's",
    href: "/website/cv-inbox",
    icon: FileUser,
    items: [
      { href: "/website/cv-inbox", label: "Inkomende CV's", icon: Inbox, exact: true },
      { href: "/socials/cv-generator", label: "CV-generator", icon: FileUser },
      { href: "/website/cv-inbox/matches", label: "CV-matches", icon: Target },
    ],
  },
  {
    label: "Data",
    href: "/data",
    icon: Database,
    items: [
      // Alleen Overzicht in het menu; de rest is een map ín het Overzicht
      // (hidden = hoort bij deze hub, maar staat niet in de zijbalk).
      { href: "/data", label: "Overzicht", icon: Database, exact: true },
      { href: "/data/cloud", label: "SharePoint & OneDrive", icon: Cloud, hidden: true },
      { href: "/werknemers", label: "Werknemers", icon: HardHat, hidden: true },
      { href: "/documenten", label: "Documenten", icon: FolderOpen, hidden: true },
      { href: "/analyses", label: "Analyses", icon: BarChart3, hidden: true },
      { href: "/marktkansen", label: "Marktkansen", icon: Target, hidden: true },
      { href: "/archief", label: "Archief", icon: Archive, hidden: true },
    ],
  },
  {
    // Eén pagina per norm waarop we geaudit worden.
    label: "Audits",
    href: "/audits",
    icon: ShieldCheck,
    items: [
      { href: "/audits/iso-9001", label: "ISO 9001", icon: Award },
      { href: "/audits/nen-4400", label: "NEN 4400-1", icon: ClipboardCheck },
      { href: "/audits/nen-4400/facturen", label: "Facturen-steekproef", icon: Receipt, hidden: true },
      { href: "/audits/vcu", label: "VCU", icon: HardHat },
    ],
  },
  {
    label: "Instellingen",
    href: "/gebruikers",
    icon: Settings,
    items: [
      { href: "/gebruikers", label: "Gebruikers", icon: UserCog, exact: true, section: "Toegang" },
      { href: "/gebruikers/handtekening", label: "E-mailhandtekening", icon: Mail, section: "Toegang" },
      { href: "/gebruikers/wachtwoorden", label: "Wachtwoorden", icon: Lock, section: "Toegang" },
      { href: "/gebruikers/api-sleutels", label: "API-sleutels", icon: KeyRound, section: "AI" },
      { href: "/gebruikers/tokenverbruik", label: "Tokenverbruik", icon: BarChart3, section: "AI" },
    ],
  },
];

// Vaste volgorde van de hubs op het startscherm / de app-launcher. Onbekende
// hrefs komen achteraan (indexOf → -1). Eén bron van waarheid, dus zowel de
// tegels als de app-switcher volgen deze volgorde.
const HUB_ORDER = [
  "/klanten", // Personeelsgegevens
  "/facturatie",
  "/contracten",
  "/recruitment",
  "/website", // Vacatures
  "/website/cv-inbox", // CV's
  "/agenda",
  "/evaluaties",
  "/dashboard", // Analytics
  "/data",
  "/audits",
  "/gebruikers", // Instellingen
];

const orderIndex = (href: string) => {
  const i = HUB_ORDER.indexOf(href);
  return i === -1 ? HUB_ORDER.length : i;
};

export const HUBS: NavHub[] = [...HUB_LIST].sort(
  (a, b) => orderIndex(a.href) - orderIndex(b.href),
);

/** Match a route to its item, with path-boundary awareness (so /vacaturehub ≠ /vacatures). */
export function itemIsActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The hub (app) that owns the current route, or null on the home/dashboard. */
export function hubForPath(pathname: string): NavHub | null {
  // De MEEST SPECIFIEKE match wint, niet de eerste in de lijst. Een hub mag
  // namelijk een pagina bevatten die onder het pad van een andere hub ligt —
  // /website/cv-inbox hoort bij CV's, niet bij Vacatures, ook al begint het met
  // /website. Met "eerste match wint" belandde je dan in de verkeerde werkplek.
  let beste: NavHub | null = null;
  let score = -1;

  for (const hub of HUBS) {
    // Een expliciet menu-item weegt het zwaarst; hoe langer het pad, hoe
    // specifieker. Bewust op padprefix en NIET via `itemIsActive`: `exact` is
    // bedoeld om te bepalen welk item oplicht, niet in welke werkplek je zit.
    // /website/cv-inbox/importeren hoort bij CV's, ook al is het item zelf exact.
    for (const it of hub.items) {
      const raakt = pathname === it.href || pathname.startsWith(`${it.href}/`);
      if (!raakt) continue;
      const s = it.href.length + 1000; // items gaan vóór het hub-pad zelf
      if (s > score) {
        score = s;
        beste = hub;
      }
    }
    // Anders het landingspad van de hub (dekt detail-/nieuw-pagina's zonder
    // eigen menu-item, zoals /agenda/123).
    if (pathname === hub.href || pathname.startsWith(`${hub.href}/`)) {
      const s = hub.href.length;
      if (s > score) {
        score = s;
        beste = hub;
      }
    }
  }

  return beste;
}

// ===================== TOEGANGSRECHTEN (per gebruiker) =====================
//
// Een ADMIN ziet alles. Een GEBRUIKER ziet alleen de hubs die je hebt
// aangevinkt, en binnen zo'n hub alleen de aangevinkte pagina's — of álle
// pagina's van die hub als je er geen enkele los hebt aangevinkt.

export type UserAccess = {
  role: string;
  /** Hub-hrefs die zichtbaar zijn (bijv. ["/klanten", "/agenda"]). */
  allowedHubs: string[];
  /** Pagina-hrefs (menu-items) die expliciet zijn toegestaan. */
  allowedPages: string[];
};

/** Ziet deze gebruiker álles? (ADMIN, of geen auth/geen accountcontext). */
export function isFullAccess(access: UserAccess | null | undefined): boolean {
  return !access || access.role === "ADMIN";
}

/** Mag deze gebruiker deze hub (werkplek) zien? */
export function canSeeHub(hub: NavHub, access: UserAccess | null | undefined): boolean {
  if (isFullAccess(access)) return true;
  return access!.allowedHubs.includes(hub.href);
}

/**
 * De items van een hub die deze gebruiker mag zien. Verborgen items (hidden)
 * blijven bij de hub horen maar tellen niet mee voor het menu — die filtert de
 * app-shell zelf al weg. Regel: is er minstens één pagina van deze hub expliciet
 * toegestaan, dan ALLEEN die; anders alle pagina's van de (toegestane) hub.
 */
export function visibleItems(hub: NavHub, access: UserAccess | null | undefined): NavItem[] {
  if (isFullAccess(access)) return hub.items;
  const hubPageHrefs = hub.items.map((it) => it.href);
  const explicit = access!.allowedPages.filter((p) => hubPageHrefs.includes(p));
  if (explicit.length === 0) return hub.items;
  return hub.items.filter((it) => explicit.includes(it.href));
}

/** De hubs die op het startscherm/menu zichtbaar zijn voor deze gebruiker. */
export function accessibleHubs(access: UserAccess | null | undefined): NavHub[] {
  if (isFullAccess(access)) return HUBS;
  return HUBS.filter((h) => canSeeHub(h, access));
}

/**
 * Mag deze gebruiker dit pad openen? Gebruikt door de server-side route-guard.
 * Onbekende paden (geen hub) zijn toegestaan — die vallen buiten dit rechtenmodel
 * (bijv. /login, / , eigen account). Een pad binnen een hub mag alleen als de hub
 * is toegestaan én (indien er expliciete pagina's zijn) het item daarbij zit.
 */
export function canAccessPath(pathname: string, access: UserAccess | null | undefined): boolean {
  if (isFullAccess(access)) return true;
  const hub = hubForPath(pathname);
  if (!hub) return true; // geen hub → buiten het model (home, login, account)
  if (!canSeeHub(hub, access)) return false;

  const hubPageHrefs = hub.items.map((it) => it.href);
  const explicit = access!.allowedPages.filter((p) => hubPageHrefs.includes(p));
  if (explicit.length === 0) return true; // hele hub toegestaan

  // Het pad hoort bij het LANGST passende menu-item (zoals hubForPath): anders geeft
  // een item op de hub-root (bv. /facturatie) via de prefix toegang tot alle
  // zusterpagina's (/facturatie/verkoop …).
  const owner = hubPageHrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  return owner !== undefined && explicit.includes(owner);
}

/** Oude facturatie-hrefs (vóór de herbouw) → nieuwe, zodat bewaarde rechten blijven werken. */
const LEGACY_HREFS: Record<string, string> = {
  "/verwerken/nieuw": "/facturatie",
  "/verwerken/week": "/facturatie",
  "/verwerken/wachtkamer": "/facturatie",
  "/verwerken/archief": "/facturatie",
  "/inbox": "/facturatie",
  "/uren": "/facturatie",
  "/facturen": "/facturatie/verkoop",
  "/verzenden": "/facturatie/verkoop",
  "/ontvangen-facturen": "/facturatie/inkoop",
  "/declaraties": "/facturatie/inkoop",
  "/betalingen": "/facturatie/inkoop",
  "/betaalmonitor": "/facturatie/inkoop",
  "/inkoopfacturen": "/facturatie/inkoop",
  "/totaaloverzicht": "/facturatie/rapportage",
  "/boekhouding": "/facturatie/rapportage",
  "/boekhouding/steekproef": "/facturatie/rapportage",
  "/instellingen": "/facturatie/instellingen",
};

/** Vertaal opgeslagen hrefs naar de huidige navigatie (ontdubbeld). */
export function migrateAccessHrefs(hrefs: string[]): string[] {
  return [...new Set(hrefs.map((h) => LEGACY_HREFS[h] ?? h))];
}

/** Waar sturen we een gebruiker heen als hij géén toegang heeft tot het gevraagde pad. */
export function firstAllowedHubHref(access: UserAccess | null | undefined): string {
  const hubs = accessibleHubs(access);
  return hubs[0]?.href ?? "/geen-toegang";
}

/**
 * Serialiseerbare weergave van de navigatie voor de rechten-kiezer in het
 * gebruikersformulier: alleen hrefs + labels (geen icoon-componenten, want die
 * kunnen niet van een server- naar een client-component reizen). Verborgen items
 * doen niet mee — die kies je niet los.
 */
export type NavTreeItem = { href: string; label: string; section?: string };
export type NavTreeHub = { href: string; label: string; items: NavTreeItem[] };

export function navTree(): NavTreeHub[] {
  return HUBS.map((h) => ({
    href: h.href,
    label: h.label,
    items: h.items
      .filter((it) => !it.hidden)
      .map((it) => ({ href: it.href, label: it.label, section: it.section })),
  }));
}
