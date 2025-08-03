import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Plug, 
  PlugZap, 
  Users, 
  Package, 
  FileText, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Upload
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface QuickBooksStatus {
  connected: boolean;
  companyId?: string;
  tokenValid?: boolean;
  tokenExpires?: string;
}

interface SyncResult {
  message: string;
  customers?: any[];
  items?: any[];
  vendors?: any[];
}

export default function QuickBooksIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get QuickBooks connection status
  const { data: qbStatus, isLoading: statusLoading } = useQuery<QuickBooksStatus>({
    queryKey: ["/api/quickbooks/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });

  // Get supported entities
  const { data: entitiesData } = useQuery({
    queryKey: ["/api/quickbooks/entities"],
    retry: false,
  });

  // Connect to QuickBooks
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/quickbooks/connect", {
        method: "GET",
      });
      return response;
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        setIsConnecting(true);
        window.open(data.authUrl, "_blank", "width=800,height=600");
        // Poll for connection status
        const pollInterval = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
        }, 2000);
        
        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsConnecting(false);
        }, 120000);
      }
    },
    onError: (error) => {
      toast({
        title: "Connection Error",
        description: "Failed to initialize QuickBooks connection",
        variant: "destructive",
      });
    },
  });

  // Disconnect from QuickBooks
  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("/api/quickbooks/disconnect", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      toast({
        title: "Disconnected",
        description: "QuickBooks has been disconnected successfully",
      });
    },
    onError: () => {
      toast({
        title: "Disconnect Error",
        description: "Failed to disconnect QuickBooks",
        variant: "destructive",
      });
    },
  });

  // Sync customers
  const syncCustomersMutation = useMutation({
    mutationFn: () => apiRequest("/api/quickbooks/sync/customers", { method: "POST" }),
    onSuccess: (data: SyncResult) => {
      toast({
        title: "Sync Complete",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Sync Error",
        description: "Failed to sync customers from QuickBooks",
        variant: "destructive",
      });
    },
  });

  // Sync items
  const syncItemsMutation = useMutation({
    mutationFn: () => apiRequest("/api/quickbooks/sync/items", { method: "POST" }),
    onSuccess: (data: SyncResult) => {
      toast({
        title: "Sync Complete",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Sync Error",
        description: "Failed to sync items from QuickBooks",
        variant: "destructive",
      });
    },
  });

  // Stop polling when connection is established
  useEffect(() => {
    if (qbStatus?.connected && isConnecting) {
      setIsConnecting(false);
      toast({
        title: "Connected!",
        description: "QuickBooks has been connected successfully",
      });
    }
  }, [qbStatus?.connected, isConnecting, toast]);

  const getStatusIcon = () => {
    if (statusLoading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (!qbStatus?.connected) return <XCircle className="h-4 w-4 text-red-500" />;
    if (!qbStatus?.tokenValid) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (statusLoading) return "Checking connection...";
    if (!qbStatus?.connected) return "Not connected";
    if (!qbStatus?.tokenValid) return "Token expired";
    return "Connected";
  };

  const getStatusVariant = () => {
    if (!qbStatus?.connected) return "destructive";
    if (!qbStatus?.tokenValid) return "secondary";
    return "default";
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QuickBooks Integration</h1>
          <p className="text-muted-foreground">
            Connect your QuickBooks Online account to sync customers, vendors, and financial data
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Manage your QuickBooks Online connection and view sync details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">{getStatusText()}</span>
              <Badge variant={getStatusVariant() as any}>
                {qbStatus?.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            <div className="flex gap-2">
              {qbStatus?.connected ? (
                <Button 
                  variant="destructive" 
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  <Plug className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              ) : (
                <Button 
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending || isConnecting}
                >
                  <PlugZap className="h-4 w-4 mr-2" />
                  {isConnecting ? "Connecting..." : "Connect to QuickBooks"}
                </Button>
              )}
            </div>
          </div>

          {qbStatus?.connected && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm font-medium">Company ID</p>
                <p className="text-sm text-muted-foreground">{qbStatus.companyId}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Token Expires</p>
                <p className="text-sm text-muted-foreground">
                  {qbStatus.tokenExpires ? new Date(qbStatus.tokenExpires).toLocaleString() : "Unknown"}
                </p>
              </div>
            </div>
          )}

          {isConnecting && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please complete the authorization in the popup window. This page will update automatically once connected.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Data Synchronization */}
      {qbStatus?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Data Synchronization
            </CardTitle>
            <CardDescription>
              Sync data between QuickBooks and Printyx
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <h3 className="font-semibold">Customers</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Import customers from QuickBooks as business records in Printyx
                </p>
                <Button 
                  onClick={() => syncCustomersMutation.mutate()}
                  disabled={syncCustomersMutation.isPending}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {syncCustomersMutation.isPending ? "Syncing..." : "Sync Customers"}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  <h3 className="font-semibold">Products & Services</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Import items and services from QuickBooks product catalog
                </p>
                <Button 
                  onClick={() => syncItemsMutation.mutate()}
                  disabled={syncItemsMutation.isPending}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {syncItemsMutation.isPending ? "Syncing..." : "Sync Items"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supported Entities */}
      {entitiesData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Supported QuickBooks Entities
            </CardTitle>
            <CardDescription>
              Data types that can be synchronized between QuickBooks and Printyx
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {entitiesData.supported_entities?.map((entity: string) => (
                <Badge key={entity} variant="outline" className="justify-center py-2">
                  {entity}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Benefits</CardTitle>
          <CardDescription>
            What you gain by connecting QuickBooks with Printyx
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h4 className="font-semibold">Unified Customer Data</h4>
              <p className="text-sm text-muted-foreground">
                Access QuickBooks customer information directly within Printyx business records
              </p>
            </div>
            <div className="space-y-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h4 className="font-semibold">Financial Synchronization</h4>
              <p className="text-sm text-muted-foreground">
                Keep financial data in sync between both systems for accurate reporting
              </p>
            </div>
            <div className="space-y-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h4 className="font-semibold">Automated Workflows</h4>
              <p className="text-sm text-muted-foreground">
                Reduce manual data entry with automated synchronization
              </p>
            </div>
            <div className="space-y-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h4 className="font-semibold">Real-time Updates</h4>
              <p className="text-sm text-muted-foreground">
                Changes in QuickBooks automatically reflect in Printyx
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}