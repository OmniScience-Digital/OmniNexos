// Layout route: module sidebar + routed content.
// The existing fixed <Navbar/> and <Footer/> (rendered in App.tsx) are kept
// as-is, so theme toggle, user menu, sign-out and TEST ENV banner are untouched.
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronsUpDown, ArrowLeft, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { SHELL_MODULES, resolveModule, type ShellModule } from "./modules";

function useCanAccess() {
  const { permission } = useAuth();
  const isAdmin = Boolean(permission?.isAdmin || permission?.permissions?.includes("admin"));
  const has = (prefix?: string) =>
    !prefix || isAdmin || Boolean(permission?.permissions?.some((p) => p.startsWith(prefix)));
  return {
    isAdmin,
    module: (m: ShellModule) => (m.adminOnly ? isAdmin : has(m.permission)),
    item: (prefix?: string) => has(prefix),
  };
}

export default function ModuleShell() {
  const { pathname } = useLocation();
  const current = resolveModule(pathname);
  const can = useCanAccess();

  if (!current) return <Outlet />;

  const Icon = current.icon;
  const items = current.items.filter((i) => can.item(i.permission));
  const switchable = SHELL_MODULES.filter((m) => can.module(m));

  return (
    <>
      <aside
        aria-label={`${current.label} navigation`}
        className="hidden md:flex fixed left-0 top-28 bottom-9 z-40 w-60 flex-col gap-1 border-r border-border bg-sidebar p-3 text-sidebar-foreground"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-medium hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{current.label}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {switchable.map((m) => (
              <DropdownMenuItem key={m.id} asChild className="cursor-pointer">
                <Link to={m.home} className="flex items-center gap-2">
                  <m.icon className="h-4 w-4" />
                  <span className="flex-1">{m.label}</span>
                  {m.id === current.id && <Check className="h-4 w-4" />}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Link
          to="/landing"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All dashboards
        </Link>

        <nav className="flex flex-col gap-0.5">
          {items.map(({ label, to, icon: ItemIcon }) => (
            <NavLink
              key={to}
              to={to}
              end={false}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )
              }
            >
              <ItemIcon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="md:pl-60 flex flex-1 flex-col min-w-0">
        <Outlet />
      </div>
    </>
  );
}
