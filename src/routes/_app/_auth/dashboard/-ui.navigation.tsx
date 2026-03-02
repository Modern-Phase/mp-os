import { useState, useEffect } from "react";
import {
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  Users,
  FileText,
  Bot,
  FolderKanban,
  Receipt,
  ScrollText,
  GitBranch,
  Mail,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { cn, useSignOut } from "@/utils/misc";
import { ThemeSwitcher } from "@/ui/theme-switcher";
import { LanguageSwitcher } from "@/ui/language-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/ui/dropdown-menu";
import { Button } from "@/ui/button";
import { Logo } from "@/ui/logo";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { NotificationPanel } from "@/components/NotificationPanel";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { User } from "~/types";

const SIDEBAR_KEY = "mp-sidebar-collapsed";

type NavGroup = {
  label: string;
  items: { label: string; path: string; icon: React.ComponentType<{ className?: string }> }[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Mission Control", path: "/dashboard", icon: Home },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Projects", path: "/dashboard/projects", icon: FolderKanban },
      { label: "Documents", path: "/dashboard/documents", icon: FileText },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "CRM", path: "/dashboard/crm", icon: Users },
      { label: "Finances", path: "/dashboard/finances", icon: DollarSign },
      { label: "Invoices", path: "/dashboard/invoices", icon: Receipt },
      { label: "Proposals", path: "/dashboard/proposals", icon: FileText },
      { label: "Contracts", path: "/dashboard/contracts", icon: ScrollText },
    ],
  },
  {
    label: "Automation",
    items: [
      { label: "Workflows", path: "/dashboard/workflows", icon: GitBranch },
      { label: "Sequences", path: "/dashboard/sequences", icon: Mail },
    ],
  },
  {
    label: "AI",
    items: [
      { label: "Agent Chat", path: "/dashboard/agent-chat", icon: Bot },
      { label: "AI Chat", path: "/chat", icon: MessageSquare },
    ],
  },
];

export function Navigation({ user }: { user: User }) {
  const signOut = useSignOut();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  }, [collapsed]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  if (!user) return null;

  const sidebarContent = (
    <>
      {/* Logo / Org */}
      <div className={cn("flex items-center gap-2 px-3 py-4 border-b border-glass-border", collapsed && "justify-center px-0")}>
        <Link to="/dashboard" className="flex items-center gap-2">
          <Logo />
          {!collapsed && <span className="text-sm font-semibold text-foreground truncate hidden lg:inline">MP OS</span>}
        </Link>
      </div>

      {!collapsed && (
        <div className="px-3 py-3 border-b border-glass-border">
          <OrganizationSwitcher user={user} />
        </div>
      )}

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150",
                      collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className={cn("border-t border-glass-border p-2 space-y-1", collapsed && "flex flex-col items-center")}>
        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4 mx-auto" /> : (
            <>
              <ChevronsLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>

        {/* Notifications */}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "px-1")}>
          <NotificationPanel />
        </div>

        {/* User dropdown */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center gap-3 w-full rounded-lg px-2 py-2 text-sm hover:bg-muted/50 transition-colors",
              collapsed && "justify-center",
            )}>
              {user.avatarUrl ? (
                <img
                  className="h-7 w-7 rounded-full object-cover shrink-0"
                  alt={user.username ?? user.email}
                  src={user.avatarUrl}
                />
              ) : (
                <span className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-medium shrink-0">
                  {(user.username || user.email || "U")[0].toUpperCase()}
                </span>
              )}
              {!collapsed && (
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                    {user.username || user.email}
                  </span>
                  {user.username && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {user.email}
                    </span>
                  )}
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            sideOffset={8}
            align="end"
            className="min-w-56 glass p-2"
          >
            <DropdownMenuItem className="group flex-col items-start focus:bg-transparent">
              <p className="text-sm font-medium text-foreground">
                {user?.username || ""}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="mx-0 my-2" />

            <DropdownMenuItem
              className="group h-9 w-full cursor-pointer justify-between rounded-md px-2"
              onClick={() => navigate({ to: "/dashboard/settings" })}
            >
              <span className="text-sm text-muted-foreground group-hover:text-foreground">
                Settings
              </span>
              <Settings className="h-[18px] w-[18px] stroke-[1.5px] text-muted-foreground group-hover:text-foreground" />
            </DropdownMenuItem>

            <DropdownMenuItem
              className={cn(
                "group flex h-9 justify-between rounded-md px-2 hover:bg-transparent",
              )}
            >
              <span className="w-full text-sm text-muted-foreground group-hover:text-foreground">
                Theme
              </span>
              <ThemeSwitcher />
            </DropdownMenuItem>

            <DropdownMenuItem
              className={cn(
                "group flex h-9 justify-between rounded-md px-2 hover:bg-transparent",
              )}
            >
              <span className="w-full text-sm text-muted-foreground group-hover:text-foreground">
                Language
              </span>
              <LanguageSwitcher />
            </DropdownMenuItem>

            <DropdownMenuSeparator className="mx-0 my-2" />

            <DropdownMenuItem
              className="group h-9 w-full cursor-pointer justify-between rounded-md px-2"
              onClick={() => signOut()}
            >
              <span className="text-sm text-muted-foreground group-hover:text-foreground">
                Log Out
              </span>
              <LogOut className="h-[18px] w-[18px] stroke-[1.5px] text-muted-foreground group-hover:text-foreground" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen sticky top-0 z-40 glass border-r border-glass-border transition-all duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-50 flex items-center justify-between h-14 px-4 glass border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <Logo />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <NotificationPanel />
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full">
                {user.avatarUrl ? (
                  <img className="h-8 w-8 rounded-full object-cover" alt={user.username ?? user.email} src={user.avatarUrl} />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-medium">
                    {(user.username || user.email || "U")[0].toUpperCase()}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={8} className="min-w-56 glass p-2">
              <DropdownMenuItem className="group flex-col items-start focus:bg-transparent">
                <p className="text-sm font-medium text-foreground">{user?.username || ""}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-0 my-2" />
              <DropdownMenuItem className="group h-9 w-full cursor-pointer justify-between rounded-md px-2" onClick={() => navigate({ to: "/dashboard/settings" })}>
                <span className="text-sm text-muted-foreground group-hover:text-foreground">Settings</span>
                <Settings className="h-[18px] w-[18px] stroke-[1.5px] text-muted-foreground group-hover:text-foreground" />
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-0 my-2" />
              <DropdownMenuItem className="group h-9 w-full cursor-pointer justify-between rounded-md px-2" onClick={() => signOut()}>
                <span className="text-sm text-muted-foreground group-hover:text-foreground">Log Out</span>
                <LogOut className="h-[18px] w-[18px] stroke-[1.5px] text-muted-foreground group-hover:text-foreground" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col glass border-r border-glass-border animate-slide-in-left">
            <div className="flex items-center justify-between px-3 py-3 border-b border-glass-border">
              <Link to="/dashboard" className="flex items-center gap-2">
                <Logo />
                <span className="text-sm font-semibold text-foreground">MP OS</span>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="px-3 py-3 border-b border-glass-border">
              <OrganizationSwitcher user={user} />
            </div>

            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item.path);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
