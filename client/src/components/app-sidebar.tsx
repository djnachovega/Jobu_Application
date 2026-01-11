import { 
  LayoutDashboard, 
  TrendingUp, 
  Database, 
  History, 
  Settings,
  Zap,
  Activity,
  Target
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Opportunities",
    url: "/opportunities",
    icon: Target,
  },
  {
    title: "RLM Signals",
    url: "/rlm",
    icon: TrendingUp,
  },
  {
    title: "Backtesting",
    url: "/backtesting",
    icon: History,
  },
];

const dataNavItems = [
  {
    title: "Data Sources",
    url: "/data-sources",
    icon: Database,
  },
  {
    title: "AI Patterns",
    url: "/patterns",
    icon: Zap,
  },
];

const sportFilters = [
  { name: "NFL", color: "bg-blue-500" },
  { name: "NBA", color: "bg-orange-500" },
  { name: "CFB", color: "bg-green-500" },
  { name: "CBB", color: "bg-purple-500" },
];

interface AppSidebarProps {
  activeSports: string[];
  onSportToggle: (sport: string) => void;
}

export function AppSidebar({ activeSports, onSportToggle }: AppSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">Jobu Analytics</h1>
            <p className="text-xs text-muted-foreground">Sports Betting Intelligence</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sports Filter</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-wrap gap-2 px-2 py-1">
              {sportFilters.map((sport) => (
                <Badge
                  key={sport.name}
                  variant={activeSports.includes(sport.name) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    activeSports.includes(sport.name) && sport.color
                  )}
                  onClick={() => onSportToggle(sport.name)}
                  data-testid={`filter-sport-${sport.name.toLowerCase()}`}
                >
                  {sport.name}
                </Badge>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Data & Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dataNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location === "/settings"}>
              <Link href="/settings" data-testid="nav-settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
