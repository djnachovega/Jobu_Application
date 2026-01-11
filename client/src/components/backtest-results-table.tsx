import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { BacktestResult } from "@shared/schema";

interface BacktestResultsTableProps {
  results: BacktestResult[];
  onRowClick?: (result: BacktestResult) => void;
}

export function BacktestResultsTable({ results, onRowClick }: BacktestResultsTableProps) {
  return (
    <Card data-testid="backtest-results-table">
      <CardHeader>
        <CardTitle className="text-base">Backtesting Results</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sport</TableHead>
                <TableHead>Signal Type</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead className="text-right">Signals</TableHead>
                <TableHead className="text-right">Record</TableHead>
                <TableHead className="text-right">Win %</TableHead>
                <TableHead className="text-right">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No backtesting results yet. Run a backtest to see historical performance.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((result) => (
                  <TableRow 
                    key={result.id}
                    className={cn(
                      "cursor-pointer hover-elevate",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(result)}
                    data-testid={`backtest-row-${result.id}`}
                  >
                    <TableCell>
                      <Badge variant="outline">{result.sport}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatSignalType(result.signalType)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {formatDateRange(result.dateRangeStart, result.dateRangeEnd)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {result.totalSignals}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {result.wins}-{result.losses}
                      {result.pushes > 0 && `-${result.pushes}`}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-semibold",
                      result.winPercentage >= 55 ? "text-green-500" : 
                      result.winPercentage >= 50 ? "text-foreground" : "text-red-500"
                    )}>
                      {result.winPercentage.toFixed(1)}%
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-semibold",
                      (result.roi ?? 0) > 0 ? "text-green-500" : 
                      (result.roi ?? 0) < 0 ? "text-red-500" : "text-foreground"
                    )}>
                      {result.roi !== null ? `${result.roi > 0 ? "+" : ""}${result.roi.toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function formatSignalType(type: string): string {
  const mapping: Record<string, string> = {
    rlm: "Reverse Line Movement",
    handle_split: "Handle Split",
    model_edge: "Model Edge",
  };
  return mapping[type] || type;
}

function formatDateRange(start: Date | string, end: Date | string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const format = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${format(startDate)} - ${format(endDate)}`;
}
