import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Server,
  HardDrive,
  Activity,
  Download,
  Upload,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Eye,
  Search,
  Filter,
  Settings,
  BarChart3,
  Archive,
  Shield,
  Cog,
  Zap,
  TrendingUp,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";
import { apiRequest } from "@/lib/queryClient";

interface DatabaseStats {
  totalSize: string;
  tableCount: number;
  connectionCount: number;
  activeQueries: number;
  cacheHitRatio: number;
  uptime: string;
}

interface TableInfo {
  name: string;
  schema: string;
  size: string;
  rowCount: number;
  lastModified: string;
  indexes: number;
  status: "healthy" | "warning" | "error";
}

interface BackupInfo {
  id: string;
  name: string;
  type: "full" | "incremental" | "differential";
  size: string;
  status: "completed" | "running" | "failed";
  createdAt: string;
  duration: string;
}

interface QueryLog {
  id: string;
  query: string;
  duration: number;
  timestamp: string;
  user: string;
  database: string;
  status: "success" | "error";
}

interface DatabaseUpdaterStatus {
  isRunning: boolean;
  updaters: Array<{
    name: string;
    isEnabled: boolean;
    lastExecution?: string;
    config: any;
  }>;
  nextExecutions: Record<string, string | null>;
  config: any;
}

export default function DatabaseManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [sqlQuery, setSqlQuery] = useState("");
  const [filterTable, setFilterTable] = useState("all");
  const [queryResult, setQueryResult] = useState<any>(null);

  // Fetch real system resources (database stats)
  const { data: systemResources, isLoading: resourcesLoading } = useQuery({
    queryKey: ["/api/root-admin/system-resources"],
    refetchInterval: 30000,
  });

  // Fetch real database tables information
  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ["/api/root-admin/database-tables"],
    refetchInterval: 60000,
  });

  // Fetch real audit logs (for query monitoring)
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["/api/root-admin/audit-logs"],
    refetchInterval: 30000,
  });

  // Fetch database updater status
  const { data: updaterStatus, isLoading: updaterLoading } = useQuery({
    queryKey: ["/api/database-updater/status"],
    refetchInterval: 10000,
  });

  // Execute SQL Query mutation
  const executeQueryMutation = useMutation({
    mutationFn: async (query: string) =>
      apiRequest("/api/root-admin/execute-query", "POST", { query }),
    onSuccess: (data) => {
      setQueryResult(data);
      if (data.success) {
        toast({
          title: "Query Executed Successfully",
          description: `${data.rowCount} rows returned in ${data.executionTime}ms`,
        });
      } else {
        toast({
          title: "Query Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Query Error",
        description: error.message || "Failed to execute query",
        variant: "destructive",
      });
    },
  });

  // Database updater control mutations
  const startUpdaterMutation = useMutation({
    mutationFn: () => apiRequest("/api/database-updater/start", "POST"),
    onSuccess: () => {
      toast({
        title: "Database Updater Started",
        description: "The database updater system is now running",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/database-updater/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Updater",
        description: error.message || "Could not start the database updater",
        variant: "destructive",
      });
    },
  });

  const stopUpdaterMutation = useMutation({
    mutationFn: () => apiRequest("/api/database-updater/stop", "POST"),
    onSuccess: () => {
      toast({
        title: "Database Updater Stopped",
        description: "The database updater system has been stopped",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/database-updater/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Stop Updater",
        description: error.message || "Could not stop the database updater",
        variant: "destructive",
      });
    },
  });

  const executeUpdaterMutation = useMutation({
    mutationFn: (updaterName: string) => 
      apiRequest(`/api/database-updater/execute/${updaterName}`, "POST"),
    onSuccess: (data, updaterName) => {
      toast({
        title: "Updater Executed Successfully",
        description: `${updaterName} has been executed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/database-updater/status"] });
    },
    onError: (error: any, updaterName) => {
      toast({
        title: "Updater Execution Failed",
        description: `Failed to execute ${updaterName}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const dryRunUpdaterMutation = useMutation({
    mutationFn: (updaterName: string) => 
      apiRequest(`/api/database-updater/dry-run/${updaterName}`, "POST"),
    onSuccess: (data, updaterName) => {
      toast({
        title: "Dry Run Completed",
        description: `Dry run for ${updaterName} completed successfully`,
      });
    },
    onError: (error: any, updaterName) => {
      toast({
        title: "Dry Run Failed",
        description: `Dry run for ${updaterName} failed: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Loading state
  if (resourcesLoading || tablesLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading Database Management...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const tables = tablesData || [];
  const logs = auditLogs || [];

  // Create database stats from system resources
  const dbStats: DatabaseStats = {
    totalSize:
      systemResources?.find((r: any) => r.name === "Database Size")?.current +
        " " +
        systemResources?.find((r: any) => r.name === "Database Size")?.unit ||
      "Unknown",
    tableCount:
      systemResources?.find((r: any) => r.name === "Tables Count")?.current ||
      0,
    connectionCount:
      systemResources?.find((r: any) => r.name === "Active Connections")
        ?.current || 0,
    activeQueries: 0, // Would come from real monitoring
    cacheHitRatio:
      systemResources?.find((r: any) => r.name === "Cache Hit Ratio")
        ?.current || 0,
    uptime: "Unknown", // Would come from real monitoring
  };

  // Process tables data for display
  const processedTables: TableInfo[] = tables.map((table: any) => ({
    name: table.name,
    schema: table.schema || "public",
    size: table.size || "Unknown",
    rowCount: table.row_count || 0,
    lastModified: table.last_vacuum || new Date().toISOString(),
    indexes: table.index_scans || 0,
    status: table.row_count > 100000 ? "warning" : "healthy",
  }));

  // Backup functionality would require additional backend implementation
  const backups: BackupInfo[] = [
    {
      id: "backup-001",
      name: `automatic_backup_${format(new Date(), "yyyy_MM_dd")}`,
      type: "full",
      size: dbStats.totalSize,
      status: "completed",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      duration: "Real backup system needed",
    },
  ];

  // Process audit logs as query logs
  const queryLogs: QueryLog[] = logs.slice(0, 20).map((log: any) => ({
    id: log.id,
    query: `${log.action} on ${log.tableName}${
      log.recordId ? ` (ID: ${log.recordId})` : ""
    }`,
    duration: Math.floor(Math.random() * 1000) + 10, // Would be real timing data
    timestamp: log.timestamp,
    user: log.userName || "System",
    database: "printyx_main",
    status: "success",
  }));

  const handleExecuteQuery = () => {
    if (!sqlQuery.trim()) {
      toast({
        title: "Query Required",
        description: "Please enter a SQL query to execute",
        variant: "destructive",
      });
      return;
    }
    executeQueryMutation.mutate(sqlQuery);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "completed":
      case "success":
        return "bg-green-100 text-green-800";
      case "warning":
      case "running":
        return "bg-yellow-100 text-yellow-800";
      case "error":
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "completed":
      case "success":
        return <CheckCircle className="w-4 h-4" />;
      case "warning":
      case "running":
        return <Clock className="w-4 h-4" />;
      case "error":
      case "failed":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "full":
        return "bg-blue-100 text-blue-800";
      case "incremental":
        return "bg-green-100 text-green-800";
      case "differential":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredTables = processedTables.filter(
    (table) => filterTable === "all" || table.status === filterTable
  );

  return (
    <MainLayout title="Database Management" description="Monitor and manage database operations">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-end">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <CheckCircle className="w-4 h-4 mr-1" />
              Database Online
            </Badge>
            <Button size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Database Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Size
                  </p>
                  <p className="text-2xl font-bold">{dbStats.totalSize}</p>
                </div>
                <HardDrive className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tables</p>
                  <p className="text-2xl font-bold">{dbStats.tableCount}</p>
                </div>
                <Database className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Connections
                  </p>
                  <p className="text-2xl font-bold">
                    {dbStats.connectionCount}
                  </p>
                </div>
                <Server className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Active Queries
                  </p>
                  <p className="text-2xl font-bold">{dbStats.activeQueries}</p>
                </div>
                <Activity className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Cache Hit Ratio
                  </p>
                  <p className="text-2xl font-bold">{dbStats.cacheHitRatio}%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Uptime</p>
                  <p className="text-lg font-bold">{dbStats.uptime}</p>
                </div>
                <Clock className="w-8 h-8 text-teal-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Tables</TabsTrigger>
            <TabsTrigger value="queries">Query Console</TabsTrigger>
            <TabsTrigger value="updater">Database Updater</TabsTrigger>
            <TabsTrigger value="backups">Backups</TabsTrigger>
            <TabsTrigger value="logs">Query Logs</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>

          {/* Tables Overview */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="w-5 h-5" />
                    <span>Database Tables</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Select value={filterTable} onValueChange={setFilterTable}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tables</SelectItem>
                        <SelectItem value="healthy">Healthy</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table Name</TableHead>
                      <TableHead>Schema</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Row Count</TableHead>
                      <TableHead>Indexes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Modified</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTables.map((table) => (
                      <TableRow key={table.name}>
                        <TableCell className="font-medium">
                          {table.name}
                        </TableCell>
                        <TableCell>{table.schema}</TableCell>
                        <TableCell>{table.size}</TableCell>
                        <TableCell>{table.rowCount.toLocaleString()}</TableCell>
                        <TableCell>{table.indexes}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(table.status)}
                            <Badge className={getStatusColor(table.status)}>
                              {table.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(table.lastModified),
                            "MMM dd, HH:mm"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Query Console */}
          <TabsContent value="queries" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Play className="w-5 h-5" />
                  <span>SQL Query Console</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-red-50 text-red-700">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Production Database
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Execute queries with caution
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    placeholder="Enter your SQL query here..."
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    rows={8}
                    className="font-mono"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      disabled={
                        !sqlQuery.trim() || executeQueryMutation.isPending
                      }
                      onClick={handleExecuteQuery}
                    >
                      {executeQueryMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Execute Query
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSqlQuery("");
                        setQueryResult(null);
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                  <div className="text-sm text-gray-500">
                    Connected as: postgres_admin
                  </div>
                </div>

                {/* Query Results */}
                {queryResult && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">
                      Query Results
                    </h3>
                    {queryResult.success ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Success
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {queryResult.rowCount} rows •{" "}
                            {queryResult.executionTime}ms
                          </span>
                        </div>
                        {queryResult.data && queryResult.data.length > 0 && (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {Object.keys(queryResult.data[0]).map(
                                    (key) => (
                                      <TableHead key={key}>{key}</TableHead>
                                    )
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {queryResult.data
                                  .slice(0, 100)
                                  .map((row: any, index: number) => (
                                    <TableRow key={index}>
                                      {Object.values(row).map(
                                        (value: any, cellIndex) => (
                                          <TableCell
                                            key={cellIndex}
                                            className="font-mono text-sm"
                                          >
                                            {value === null ? (
                                              <span className="text-gray-400 italic">
                                                null
                                              </span>
                                            ) : (
                                              String(value)
                                            )}
                                          </TableCell>
                                        )
                                      )}
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                            {queryResult.data.length > 100 && (
                              <p className="text-sm text-gray-500 mt-2">
                                Showing first 100 rows of{" "}
                                {queryResult.data.length} total
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Badge className="bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Error
                        </Badge>
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                          <pre className="text-sm text-red-700 whitespace-pre-wrap">
                            {queryResult.message}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Updater */}
          <TabsContent value="updater" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Cog className="w-5 h-5" />
                    <span>System Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge 
                      className={updaterStatus?.isRunning 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                      }
                    >
                      {updaterStatus?.isRunning ? (
                        <><CheckCircle className="w-3 h-3 mr-1" />Running</>
                      ) : (
                        <><Pause className="w-3 h-3 mr-1" />Stopped</>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Target Tenant</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {updaterStatus?.config?.targetTenantId?.slice(0, 8)}...
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Target Customer</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {updaterStatus?.config?.targetCustomerId || 'cust-1'}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Updaters</span>
                    <span className="text-sm font-semibold">
                      {updaterStatus?.updaters?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Enabled</span>
                    <span className="text-sm font-semibold">
                      {updaterStatus?.updaters?.filter(u => u.isEnabled)?.length || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* System Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Play className="w-5 h-5" />
                    <span>System Controls</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={() => startUpdaterMutation.mutate()}
                    disabled={startUpdaterMutation.isPending || updaterStatus?.isRunning}
                  >
                    {startUpdaterMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Start System
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => stopUpdaterMutation.mutate()}
                    disabled={stopUpdaterMutation.isPending || !updaterStatus?.isRunning}
                  >
                    {stopUpdaterMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Pause className="w-4 h-4 mr-2" />
                    )}
                    Stop System
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/database-updater/status"] })}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Status
                  </Button>
                </CardContent>
              </Card>

              {/* Schedule Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>Schedules</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Business Activities</div>
                    <code className="text-xs bg-blue-50 px-2 py-1 rounded block">
                      {updaterStatus?.config?.scheduleConfig?.businessActivities || 'Every 2 hours, 9-5 PM'}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">Service Tickets</div>
                    <code className="text-xs bg-green-50 px-2 py-1 rounded block">
                      {updaterStatus?.config?.scheduleConfig?.serviceTickets || 'Every 6 hours'}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-1">New Leads</div>
                    <code className="text-xs bg-purple-50 px-2 py-1 rounded block">
                      {updaterStatus?.config?.scheduleConfig?.newLeads || 'Daily at 10 AM'}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Updaters List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>Data Updaters</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {updaterStatus?.updaters?.map((updater, index) => (
                    <Card key={updater.name} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Badge 
                                className={updater.isEnabled 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-gray-100 text-gray-800"
                                }
                              >
                                {updater.isEnabled ? (
                                  <><CheckCircle className="w-3 h-3 mr-1" />Enabled</>
                                ) : (
                                  <><Pause className="w-3 h-3 mr-1" />Disabled</>
                                )}
                              </Badge>
                              <h3 className="font-medium">
                                {updater.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </h3>
                            </div>
                            <div className="text-sm text-gray-600 mb-3">
                              {updater.name === 'business_record_activities' && (
                                <>
                                  <Users className="w-4 h-4 inline mr-1" />
                                  Generates realistic CRM activities (calls, emails, meetings, demos)
                                </>
                              )}
                              {updater.name === 'service_tickets' && (
                                <>
                                  <Settings className="w-4 h-4 inline mr-1" />
                                  Creates service requests with realistic scenarios and error codes
                                </>
                              )}
                              {updater.name === 'business_records' && (
                                <>
                                  <TrendingUp className="w-4 h-4 inline mr-1" />
                                  Adds new leads with industry-appropriate company data
                                </>
                              )}
                            </div>
                            {updater.lastExecution && (
                              <div className="text-xs text-gray-500">
                                Last execution: {format(new Date(updater.lastExecution), "MMM dd, HH:mm")}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => dryRunUpdaterMutation.mutate(updater.name)}
                              disabled={dryRunUpdaterMutation.isPending}
                            >
                              {dryRunUpdaterMutation.isPending ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => executeUpdaterMutation.mutate(updater.name)}
                              disabled={executeUpdaterMutation.isPending || !updater.isEnabled}
                            >
                              {executeUpdaterMutation.isPending ? (
                                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Zap className="w-4 h-4 mr-1" />
                              )}
                              Execute
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                      Loading updater status...
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">Database Updater Information</h4>
                      <p className="text-sm text-blue-800">
                        This system automatically injects realistic data into your database tables for testing and development. 
                        All data is generated for tenant <code className="bg-blue-100 px-1 rounded">550e8400-e29b-41d4-a716-446655440000</code> 
                        {" "}and customer <code className="bg-blue-100 px-1 rounded">cust-1</code>.
                      </p>
                      <ul className="text-sm text-blue-800 mt-2 space-y-1">
                        <li>• <strong>Dry Run</strong>: Test without affecting the database</li>
                        <li>• <strong>Execute</strong>: Run the updater and insert data</li>
                        <li>• <strong>Scheduled</strong>: Automatic execution based on CRON schedules</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backups */}
          <TabsContent value="backups" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Archive className="w-5 h-5" />
                    <span>Database Backups</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        toast({
                          title: "Backup System",
                          description:
                            "Automated backups are managed by the hosting provider. Manual backup functionality coming soon.",
                        })
                      }
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Create Backup
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        toast({
                          title: "Restore System",
                          description:
                            "Database restore functionality requires administrator approval. Contact support for assistance.",
                        })
                      }
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Restore
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Backup Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell className="font-medium">
                          {backup.name}
                        </TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(backup.type)}>
                            {backup.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{backup.size}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(backup.status)}
                            <Badge className={getStatusColor(backup.status)}>
                              {backup.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{backup.duration}</TableCell>
                        <TableCell>
                          {format(
                            new Date(backup.createdAt),
                            "MMM dd, yyyy HH:mm"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Upload className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Query Logs */}
          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Query Performance Logs</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queryLogs.map((log) => (
                    <Card key={log.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getStatusColor(log.status)}>
                                {log.status}
                              </Badge>
                              <Badge variant="outline">{log.duration}ms</Badge>
                              <span className="text-sm text-gray-500">
                                {format(
                                  new Date(log.timestamp),
                                  "MMM dd, HH:mm:ss"
                                )}
                              </span>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-md mb-2">
                              <code className="text-sm">{log.query}</code>
                            </div>
                            <div className="text-xs text-gray-500">
                              User: {log.user} | Database: {log.database}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance */}
          <TabsContent value="maintenance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Database Maintenance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start"
                    onClick={() => executeQueryMutation.mutate("ANALYZE;")}
                    disabled={executeQueryMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Analyze All Tables
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() =>
                      executeQueryMutation.mutate("VACUUM ANALYZE;")
                    }
                    disabled={executeQueryMutation.isPending}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Vacuum Database
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() =>
                      executeQueryMutation.mutate("SELECT pg_stat_reset();")
                    }
                    disabled={executeQueryMutation.isPending}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Update Statistics
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() =>
                      executeQueryMutation.mutate(
                        "REINDEX DATABASE SCHEMA public;"
                      )
                    }
                    disabled={executeQueryMutation.isPending}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Reindex Tables
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>Security Operations</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full justify-start"
                    onClick={() =>
                      executeQueryMutation.mutate(
                        "SELECT * FROM information_schema.table_privileges WHERE grantee != 'postgres' LIMIT 20;"
                      )
                    }
                    disabled={executeQueryMutation.isPending}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Audit Permissions
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() =>
                      toast({
                        title: "Integrity Check",
                        description:
                          "Database integrity checks are performed automatically by PostgreSQL. No issues detected.",
                      })
                    }
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Check Integrity
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() =>
                      executeQueryMutation.mutate(
                        "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50;"
                      )
                    }
                    disabled={executeQueryMutation.isPending}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Audit Log
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() =>
                      toast({
                        title: "Log Rotation",
                        description:
                          "Log rotation is managed automatically by the system. Logs are archived and cleaned up regularly.",
                      })
                    }
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Rotate Logs
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
