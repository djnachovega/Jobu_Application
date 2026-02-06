import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/components/theme-provider";
import { Save, RefreshCw, Bell, Clock, Palette, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [refreshInterval, setRefreshInterval] = useState("15");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [highConfOnly, setHighConfOnly] = useState(false);
  const [minEdge, setMinEdge] = useState("3");
  const [maxVolatility, setMaxVolatility] = useState("65");

  const { data: savedSettings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (savedSettings) {
      if (savedSettings.refreshInterval) setRefreshInterval(savedSettings.refreshInterval);
      if (savedSettings.autoRefresh) setAutoRefresh(savedSettings.autoRefresh === "true");
      if (savedSettings.notifications) setNotifications(savedSettings.notifications === "true");
      if (savedSettings.highConfOnly) setHighConfOnly(savedSettings.highConfOnly === "true");
      if (savedSettings.minEdge) setMinEdge(savedSettings.minEdge);
      if (savedSettings.maxVolatility) setMaxVolatility(savedSettings.maxVolatility);
    }
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/settings", {
        refreshInterval,
        autoRefresh: String(autoRefresh),
        notifications: String(notifications),
        highConfOnly: String(highConfOnly),
        minEdge,
        maxVolatility,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your preferences and algorithm parameters
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Appearance</CardTitle>
          </div>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="theme">Theme</Label>
              <p className="text-sm text-muted-foreground">Select your preferred color scheme</p>
            </div>
            <Select value={theme} onValueChange={(v) => setTheme(v as "dark" | "light" | "system")}>
              <SelectTrigger className="w-[140px]" data-testid="select-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Data Refresh</CardTitle>
          </div>
          <CardDescription>Control how often data is updated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-refresh">Auto Refresh</Label>
              <p className="text-sm text-muted-foreground">Automatically refresh data during games</p>
            </div>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              data-testid="switch-auto-refresh"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="interval">Refresh Interval</Label>
              <p className="text-sm text-muted-foreground">Minutes between data updates</p>
            </div>
            <Select value={refreshInterval} onValueChange={setRefreshInterval}>
              <SelectTrigger className="w-[100px]" data-testid="select-refresh-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 min</SelectItem>
                <SelectItem value="10">10 min</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Notifications</CardTitle>
          </div>
          <CardDescription>Configure alert preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notifications">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">Get alerts for new opportunities</p>
            </div>
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={setNotifications}
              data-testid="switch-notifications"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="high-conf">High Confidence Only</Label>
              <p className="text-sm text-muted-foreground">Only notify for high confidence plays</p>
            </div>
            <Switch
              id="high-conf"
              checked={highConfOnly}
              onCheckedChange={setHighConfOnly}
              data-testid="switch-high-conf"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Algorithm Parameters</CardTitle>
          </div>
          <CardDescription>Fine-tune opportunity detection thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-edge">Minimum Edge %</Label>
              <Input
                id="min-edge"
                type="number"
                value={minEdge}
                onChange={(e) => setMinEdge(e.target.value)}
                min="1"
                max="10"
                step="0.5"
                data-testid="input-min-edge"
              />
              <p className="text-xs text-muted-foreground">
                Only show opportunities with at least this edge
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-volatility">Maximum Volatility</Label>
              <Input
                id="max-volatility"
                type="number"
                value={maxVolatility}
                onChange={(e) => setMaxVolatility(e.target.value)}
                min="40"
                max="100"
                step="5"
                data-testid="input-max-volatility"
              />
              <p className="text-xs text-muted-foreground">
                Filter out plays above this volatility score
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-settings">
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
