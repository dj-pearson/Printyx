/**
 * Salesforce Integration Settings Component
 *
 * Provides UI for configuring and managing Salesforce bi-directional sync.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Cloud,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeftRight,
  Database,
  Settings,
  Download,
  Upload,
  FileJson,
  Eye,
  Loader2,
  Calendar,
  Users,
  Building2,
  ShoppingBag,
} from 'lucide-react';

interface SyncStatus {
  table_name: string;
  total_records: number;
  salesforce_records: number;
  last_sync_date: string | null;
}

interface FieldMapping {
  salesforceObject: string;
  printixTable: string;
  fieldCount: number;
}

export default function SalesforceIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isImporting, setIsImporting] = useState(false);
  const [importData, setImportData] = useState('');
  const [selectedObjectType, setSelectedObjectType] = useState<string>('Account');

  // Fetch sync status
  const { data: syncStatusData, isLoading: isLoadingSyncStatus, refetch: refetchSyncStatus } = useQuery({
    queryKey: ['salesforce-sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/salesforce/sync-status');
      if (!res.ok) throw new Error('Failed to fetch sync status');
      return res.json();
    },
  });

  // Fetch field mappings
  const { data: mappingsData, isLoading: isLoadingMappings } = useQuery({
    queryKey: ['salesforce-mappings'],
    queryFn: async () => {
      const res = await fetch('/api/salesforce/mappings');
      if (!res.ok) throw new Error('Failed to fetch mappings');
      return res.json();
    },
  });

  // Fetch specific field mapping details
  const { data: fieldMappingData, isLoading: isLoadingFieldMapping } = useQuery({
    queryKey: ['salesforce-field-mapping', selectedObjectType],
    queryFn: async () => {
      const res = await fetch(`/api/salesforce/field-mappings/${selectedObjectType}`);
      if (!res.ok) throw new Error('Failed to fetch field mapping');
      return res.json();
    },
    enabled: !!selectedObjectType,
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async ({ objectType, records }: { objectType: string; records: any[] }) => {
      const res = await fetch('/api/salesforce/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType, records }),
      });
      if (!res.ok) throw new Error('Import failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Import Completed',
        description: `Successfully imported ${data.results.successCount} records. ${data.results.duplicateCount} duplicates skipped.`,
      });
      queryClient.invalidateQueries({ queryKey: ['salesforce-sync-status'] });
      setImportData('');
      setIsImporting(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Preview transformation mutation
  const previewMutation = useMutation({
    mutationFn: async ({ objectType, sampleRecord }: { objectType: string; sampleRecord: any }) => {
      const res = await fetch('/api/salesforce/preview-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType, sampleRecord }),
      });
      if (!res.ok) throw new Error('Preview failed');
      return res.json();
    },
  });

  const handleImport = () => {
    try {
      const records = JSON.parse(importData);
      if (!Array.isArray(records)) {
        toast({
          title: 'Invalid Data',
          description: 'Please provide a JSON array of records',
          variant: 'destructive',
        });
        return;
      }
      importMutation.mutate({ objectType: selectedObjectType, records });
    } catch (e) {
      toast({
        title: 'Invalid JSON',
        description: 'Please provide valid JSON data',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = () => {
    try {
      const records = JSON.parse(importData);
      if (!Array.isArray(records) || records.length === 0) {
        toast({
          title: 'Invalid Data',
          description: 'Please provide at least one record to preview',
          variant: 'destructive',
        });
        return;
      }
      previewMutation.mutate({ objectType: selectedObjectType, sampleRecord: records[0] });
    } catch (e) {
      toast({
        title: 'Invalid JSON',
        description: 'Please provide valid JSON data',
        variant: 'destructive',
      });
    }
  };

  const getSyncStats = (): { total: number; synced: number; lastSync: string | null } => {
    if (!syncStatusData?.syncStatus?.rows) return { total: 0, synced: 0, lastSync: null };

    const rows = syncStatusData.syncStatus.rows as SyncStatus[];
    let total = 0;
    let synced = 0;
    let lastSync: string | null = null;

    rows.forEach((row) => {
      total += Number(row.total_records) || 0;
      synced += Number(row.salesforce_records) || 0;
      if (row.last_sync_date && (!lastSync || new Date(row.last_sync_date) > new Date(lastSync))) {
        lastSync = row.last_sync_date;
      }
    });

    return { total, synced, lastSync };
  };

  const stats = getSyncStats();
  const isConnected = stats.synced > 0;

  const getObjectIcon = (objectType: string) => {
    switch (objectType) {
      case 'Account':
        return <Building2 className="h-4 w-4" />;
      case 'Contact':
        return <Users className="h-4 w-4" />;
      case 'Lead':
        return <Users className="h-4 w-4" />;
      case 'Opportunity':
        return <ShoppingBag className="h-4 w-4" />;
      case 'Product2':
        return <Database className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Cloud className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Salesforce Integration</h2>
            <p className="text-muted-foreground">
              Bi-directional synchronization with Salesforce CRM
            </p>
          </div>
        </div>
        <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
          {isConnected ? (
            <>
              <CheckCircle className="h-3 w-3" />
              Connected
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              Not Connected
            </>
          )}
        </Badge>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Sync Overview
          </CardTitle>
          <CardDescription>
            Current synchronization status between Printyx and Salesforce
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Total Records</div>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Synced from Salesforce</div>
              <div className="text-2xl font-bold text-blue-600">{stats.synced.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Sync Rate</div>
              <div className="text-2xl font-bold">
                {stats.total > 0 ? Math.round((stats.synced / stats.total) * 100) : 0}%
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground">Last Sync</div>
              <div className="text-lg font-medium">
                {stats.lastSync
                  ? new Date(stats.lastSync).toLocaleDateString()
                  : 'Never'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="import">Import Data</TabsTrigger>
          <TabsTrigger value="mappings">Field Mappings</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Sync Status by Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Status by Object</CardTitle>
              <CardDescription>
                Records synchronized per Salesforce object type
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSyncStatus ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead className="text-right">Total Records</TableHead>
                      <TableHead className="text-right">From Salesforce</TableHead>
                      <TableHead className="text-right">Last Sync</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncStatusData?.syncStatus?.rows?.map((status: SyncStatus, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {status.table_name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </TableCell>
                        <TableCell className="text-right">{Number(status.total_records).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-blue-600">
                          {Number(status.salesforce_records).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {status.last_sync_date
                            ? new Date(status.last_sync_date).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {Number(status.salesforce_records) > 0 ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Synced
                            </Badge>
                          ) : (
                            <Badge variant="secondary">No Data</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchSyncStatus()}
                  disabled={isLoadingSyncStatus}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingSyncStatus ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import from Salesforce
              </CardTitle>
              <CardDescription>
                Import records from Salesforce by pasting exported JSON data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Object Type</Label>
                <div className="flex flex-wrap gap-2">
                  {['Account', 'Contact', 'Lead', 'Opportunity', 'Product2'].map((type) => (
                    <Button
                      key={type}
                      variant={selectedObjectType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedObjectType(type)}
                      className="gap-1"
                    >
                      {getObjectIcon(type)}
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>JSON Data</Label>
                <textarea
                  className="w-full h-48 p-3 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={`Paste your Salesforce ${selectedObjectType} records as JSON array...

Example:
[
  {
    "Id": "001xx000003DGb2AAG",
    "Name": "Acme Corp",
    "Industry": "Technology",
    ...
  }
]`}
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!importData || previewMutation.isPending}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Transform
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!importData || importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import Records
                </Button>
              </div>

              {/* Preview Result */}
              {previewMutation.data && (
                <Alert>
                  <FileJson className="h-4 w-4" />
                  <AlertDescription>
                    <div className="mt-2">
                      <div className="font-medium mb-2">Transformation Preview:</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">Original (Salesforce)</div>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                            {JSON.stringify(previewMutation.data.originalRecord, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">Transformed (Printyx)</div>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                            {JSON.stringify(previewMutation.data.transformedRecord, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Field Mappings
              </CardTitle>
              <CardDescription>
                View how Salesforce fields map to Printyx database fields
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Object selector */}
              <div className="flex flex-wrap gap-2">
                {mappingsData?.mappings?.map((mapping: FieldMapping) => (
                  <Button
                    key={mapping.salesforceObject}
                    variant={selectedObjectType === mapping.salesforceObject ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedObjectType(mapping.salesforceObject)}
                    className="gap-2"
                  >
                    {getObjectIcon(mapping.salesforceObject)}
                    {mapping.salesforceObject}
                    <Badge variant="secondary" className="ml-1">
                      {mapping.fieldCount}
                    </Badge>
                  </Button>
                ))}
              </div>

              <Separator />

              {/* Field mapping table */}
              {isLoadingFieldMapping ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : fieldMappingData?.fieldMappings ? (
                <div>
                  <div className="mb-4">
                    <Badge variant="outline" className="gap-1">
                      <Database className="h-3 w-3" />
                      Target Table: {fieldMappingData.printixTable}
                    </Badge>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Salesforce Field</TableHead>
                          <TableHead>Printyx Field</TableHead>
                          <TableHead>Data Type</TableHead>
                          <TableHead>Required</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fieldMappingData.fieldMappings.map((field: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">
                              {field.sourceField}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-blue-600">
                              {field.targetField}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{field.dataType}</Badge>
                            </TableCell>
                            <TableCell>
                              {field.required ? (
                                <Badge variant="default">Required</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select an object type to view field mappings
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>
                Configure Salesforce synchronization behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Auto-sync on import</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically sync data when importing from Salesforce
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Skip duplicates</div>
                  <div className="text-sm text-muted-foreground">
                    Skip records that already exist based on Salesforce ID
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Preserve external IDs</div>
                  <div className="text-sm text-muted-foreground">
                    Keep Salesforce IDs for future bi-directional sync
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Coming Soon:</strong> OAuth authentication and real-time bi-directional sync.
                  Currently supports JSON import. Contact support for direct Salesforce API integration.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
