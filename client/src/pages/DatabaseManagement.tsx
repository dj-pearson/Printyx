import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Shield
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";

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
  status: 'healthy' | 'warning' | 'error';
}

interface BackupInfo {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  size: string;
  status: 'completed' | 'running' | 'failed';
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
  status: 'success' | 'error';
}

export default function DatabaseManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [sqlQuery, setSqlQuery] = useState("");
  const [filterTable, setFilterTable] = useState("all");
  
  // Mock data for demonstration
  const dbStats: DatabaseStats = {
    totalSize: "2.4 GB",
    tableCount: 87,
    connectionCount: 23,
    activeQueries: 5,
    cacheHitRatio: 94.7,
    uptime: "15 days, 7 hours"
  };

  const tables: TableInfo[] = [
    {
      name: "business_records",
      schema: "public",
      size: "245 MB",
      rowCount: 15420,
      lastModified: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      indexes: 8,
      status: "healthy"
    },
    {
      name: "users",
      schema: "public",
      size: "89 MB",
      rowCount: 1247,
      lastModified: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      indexes: 5,
      status: "healthy"
    },
    {
      name: "service_tickets",
      schema: "public",
      size: "156 MB",
      rowCount: 8934,
      lastModified: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      indexes: 6,
      status: "warning"
    },
    {
      name: "social_media_posts",
      schema: "public",
      size: "12 MB",
      rowCount: 234,
      lastModified: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      indexes: 3,
      status: "healthy"
    },
    {
      name: "audit_logs",
      schema: "public",
      size: "423 MB",
      rowCount: 45620,
      lastModified: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      indexes: 4,
      status: "healthy"
    }
  ];

  const backups: BackupInfo[] = [
    {
      id: "backup-001",
      name: "daily_backup_2025_02_04",
      type: "full",
      size: "2.1 GB",
      status: "completed",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      duration: "23 minutes"
    },
    {
      id: "backup-002",
      name: "incremental_backup_2025_02_04_12h",
      type: "incremental",
      size: "145 MB",
      status: "completed",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      duration: "4 minutes"
    },
    {
      id: "backup-003",
      name: "manual_backup_2025_02_03",
      type: "full",
      size: "2.0 GB",
      status: "completed",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      duration: "25 minutes"
    }
  ];

  const queryLogs: QueryLog[] = [
    {
      id: "query-001",
      query: "SELECT * FROM business_records WHERE status = 'active' ORDER BY created_at DESC LIMIT 50",
      duration: 234,
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      user: "app_user",
      database: "printyx_main",
      status: "success"
    },
    {
      id: "query-002",
      query: "UPDATE service_tickets SET status = 'completed' WHERE id = '12345'",
      duration: 12,
      timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      user: "service_app",
      database: "printyx_main",
      status: "success"
    },
    {
      id: "query-003",
      query: "SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '30 days'",
      duration: 1567,
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      user: "analytics_user",
      database: "printyx_main",
      status: "error"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'warning':
      case 'running':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'warning':
      case 'running':
        return <Clock className="w-4 h-4" />;
      case 'error':
      case 'failed':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'full': return 'bg-blue-100 text-blue-800';
      case 'incremental': return 'bg-green-100 text-green-800';
      case 'differential': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTables = tables.filter(table => 
    filterTable === "all" || table.status === filterTable
  );

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Database Management</h1>
            <p className="text-gray-600 mt-2">Monitor and manage database operations</p>
          </div>
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
                  <p className="text-sm font-medium text-gray-600">Total Size</p>
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
                  <p className="text-sm font-medium text-gray-600">Connections</p>
                  <p className="text-2xl font-bold">{dbStats.connectionCount}</p>
                </div>
                <Server className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Queries</p>
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
                  <p className="text-sm font-medium text-gray-600">Cache Hit Ratio</p>
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Tables</TabsTrigger>
            <TabsTrigger value="queries">Query Console</TabsTrigger>
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
                        <TableCell className="font-medium">{table.name}</TableCell>
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
                          {format(new Date(table.lastModified), 'MMM dd, HH:mm')}
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
                  <span className="text-sm text-gray-500">Execute queries with caution</span>
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
                    <Button disabled={!sqlQuery.trim()}>
                      <Play className="w-4 h-4 mr-2" />
                      Execute Query
                    </Button>
                    <Button variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                  <div className="text-sm text-gray-500">
                    Connected as: postgres_admin
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
                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Create Backup
                    </Button>
                    <Button variant="outline">
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
                        <TableCell className="font-medium">{backup.name}</TableCell>
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
                          {format(new Date(backup.createdAt), 'MMM dd, yyyy HH:mm')}
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
                              <Badge variant="outline">
                                {log.duration}ms
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
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
                  <Button className="w-full justify-start">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Analyze All Tables
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Database className="w-4 h-4 mr-2" />
                    Vacuum Database
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Update Statistics
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
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
                  <Button className="w-full justify-start">
                    <Eye className="w-4 h-4 mr-2" />
                    Audit Permissions
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Check Integrity
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export Audit Log
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
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