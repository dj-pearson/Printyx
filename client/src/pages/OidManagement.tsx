import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Download,
  Upload,
  TestTube,
  Edit2,
  Trash2,
  Check,
  X,
  Save,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface OidMapping {
  id: number;
  manufacturer: string;
  modelSeries: string | null;
  mappingName: string;
  oids: Record<string, string>;
  description: string | null;
  isDefault: boolean;
  isCustom: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  oid: string;
  status: 'success' | 'error';
  value: string | null;
  error?: string;
  type?: string;
}

export default function OidManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<OidMapping | null>(null);
  const [testingMapping, setTestingMapping] = useState<OidMapping | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult> | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    manufacturer: '',
    modelSeries: '',
    mappingName: '',
    description: '',
    oids: '{}',
    isDefault: false,
  });

  // Test form states
  const [testFormData, setTestFormData] = useState({
    ipAddress: '',
    snmpCommunity: 'public',
    snmpVersion: '2c',
  });

  // Import form state
  const [importData, setImportData] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  // Fetch OID mappings
  const { data: mappings = [], isLoading } = useQuery<OidMapping[]>({
    queryKey: ['/api/oid-mappings', selectedManufacturer],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedManufacturer) params.append('manufacturer', selectedManufacturer);

      const res = await fetch(`/api/oid-mappings?${params}`);
      if (!res.ok) throw new Error('Failed to fetch OID mappings');
      return res.json();
    },
  });

  // Fetch manufacturers
  const { data: manufacturers = [] } = useQuery<string[]>({
    queryKey: ['/api/oid-mappings/manufacturers'],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch('/api/oid-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          oids: JSON.parse(data.oids),
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create OID mapping');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/oid-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/oid-mappings/manufacturers'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Success', description: 'OID mapping created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/oid-mappings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          oids: JSON.parse(data.oids),
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update OID mapping');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/oid-mappings'] });
      setIsEditDialogOpen(false);
      setEditingMapping(null);
      resetForm();
      toast({ title: 'Success', description: 'OID mapping updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/oid-mappings/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete OID mapping');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/oid-mappings'] });
      toast({ title: 'Success', description: 'OID mapping deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async (data: {
      ipAddress: string;
      oids: Record<string, string>;
      snmpCommunity: string;
      snmpVersion: string;
    }) => {
      const res = await fetch('/api/oid-mappings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to test OIDs');
      return res.json();
    },
    onSuccess: (data) => {
      setTestResults(data.results);
      toast({
        title: 'Test Complete',
        description: `${data.summary.successful}/${data.summary.total} OIDs successful (${data.summary.successRate}%)`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (manufacturer?: string) => {
      const res = await fetch('/api/oid-mappings/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to export OID mappings');
      return res.json();
    },
    onSuccess: (data) => {
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oid-mappings-${data.exportedAt}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Success', description: `Exported ${data.count} mappings` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: { mappings: any[]; overwriteExisting: boolean }) => {
      const res = await fetch('/api/oid-mappings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to import OID mappings');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/oid-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/oid-mappings/manufacturers'] });
      setIsImportDialogOpen(false);
      setImportData('');
      toast({
        title: 'Import Complete',
        description: `Imported ${data.summary.imported} mappings, skipped ${data.summary.skipped}, ${data.summary.errors} errors`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      manufacturer: '',
      modelSeries: '',
      mappingName: '',
      description: '',
      oids: '{}',
      isDefault: false,
    });
  };

  const handleEdit = (mapping: OidMapping) => {
    setEditingMapping(mapping);
    setFormData({
      manufacturer: mapping.manufacturer,
      modelSeries: mapping.modelSeries || '',
      mappingName: mapping.mappingName,
      description: mapping.description || '',
      oids: JSON.stringify(mapping.oids, null, 2),
      isDefault: mapping.isDefault,
    });
    setIsEditDialogOpen(true);
  };

  const handleTest = (mapping: OidMapping) => {
    setTestingMapping(mapping);
    setTestResults(null);
    setIsTestDialogOpen(true);
  };

  const handleRunTest = () => {
    if (!testingMapping) return;

    testMutation.mutate({
      ipAddress: testFormData.ipAddress,
      oids: testingMapping.oids,
      snmpCommunity: testFormData.snmpCommunity,
      snmpVersion: testFormData.snmpVersion,
    });
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importData);
      if (!data.mappings || !Array.isArray(data.mappings)) {
        throw new Error('Invalid import format. Expected JSON with "mappings" array');
      }
      importMutation.mutate({
        mappings: data.mappings,
        overwriteExisting,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Invalid JSON format',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">OID Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage SNMP OID mappings for different printer manufacturers
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import OID Mappings</DialogTitle>
                <DialogDescription>
                  Paste the JSON export data to import OID mappings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="import-data">Import Data (JSON)</Label>
                  <Textarea
                    id="import-data"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder='{"version":"1.0","mappings":[...]}'
                    rows={10}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="overwrite"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="overwrite" className="text-sm">
                    Overwrite existing mappings
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!importData || importMutation.isPending}>
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => exportMutation.mutate(selectedManufacturer || undefined)}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Mapping
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create OID Mapping</DialogTitle>
                <DialogDescription>
                  Add a new SNMP OID mapping for a printer manufacturer
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="manufacturer">Manufacturer *</Label>
                    <Input
                      id="manufacturer"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      placeholder="Canon, Xerox, HP, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="model-series">Model Series</Label>
                    <Input
                      id="model-series"
                      value={formData.modelSeries}
                      onChange={(e) => setFormData({ ...formData, modelSeries: e.target.value })}
                      placeholder="iR-ADV, VersaLink, etc. (optional)"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="mapping-name">Mapping Name *</Label>
                  <Input
                    id="mapping-name"
                    value={formData.mappingName}
                    onChange={(e) => setFormData({ ...formData, mappingName: e.target.value })}
                    placeholder="Canon iR-ADV Standard"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description of this OID mapping..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="oids">OIDs (JSON) *</Label>
                  <Textarea
                    id="oids"
                    value={formData.oids}
                    onChange={(e) => setFormData({ ...formData, oids: e.target.value })}
                    placeholder='{"tonerBlack": "1.3.6.1...", "totalCounter": "1.3.6.1..."}'
                    rows={8}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JSON object with OID names as keys and OID strings as values
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is-default"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="is-default" className="text-sm">
                    Set as default for this manufacturer
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={
                    !formData.manufacturer ||
                    !formData.mappingName ||
                    !formData.oids ||
                    createMutation.isPending
                  }
                >
                  Create Mapping
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>OID Mappings</CardTitle>
              <CardDescription>{mappings.length} mapping(s) found</CardDescription>
            </div>
            <div className="w-64">
              <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Manufacturers</SelectItem>
                  {manufacturers.map((mfr) => (
                    <SelectItem key={mfr} value={mfr}>
                      {mfr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No OID mappings found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Mapping Name</TableHead>
                  <TableHead>Model Series</TableHead>
                  <TableHead>OIDs</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">{mapping.manufacturer}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {mapping.mappingName}
                        {mapping.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{mapping.modelSeries || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{Object.keys(mapping.oids).length} OIDs</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={mapping.isCustom ? 'default' : 'secondary'}>
                        {mapping.isCustom ? 'Custom' : 'System'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleTest(mapping)}>
                          <TestTube className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(mapping)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {mapping.isCustom && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this mapping?')) {
                                deleteMutation.mutate(mapping.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit OID Mapping</DialogTitle>
            <DialogDescription>Update the OID mapping configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-manufacturer">Manufacturer *</Label>
                <Input
                  id="edit-manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-model-series">Model Series</Label>
                <Input
                  id="edit-model-series"
                  value={formData.modelSeries}
                  onChange={(e) => setFormData({ ...formData, modelSeries: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-mapping-name">Mapping Name *</Label>
              <Input
                id="edit-mapping-name"
                value={formData.mappingName}
                onChange={(e) => setFormData({ ...formData, mappingName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="edit-oids">OIDs (JSON) *</Label>
              <Textarea
                id="edit-oids"
                value={formData.oids}
                onChange={(e) => setFormData({ ...formData, oids: e.target.value })}
                rows={8}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is-default"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-is-default" className="text-sm">
                Set as default for this manufacturer
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingMapping(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingMapping) {
                  updateMutation.mutate({ id: editingMapping.id, data: formData });
                }
              }}
              disabled={
                !formData.manufacturer ||
                !formData.mappingName ||
                !formData.oids ||
                updateMutation.isPending
              }
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test OID Mapping</DialogTitle>
            <DialogDescription>Test this OID mapping against a real device</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <Label htmlFor="test-ip">Device IP Address *</Label>
                <Input
                  id="test-ip"
                  value={testFormData.ipAddress}
                  onChange={(e) => setTestFormData({ ...testFormData, ipAddress: e.target.value })}
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <Label htmlFor="test-community">SNMP Community</Label>
                <Input
                  id="test-community"
                  value={testFormData.snmpCommunity}
                  onChange={(e) =>
                    setTestFormData({ ...testFormData, snmpCommunity: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="test-version">SNMP Version</Label>
                <Select
                  value={testFormData.snmpVersion}
                  onValueChange={(value) =>
                    setTestFormData({ ...testFormData, snmpVersion: value })
                  }
                >
                  <SelectTrigger id="test-version">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">v1</SelectItem>
                    <SelectItem value="2c">v2c</SelectItem>
                    <SelectItem value="3">v3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleRunTest}
                  disabled={!testFormData.ipAddress || testMutation.isPending}
                  className="w-full"
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  Run Test
                </Button>
              </div>
            </div>

            {testResults && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Test Results</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OID Name</TableHead>
                      <TableHead>OID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(testResults).map(([name, result]) => (
                      <TableRow key={name}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="font-mono text-xs">{result.oid}</TableCell>
                        <TableCell>
                          {result.status === 'success' ? (
                            <Badge variant="default" className="bg-green-500">
                              <Check className="w-3 h-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <X className="w-3 h-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {result.status === 'success' ? result.value : result.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsTestDialogOpen(false);
                setTestingMapping(null);
                setTestResults(null);
                setTestFormData({
                  ipAddress: '',
                  snmpCommunity: 'public',
                  snmpVersion: '2c',
                });
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
