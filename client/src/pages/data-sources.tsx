import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DataSourceCard } from "@/components/data-source-card";
import { FileUpload } from "@/components/file-upload";
import { EmptyState } from "@/components/empty-state";
import { 
  Database, 
  Upload, 
  Key, 
  RefreshCw,
  CheckCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DataSource } from "@shared/schema";

export function DataSourcesPage() {
  const { toast } = useToast();
  const [refreshingSource, setRefreshingSource] = useState<string | null>(null);

  const { data: sources, isLoading } = useQuery<DataSource[]>({
    queryKey: ["/api/data-sources"],
  });

  const refreshMutation = useMutation({
    mutationFn: async (sourceName: string) => {
      setRefreshingSource(sourceName);
      return apiRequest("POST", `/api/data-sources/${sourceName}/refresh`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Refresh Started",
        description: "Data source is being refreshed. This may take a few minutes.",
      });
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Failed to start data refresh. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setRefreshingSource(null);
    },
  });

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch("/api/upload/excel", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    toast({
      title: "File Uploaded",
      description: `${file.name} has been processed successfully.`,
    });

    queryClient.invalidateQueries({ queryKey: ["/api/team-stats"] });
  };

  const actionNetwork = sources?.find(s => s.name === "actionnetwork");
  const teamRankings = sources?.find(s => s.name === "teamrankings");
  const kenPom = sources?.find(s => s.name === "kenpom");

  return (
    <div className="space-y-6" data-testid="data-sources-page">
      <div>
        <h1 className="text-2xl font-semibold">Data Sources</h1>
        <p className="text-sm text-muted-foreground">
          Manage your data connections and upload statistics
        </p>
      </div>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections" data-testid="tab-connections">
            <Database className="h-4 w-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Data
          </TabsTrigger>
          <TabsTrigger value="credentials" data-testid="tab-credentials">
            <Key className="h-4 w-4 mr-2" />
            Credentials
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[250px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {actionNetwork && (
                <DataSourceCard
                  source={actionNetwork}
                  onRefresh={() => refreshMutation.mutate("actionnetwork")}
                  isRefreshing={refreshingSource === "actionnetwork"}
                />
              )}
              {teamRankings && (
                <DataSourceCard
                  source={teamRankings}
                  onRefresh={() => refreshMutation.mutate("teamrankings")}
                  isRefreshing={refreshingSource === "teamrankings"}
                />
              )}
              {kenPom && (
                <DataSourceCard
                  source={kenPom}
                  onRefresh={() => refreshMutation.mutate("kenpom")}
                  isRefreshing={refreshingSource === "kenpom"}
                />
              )}
              {!sources?.length && (
                <EmptyState
                  icon={Database}
                  title="No Data Sources"
                  description="Configure your data sources to start pulling betting data."
                  className="col-span-3"
                />
              )}
            </div>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  <span>Auto-refresh runs every 15 minutes during active games</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    refreshMutation.mutate("actionnetwork");
                    refreshMutation.mutate("teamrankings");
                    refreshMutation.mutate("kenpom");
                  }}
                  data-testid="button-refresh-all"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh All
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Upload Excel Files</h3>
              <p className="text-sm text-muted-foreground">
                Upload your home/away split stats from TeamRankings or other sources.
                Files should include team statistics with proper column headers.
              </p>
              <FileUpload
                onUpload={handleFileUpload}
                title="Upload Stats File"
                description="Drag and drop your Excel or CSV file"
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Supported File Formats</h3>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">NFL Home/Away Splits</p>
                      <p className="text-xs text-muted-foreground">
                        PPP, YPP, RZ%, pace metrics by venue
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">NBA Home/Away Splits</p>
                      <p className="text-xs text-muted-foreground">
                        ORtg, DRtg, Four Factors, pace metrics
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">CFB Home/Away Splits</p>
                      <p className="text-xs text-muted-foreground">
                        PPP, YPP, plays per game, RZ efficiency
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">CBB Home/Away Splits</p>
                      <p className="text-xs text-muted-foreground">
                        KenPom-style efficiency ratings, tempo
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">No Credentials Required</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This platform uses Covers.com for real-time odds and betting data, 
                    which does not require login credentials. Team statistics can be 
                    uploaded via Excel files in the Upload Data tab.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
