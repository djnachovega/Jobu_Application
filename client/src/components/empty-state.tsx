import { LucideIcon, Search, TrendingUp, Database, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  icon: Icon = Search, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
      data-testid="empty-state"
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick} data-testid="empty-state-action">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function NoOpportunities({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon={TrendingUp}
      title="No Opportunities Found"
      description="No betting opportunities match your current filters. Try adjusting your sport selections or wait for new data."
      action={onRefresh ? { label: "Refresh Data", onClick: onRefresh } : undefined}
    />
  );
}

export function NoGames({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No Games Today"
      description="There are no scheduled games for the selected sports. Check back later or select different sports."
      action={onRefresh ? { label: "Refresh Data", onClick: onRefresh } : undefined}
    />
  );
}

export function NoData({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={Database}
      title="No Data Available"
      description="Connect your data sources or upload Excel files to get started with analysis."
      action={onUpload ? { label: "Upload Data", onClick: onUpload } : undefined}
    />
  );
}

export function NoBacktestResults({ onRun }: { onRun?: () => void }) {
  return (
    <EmptyState
      icon={FileSpreadsheet}
      title="No Backtest Results"
      description="Run a backtest to analyze historical performance of RLM signals and model predictions."
      action={onRun ? { label: "Run Backtest", onClick: onRun } : undefined}
    />
  );
}
