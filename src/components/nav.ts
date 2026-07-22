import {
  LayoutDashboard,
  HardHat,
  Building2,
  Briefcase,
  CalendarClock,
  Receipt,
  Settings,
  Megaphone,
  Send,
  Globe,
  FileText,
  FileUser,
  Scale,
  Database,
  FolderOpen,
  Cloud,
  BarChart3,
  Target,
  Inbox,
  Coins,
  Sparkles,
  Factory,
  Plug,
  Filter,
  Users,
  ClipboardList,
  CalendarDays,
  ListTodo,
  CalendarPlus,
  ListChecks,
  PieChart,
  ClipboardCheck,
  Award,
  UserCog,
  ReceiptText,
  Archive,
  IdCard,
  UserCheck,
  Kanban,
  Contact,
  Zap,
  KeyRound,
  Workflow,
  Wallet,
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
};

// A hub = an "app" on the launcher. `href` is its landing page; `items` are its
// contextual-sidebar entries.
export type NavHub = {
  label: string;
  href: string;
  icon: LucideIcon;
  items: NavItem[];
};

/** The standalone Dashboard "app" (no sub-menu). */
export const DASHBOARD_APP = {
  label: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboard,
};

export const HUBS: NavHub[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Overzicht", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/te-doen", label: "Te doen", icon: ListTodo, badge: "teDoen" },
      { href: "/dashboard/facturatie", label: "Facturatie", icon: PieChart },
      { href: "/dashboard/recruitment", label: "Recruitment", icon: Sparkles },
      { href: "/dashboard/plaatsingen", label: "Plaatsingen & marges", icon: Briefcase },
      { href: "/dashboard/evaluaties", label: "Evaluaties", icon: ClipboardCheck },
      { href: "/dashboard/rapportage", label: "Rapportage", icon: BarChart3 },
      { href: "/dashboard/automatisering", label: "Automatisering", icon: Zap },
    ],
  },
  {
    label: "Facturatie",
    href: "/verwerken",
    icon: Receipt,
    items: [
      { href: "/inbox", label: "Timesheet-inbox", icon: Inbox, section: "Uren" },
      { href: "/inbox/status", label: "Timesheet-status", icon: ClipboardCheck, section: "Uren" },
      { href: "/uren", label: "Urenregistratie", icon: CalendarClock, section: "Uren" },
      { href: "/declaraties", label: "Declaraties", icon: ReceiptText, section: "Uren" },
      { href: "/ontvangen-facturen", label: "Ontvangen facturen", icon: Wallet, badge: "ontvangen", section: "Inkomend" },
      { href: "/verwerken", label: "Verwerken", icon: ListChecks, badge: "verwerken", section: "Verwerken" },
      { href: "/facturen", label: "Facturen (verkoop)", icon: Receipt, badge: "facturen", section: "Facturen" },
      { href: "/inkoopfacturen", label: "Inkoopfacturen", icon: Coins, badge: "inkoop", section: "Facturen" },
      { href: "/verzenden", label: "Verzendmap", icon: Send, badge: "verzenden", section: "Facturen" },
      { href: "/facturatie-overzicht", label: "Overzicht", icon: PieChart, section: "Overzicht & beheer" },
      { href: "/boekhouding", label: "Boekhouding & BTW", icon: Scale, section: "Overzicht & beheer" },
      { href: "/verwerken/archief", label: "Archief (verwerkt)", icon: Archive, section: "Overzicht & beheer" },
      { href: "/instellingen", label: "Instellingen", icon: Settings, section: "Overzicht & beheer" },
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
    label: "Evaluaties",
    href: "/evaluaties",
    icon: ClipboardCheck,
    items: [
      { href: "/evaluaties/vcu", label: "VG-evaluatie", icon: ClipboardCheck, section: "Formulieren" },
      { href: "/evaluaties/inlener", label: "Evaluatie inlener", icon: ClipboardList, section: "Formulieren" },
      { href: "/evaluaties/templates", label: "Templates", icon: FileText, section: "Beheer" },
    ],
  },
  {
    label: "Agenda",
    href: "/agenda",
    icon: CalendarDays,
    items: [
      { href: "/agenda", label: "Kalender", icon: CalendarDays, exact: true },
      { href: "/agenda/taken", label: "Takenlijst", icon: ListTodo },
      { href: "/agenda/importeren", label: "Importeren", icon: CalendarPlus },
    ],
  },
  {
    label: "Recruitment",
    href: "/recruitment",
    icon: Sparkles,
    items: [
      { href: "/crm", label: "Pipeline", icon: Kanban, section: "CRM" },
      { href: "/crm/contacten", label: "Contacten", icon: Contact, section: "CRM" },
      { href: "/crm/opvolging", label: "Opvolging", icon: CalendarClock, section: "CRM" },
      { href: "/crm/inzichten", label: "Inzichten", icon: BarChart3, section: "CRM" },
      { href: "/crm/instellingen", label: "CRM-instellingen", icon: Settings, section: "CRM" },
      { href: "/kandidaten", label: "Talentpool", icon: Users, section: "Kandidaten" },
      { href: "/kandidaten/beschikbaar", label: "Beschikbaar", icon: UserCheck, section: "Kandidaten" },
      { href: "/sollicitaties", label: "Sollicitaties", icon: ClipboardList, section: "Kandidaten" },
      { href: "/website/cvs", label: "Binnengekomen CV's", icon: Inbox, exact: true, section: "CV's" },
      { href: "/website/cvs/matches", label: "CV-matches", icon: Target, section: "CV's" },
    ],
  },
  {
    // Eigen hub voor de MSP-pijplijn: koppelingen met Magnit e.a. NL-MSP's →
    // vacatures binnenhalen + filteren → op de website plaatsen → matchen in de
    // database. Losgetrokken uit Recruitment zodat het personeel hier gericht werkt.
    label: "MSP",
    href: "/msp",
    icon: Zap,
    items: [
      { href: "/msp", label: "Overzicht", icon: Zap, exact: true, section: "Intake" },
      { href: "/connectors", label: "MSP-koppelingen", icon: Plug, section: "Koppelingen" },
      { href: "/opdrachtgevers", label: "Opdrachtgevers", icon: Factory, section: "Koppelingen" },
      { href: "/vacaturehub", label: "Vacaturehub", icon: Filter, section: "Vacatures" },
      { href: "/vacatures", label: "Vacatures", icon: FileText, section: "Vacatures" },
    ],
  },
  {
    label: "Socials",
    href: "/socials",
    icon: Megaphone,
    items: [
      { href: "/socials", label: "LinkedIn-generator", icon: Sparkles, exact: true },
      { href: "/socials/cv-generator", label: "CV-generator", icon: FileUser },
    ],
  },
  {
    label: "Website",
    href: "/website",
    icon: Globe,
    items: [
      { href: "/website", label: "Overzicht", icon: Globe, exact: true },
      { href: "/website/vacatures", label: "Vacatures", icon: FileText },
    ],
  },
  {
    label: "Data",
    href: "/data",
    icon: Database,
    items: [
      { href: "/data/cloud", label: "SharePoint & OneDrive", icon: Cloud, section: "Cloudopslag" },
      { href: "/data/pijplijn", label: "Data-pijplijn", icon: Workflow, section: "Cloudopslag" },
      { href: "/data", label: "Overzicht", icon: Database, exact: true, section: "Data" },
      { href: "/werknemers", label: "Werknemers", icon: HardHat, section: "Data" },
      { href: "/documenten", label: "Documenten", icon: FolderOpen, section: "Data" },
      { href: "/analyses", label: "Analyses", icon: BarChart3, section: "Data" },
      { href: "/marktkansen", label: "Marktkansen", icon: Target, section: "Data" },
      { href: "/archief", label: "Archief", icon: Archive, section: "Prullenbak" },
    ],
  },
  {
    label: "Instellingen",
    href: "/gebruikers",
    icon: Settings,
    items: [
      { href: "/gebruikers", label: "Gebruikers", icon: UserCog, exact: true, section: "Toegang" },
      { href: "/gebruikers/api-sleutels", label: "API-sleutels", icon: KeyRound, section: "AI" },
      { href: "/gebruikers/tokenverbruik", label: "Tokenverbruik", icon: BarChart3, section: "AI" },
    ],
  },
];

/** Match a route to its item, with path-boundary awareness (so /vacaturehub ≠ /vacatures). */
export function itemIsActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The hub (app) that owns the current route, or null on the home/dashboard. */
export function hubForPath(pathname: string): NavHub | null {
  for (const hub of HUBS) {
    // Match the hub's own landing path and any sub-route (covers detail/new
    // pages like /agenda/123 that aren't explicit sidebar items)…
    if (pathname === hub.href || pathname.startsWith(`${hub.href}/`)) return hub;
    // …or any of its items.
    if (hub.items.some((it) => itemIsActive(pathname, it))) return hub;
  }
  return null;
}
