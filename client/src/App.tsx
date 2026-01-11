import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { 
  SidebarProvider, 
  SidebarTrigger,
  SidebarInset
} from "@/components/ui/sidebar";
import { Dashboard } from "@/pages/dashboard";
import { OpportunitiesPage } from "@/pages/opportunities";
import { RlmSignalsPage } from "@/pages/rlm-signals";
import { BacktestingPage } from "@/pages/backtesting";
import { DataSourcesPage } from "@/pages/data-sources";
import { PatternsPage } from "@/pages/patterns";
import { SettingsPage } from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router({ activeSports }: { activeSports: string[] }) {
  return (
    <Switch>
      <Route path="/">
        <Dashboard activeSports={activeSports} />
      </Route>
      <Route path="/opportunities">
        <OpportunitiesPage activeSports={activeSports} />
      </Route>
      <Route path="/rlm">
        <RlmSignalsPage activeSports={activeSports} />
      </Route>
      <Route path="/backtesting">
        <BacktestingPage activeSports={activeSports} />
      </Route>
      <Route path="/data-sources">
        <DataSourcesPage />
      </Route>
      <Route path="/patterns">
        <PatternsPage activeSports={activeSports} />
      </Route>
      <Route path="/settings">
        <SettingsPage />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const [activeSports, setActiveSports] = useState<string[]>(["NFL", "NBA", "CFB", "CBB"]);

  const handleSportToggle = (sport: string) => {
    setActiveSports(prev => 
      prev.includes(sport) 
        ? prev.filter(s => s !== sport)
        : [...prev, sport]
    );
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          activeSports={activeSports} 
          onSportToggle={handleSportToggle} 
        />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Router activeSports={activeSports} />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="jobu-ui-theme">
        <TooltipProvider>
          <AppLayout />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
