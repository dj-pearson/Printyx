import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Monitor,
  Printer,
  Laptop,
  Server,
  Wifi,
  Calendar,
  Wrench,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Settings,
  Plus,
  Search,
  Filter,
  Download,
  Bell,
  Building2,
  Truck,
  HardDrive,
  Router,
  Smartphone
} from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  category: 'office-equipment' | 'it-equipment' | 'tools' | 'demo-equipment' | 'furniture' | 'other';
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: Date;
  purchasePrice: number;
  currentValue: number;
  location: string;
  assignedTo?: string;
  status: 'active' | 'maintenance' | 'retired' | 'missing';
  warrantyExpiration?: Date;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  notes: string;
}

interface MaintenanceRecord {
  id: string;
  assetId: string;
  date: Date;
  type: 'repair' | 'maintenance' | 'calibration' | 'upgrade' | 'cleaning';
  description: string;
  cost: number;
  technician: string;
  vendor?: string;
}

const AssetManagement: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Mock data
  const assets: Asset[] = [
    {
      id: '1',
      name: 'Canon imageRUNNER ADVANCE DX C5750i',
      category: 'demo-equipment',
      brand: 'Canon',
      model: 'imageRUNNER ADVANCE DX C5750i',
      serialNumber: 'CAN123456789',
      purchaseDate: new Date('2023-01-15'),
      purchasePrice: 12500,
      currentValue: 10000,
      location: 'Showroom A',
      assignedTo: 'Sales Team',
      status: 'active',
      warrantyExpiration: new Date('2026-01-15'),
      lastMaintenanceDate: new Date('2024-06-01'),
      nextMaintenanceDate: new Date('2024-09-01'),
      condition: 'excellent',
      notes: 'Demo unit for client presentations'
    },
    {
      id: '2',
      name: 'HP LaserJet Enterprise M507dn',
      category: 'office-equipment',
      brand: 'HP',
      model: 'LaserJet Enterprise M507dn',
      serialNumber: 'HP987654321',
      purchaseDate: new Date('2022-05-10'),
      purchasePrice: 450,
      currentValue: 300,
      location: 'Office - Accounting',
      assignedTo: 'Finance Team',
      status: 'active',
      warrantyExpiration: new Date('2025-05-10'),
      condition: 'good',
      notes: 'Primary accounting department printer'
    },
    {
      id: '3',
      name: 'Dell OptiPlex 7090',
      category: 'it-equipment',
      brand: 'Dell',
      model: 'OptiPlex 7090',
      serialNumber: 'DEL555666777',
      purchaseDate: new Date('2023-03-20'),
      purchasePrice: 1200,
      currentValue: 800,
      location: 'Office - IT Department',
      assignedTo: 'John Smith',
      status: 'active',
      warrantyExpiration: new Date('2026-03-20'),
      condition: 'excellent',
      notes: 'IT Manager workstation'
    },
    {
      id: '4',
      name: 'Xerox VersaLink C405',
      category: 'demo-equipment',
      brand: 'Xerox',
      model: 'VersaLink C405',
      serialNumber: 'XER444555666',
      purchaseDate: new Date('2021-08-15'),
      purchasePrice: 800,
      currentValue: 400,
      location: 'Warehouse - Demo Storage',
      status: 'maintenance',
      warrantyExpiration: new Date('2024-08-15'),
      lastMaintenanceDate: new Date('2024-07-15'),
      condition: 'fair',
      notes: 'Requires toner cartridge replacement'
    },
    {
      id: '5',
      name: 'Fluke 87V Digital Multimeter',
      category: 'tools',
      brand: 'Fluke',
      model: '87V',
      serialNumber: 'FLU123789456',
      purchaseDate: new Date('2020-11-02'),
      purchasePrice: 350,
      currentValue: 250,
      location: 'Service Van #3',
      assignedTo: 'Mike Johnson',
      status: 'active',
      condition: 'good',
      notes: 'Service technician diagnostic tool'
    }
  ];

  const maintenanceRecords: MaintenanceRecord[] = [
    {
      id: '1',
      assetId: '1',
      date: new Date('2024-06-01'),
      type: 'maintenance',
      description: 'Quarterly maintenance and cleaning',
      cost: 125,
      technician: 'Service Team',
      vendor: 'Canon Service Center'
    },
    {
      id: '2',
      assetId: '4',
      date: new Date('2024-07-15'),
      type: 'repair',
      description: 'Paper jam mechanism repair',
      cost: 85,
      technician: 'Internal Tech',
      vendor: 'Parts Direct'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'retired': return 'bg-gray-100 text-gray-800';
      case 'missing': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'office-equipment': return <Printer className="h-4 w-4" />;
      case 'it-equipment': return <Monitor className="h-4 w-4" />;
      case 'tools': return <Wrench className="h-4 w-4" />;
      case 'demo-equipment': return <Laptop className="h-4 w-4" />;
      case 'furniture': return <Building2 className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const isMaintenanceDue = (asset: Asset) => {
    if (!asset.nextMaintenanceDate) return false;
    return new Date(asset.nextMaintenanceDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  };

  const isWarrantyExpiring = (asset: Asset) => {
    if (!asset.warrantyExpiration) return false;
    return new Date(asset.warrantyExpiration) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalValue = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const maintenanceDueCount = assets.filter(asset => isMaintenanceDue(asset)).length;
  const warrantyExpiringCount = assets.filter(asset => isWarrantyExpiring(asset)).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Asset Management</h1>
          <p className="text-gray-600">Track and manage all business assets, equipment, and tools</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Assets</p>
                  <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
                </div>
                <Settings className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-green-600">${totalValue.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Maintenance Due</p>
                  <p className="text-2xl font-bold text-yellow-600">{maintenanceDueCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Warranty Expiring</p>
                  <p className="text-2xl font-bold text-red-600">{warrantyExpiringCount}</p>
                </div>
                <Calendar className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="office-equipment">Office Equipment</SelectItem>
              <SelectItem value="it-equipment">IT Equipment</SelectItem>
              <SelectItem value="demo-equipment">Demo Equipment</SelectItem>
              <SelectItem value="tools">Tools</SelectItem>
              <SelectItem value="furniture">Furniture</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>

          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Asset</DialogTitle>
                <DialogDescription>
                  Add a new asset to your management system
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="assetName">Asset Name</Label>
                  <Input id="assetName" placeholder="Canon imageRUNNER ADVANCE..." />
                </div>
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" placeholder="Canon" />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" placeholder="imageRUNNER ADVANCE DX" />
                </div>
                <div>
                  <Label htmlFor="serial">Serial Number</Label>
                  <Input id="serial" placeholder="ABC123456789" />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office-equipment">Office Equipment</SelectItem>
                      <SelectItem value="it-equipment">IT Equipment</SelectItem>
                      <SelectItem value="demo-equipment">Demo Equipment</SelectItem>
                      <SelectItem value="tools">Tools</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="purchasePrice">Purchase Price</Label>
                  <Input id="purchasePrice" type="number" placeholder="10000" />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="Showroom A" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline">Cancel</Button>
                <Button>Add Asset</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Asset List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(asset.category)}
                    <div>
                      <CardTitle className="text-lg">{asset.name}</CardTitle>
                      <CardDescription>{asset.brand} • {asset.model}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={getStatusColor(asset.status)}>
                      {asset.status}
                    </Badge>
                    <Badge className={getConditionColor(asset.condition)}>
                      {asset.condition}
                    </Badge>
                    {(isMaintenanceDue(asset) || isWarrantyExpiring(asset)) && (
                      <Badge variant="destructive" className="text-xs">
                        <Bell className="h-3 w-3 mr-1" />
                        Alert
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Location
                    </span>
                    <span className="font-medium">{asset.location}</span>
                  </div>
                  
                  {asset.assignedTo && (
                    <div className="flex items-center justify-between text-sm">
                      <span>Assigned To</span>
                      <span className="font-medium">{asset.assignedTo}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Current Value
                    </span>
                    <span className="font-medium">${asset.currentValue.toLocaleString()}</span>
                  </div>
                  
                  {asset.warrantyExpiration && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Warranty Expires
                      </span>
                      <span className={`font-medium ${isWarrantyExpiring(asset) ? 'text-red-600' : ''}`}>
                        {new Date(asset.warrantyExpiration).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {asset.nextMaintenanceDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Wrench className="h-4 w-4" />
                        Next Maintenance
                      </span>
                      <span className={`font-medium ${isMaintenanceDue(asset) ? 'text-yellow-600' : ''}`}>
                        {new Date(asset.nextMaintenanceDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setSelectedAsset(asset)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Details
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Asset Detail Modal */}
        {selectedAsset && (
          <Dialog open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedAsset.name}</DialogTitle>
                <DialogDescription>
                  Asset Details and Maintenance History
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                  <TabsTrigger value="financial">Financial</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Asset Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Serial Number:</span>
                            <span className="font-medium">{selectedAsset.serialNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Category:</span>
                            <span className="font-medium capitalize">{selectedAsset.category.replace('-', ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Brand:</span>
                            <span className="font-medium">{selectedAsset.brand}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Model:</span>
                            <span className="font-medium">{selectedAsset.model}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Purchase Date:</span>
                            <span className="font-medium">{selectedAsset.purchaseDate.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Current Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <Badge className={getStatusColor(selectedAsset.status)}>
                              {selectedAsset.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Condition:</span>
                            <Badge className={getConditionColor(selectedAsset.condition)}>
                              {selectedAsset.condition}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Location:</span>
                            <span className="font-medium">{selectedAsset.location}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Assigned To:</span>
                            <span className="font-medium">{selectedAsset.assignedTo || 'Unassigned'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {selectedAsset.notes && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{selectedAsset.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="maintenance" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Maintenance History</h3>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Record
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {maintenanceRecords
                      .filter(record => record.assetId === selectedAsset.id)
                      .map((record) => (
                        <Card key={record.id}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium capitalize">{record.type}</p>
                                <p className="text-sm text-gray-600">
                                  {record.date.toLocaleDateString()} • {record.technician}
                                </p>
                              </div>
                              <p className="font-medium">${record.cost}</p>
                            </div>
                            <p className="text-sm">{record.description}</p>
                            {record.vendor && (
                              <p className="text-xs text-gray-500">Vendor: {record.vendor}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="financial">
                  <Card>
                    <CardHeader>
                      <CardTitle>Financial Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-600">Purchase Price</p>
                          <p className="text-2xl font-bold">${selectedAsset.purchasePrice.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Current Value</p>
                          <p className="text-2xl font-bold">${selectedAsset.currentValue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Depreciation</p>
                          <p className="text-xl font-bold text-red-600">
                            -${(selectedAsset.purchasePrice - selectedAsset.currentValue).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Maintenance Cost</p>
                          <p className="text-xl font-bold">
                            ${maintenanceRecords
                              .filter(r => r.assetId === selectedAsset.id)
                              .reduce((sum, r) => sum + r.cost, 0)
                              .toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="history">
                  <Card>
                    <CardHeader>
                      <CardTitle>Asset History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <p className="font-medium">Asset Purchased</p>
                            <p className="text-sm text-gray-600">
                              {selectedAsset.purchaseDate.toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="secondary">Purchase</Badge>
                        </div>
                        
                        {selectedAsset.lastMaintenanceDate && (
                          <div className="flex justify-between items-center p-3 border rounded">
                            <div>
                              <p className="font-medium">Last Maintenance</p>
                              <p className="text-sm text-gray-600">
                                {selectedAsset.lastMaintenanceDate.toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="secondary">Maintenance</Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default AssetManagement;