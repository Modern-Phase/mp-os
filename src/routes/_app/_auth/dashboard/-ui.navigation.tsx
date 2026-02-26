import { useState } from "react";
import {
  Slash,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  Users,
  FileText,
  BarChart3,
  MessageSquare,
  Bot,
  FolderKanban,
  Receipt,
  ScrollText,
  GitBranch,
  Mail,
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

const navItems = [
  { label: "Mission Control", path: "/dashboard", icon: Home },
  { label: "Projects", path: "/dashboard/projects", icon: FolderKanban },
  { label: "CRM", path: "/dashboard/crm", icon: Users },
  { label: "Documents", path: "/dashboard/documents", icon: FileText },
  { label: "Analytics", path: "/dashboard/analytics", icon: BarChart3 },
  { label: "Invoices", path: "/dashboard/invoices", icon: Receipt },
  { label: "Proposals", path: "/dashboard/proposals", icon: FileText },
  { label: "Contracts", path: "/dashboard/contracts", icon: ScrollText },
  { label: "Workflows", path: "/dashboard/workflows", icon: GitBranch },
  { label: "Sequences", path: "/dashboard/sequences", icon: Mail },
  { label: "AI Chat", path: "/chat", icon: MessageSquare },
  { label: "Agent Chat", path: "/dashboard/agent-chat", icon: Bot },
];

export function Navigation({ user }: { user: User }) {
  const signOut = useSignOut();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  if (!user) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full glass border-b border-glass-border">
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between px-4 py-2 lg:px-6">
        <div className="flex h-10 items-center gap-2">
          <Link to="/dashboard" className="flex h-10 items-center gap-1">
            <Logo />
          </Link>
          <Slash className="h-6 w-6 -rotate-12 stroke-[1.5px] text-primary/10 hidden sm:block" />
          <div className="hidden sm:block">
            <OrganizationSwitcher user={user} />
          </div>
        </div>

        <div className="hidden lg:flex h-10 items-center gap-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex h-10 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          <NotificationPanel />

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full">
                {user.avatarUrl ? (
                  <img
                    className="h-8 w-8 rounded-full object-cover"
                    alt={user.username ?? user.email}
                    src={user.avatarUrl}
                  />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-medium">
                    {(user.username || user.email || "U")[0].toUpperCase()}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              sideOffset={8}
              className="fixed -right-2 min-w-56 glass p-2"
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
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border animate-fade-down">
          <div className="px-4 py-3 space-y-1">
            <div className="sm:hidden py-2">
              <OrganizationSwitcher user={user} />
            </div>
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
