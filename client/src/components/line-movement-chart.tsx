import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LineMovement } from "@shared/schema";

interface LineMovementChartProps {
  movements: LineMovement[];
  marketType: "spread" | "total" | "moneyline";
  openingLine?: number;
  currentLine?: number;
}

export function LineMovementChart({ 
  movements, 
  marketType, 
  openingLine,
  currentLine 
}: LineMovementChartProps) {
  const chartData = movements.map((m, idx) => ({
    time: new Date(m.capturedAt).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    }),
    value: m.currentValue,
    direction: m.movementDirection,
  }));

  const minValue = Math.min(...movements.map(m => m.currentValue)) - 1;
  const maxValue = Math.max(...movements.map(m => m.currentValue)) + 1;

  const totalMovement = currentLine && openingLine 
    ? currentLine - openingLine 
    : 0;

  return (
    <Card data-testid="line-movement-chart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {marketType === "spread" ? "Spread Movement" : 
             marketType === "total" ? "Total Movement" : "Moneyline Movement"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {openingLine !== undefined && (
              <Badge variant="outline" className="text-xs font-mono">
                Open: {openingLine > 0 ? "+" : ""}{openingLine}
              </Badge>
            )}
            {currentLine !== undefined && (
              <Badge variant="secondary" className="text-xs font-mono">
                Current: {currentLine > 0 ? "+" : ""}{currentLine}
              </Badge>
            )}
            {totalMovement !== 0 && (
              <Badge 
                variant="outline" 
                className={totalMovement > 0 ? "text-green-500 border-green-500/20" : "text-red-500 border-red-500/20"}
              >
                {totalMovement > 0 ? "+" : ""}{totalMovement.toFixed(1)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10 }} 
                className="text-muted-foreground"
                tickLine={false}
              />
              <YAxis 
                domain={[minValue, maxValue]} 
                tick={{ fontSize: 10 }} 
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              {openingLine !== undefined && (
                <ReferenceLine 
                  y={openingLine} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="5 5"
                  label={{ value: 'Open', position: 'left', fontSize: 10 }}
                />
              )}
              <Line 
                type="stepAfter" 
                dataKey="value" 
                stroke="hsl(var(--chart-1))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-1))', r: 3 }}
                activeDot={{ r: 5, fill: 'hsl(var(--chart-1))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
