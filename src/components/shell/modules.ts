// Navigation config for the module shell. Pure data: no behaviour lives here.
// Adding a module to the shell later = add an entry + move its routes under
// <ModuleShell /> in App.tsx.
import {
  Car,
  FolderOpen,
  ClipboardList,
  ClipboardCheck,
  Boxes,
  ShieldCheck,
  Building2,
  UsersRound,
  Wrench,
  Clock,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface ModuleNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Permission prefix needed to see this item (same semantics as requireAuth). */
  permission?: string;
}

export interface ShellModule {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Landing route for the module (target of the module switcher). */
  home: string;
  /** Path prefixes that belong to this module. */
  prefixes: string[];
  /** Permission prefix required to open the module, e.g. "fms." */
  permission?: string;
  adminOnly?: boolean;
  items: ModuleNavItem[];
}

export const SHELL_MODULES: ShellModule[] = [
  {
    id: "fms",
    label: "Fleet Management",
    icon: Car,
    home: "/fleetmanagementsystem",
    prefixes: ["/fleetmanagementsystem"],
    permission: "fms.",
    items: [{ label: "Vehicles", to: "/fleetmanagementsystem", icon: Car }],
  },
  {
    id: "ims",
    label: "Inventory",
    icon: Boxes,
    home: "/inventorymanagementsystem",
    prefixes: ["/inventorymanagementsystem", "/subcategories"],
    permission: "ims.",
    items: [
      { label: "Categories", to: "/inventorymanagementsystem", icon: FolderOpen },
    ],
  },
  {
    id: "forms",
    label: "Forms",
    icon: ClipboardList,
    home: "/forms",
    prefixes: ["/forms", "/stockcontrolform", "/vehicleinspectionform"],
    items: [
      { label: "All Forms", to: "/forms", icon: ClipboardList },
      { label: "Stock Control", to: "/stockcontrolform", icon: Boxes, permission: "scf." },
      { label: "Vehicle Inspection", to: "/vehicleinspectionform", icon: ClipboardCheck, permission: "vif." },
    ],
  },
  {
    id: "crm",
    label: "Customer Relations",
    icon: Building2,
    home: "/customerrelationsmanagement",
    prefixes: ["/customerrelationsmanagement"],
    permission: "crm.",
    items: [{ label: "Customers", to: "/customerrelationsmanagement", icon: Building2 }],
  },
  {
    id: "hrd",
    label: "Human Resources",
    icon: UsersRound,
    home: "/humanresourcesdepartment",
    prefixes: ["/humanresourcesdepartment"],
    permission: "hrd.",
    items: [
      { label: "Employees", to: "/humanresourcesdepartment", icon: Users },
      { label: "Attendance", to: "/humanresourcesdepartment/attendance", icon: Clock },
    ],
  },
  {
    id: "jobcard",
    label: "Installation Jobcard",
    icon: Wrench,
    home: "/installationjobcard",
    prefixes: ["/installationjobcard"],
    items: [{ label: "Job Cards", to: "/installationjobcard", icon: Wrench }],
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    home: "/admin",
    prefixes: ["/admin"],
    adminOnly: true,
    items: [{ label: "Users & Permissions", to: "/admin", icon: ShieldCheck }],
  },
];

export function resolveModule(pathname: string): ShellModule | undefined {
  return SHELL_MODULES.find((m) =>
    m.prefixes.some((p) => pathname === p || pathname.startsWith(p + "/")),
  );
}