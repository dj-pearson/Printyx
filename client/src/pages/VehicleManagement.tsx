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
  Car,
  Truck,
  Calendar,
  Wrench,
  Gauge,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Fuel,
  Settings,
  Plus,
  Search,
  Filter,
  Download,
  Bell
} from 'lucide-react';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  licensePlate: string;
  type: 'service' | 'delivery' | 'management';
  ownership: 'owned' | 'leased';
  currentMileage: number;
  nextOilChange: number;
  nextInspection: Date;
  leaseExpiration?: Date;
  monthlyPayment?: number;
  assignedTechnician?: string;
  status: 'active' | 'maintenance' | 'out-of-service';
  lastMaintenanceDate: Date;
  maintenanceAlerts: number;
}

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: Date;
  type: 'oil-change' | 'inspection' | 'repair' | 'tire-rotation' | 'brake-service' | 'other';
  description: string;
  cost: number;
  mileage: number;
  vendor: string;
  nextDue?: number;
}

const VehicleManagement: React.FC = () => {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Mock data
  const vehicles: Vehicle[] = [
    {
      id: '1',
      make: 'Ford',
      model: 'Transit',
      year: 2022,
      vin: '1FTBW2CM8NKA12345',
      licensePlate: 'SRV-001',
      type: 'service',
      ownership: 'leased',
      currentMileage: 45680,
      nextOilChange: 48000,
      nextInspection: new Date('2024-09-15'),
      leaseExpiration: new Date('2025-03-15'),
      monthlyPayment: 485,
      assignedTechnician: 'John Smith',
      status: 'active',
      lastMaintenanceDate: new Date('2024-06-15'),
      maintenanceAlerts: 1
    },
    {
      id: '2',
      make: 'Chevrolet',
      model: 'Express 2500',
      year: 2021,
      vin: '1GCWGBFP8M1234567',
      licensePlate: 'DLV-002',
      type: 'delivery',
      ownership: 'owned',
      currentMileage: 78920,
      nextOilChange: 80000,
      nextInspection: new Date('2024-11-20'),
      assignedTechnician: 'Mike Johnson',
      status: 'maintenance',
      lastMaintenanceDate: new Date('2024-07-20'),
      maintenanceAlerts: 3
    }
  ];

  const maintenanceRecords: MaintenanceRecord[] = [
    {
      id: '1',
      vehicleId: '1',
      date: new Date('2024-06-15'),
      type: 'oil-change',
      description: 'Regular oil change and filter replacement',
      cost: 89.99,
      mileage: 42000,
      vendor: 'Quick Lube Express',
      nextDue: 48000
    },
    {
      id: '2',
      vehicleId: '1',
      date: new Date('2024-05-10'),
      type: 'inspection',
      description: 'Annual state inspection',
      cost: 25.00,
      mileage: 40500,
      vendor: 'State Inspection Center'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'out-of-service': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'service': return <Wrench className="h-4 w-4" />;
      case 'delivery': return <Truck className="h-4 w-4" />;
      case 'management': return <Car className="h-4 w-4" />;
      default: return <Car className="h-4 w-4" />;
    }
  };

  const isMaintenanceDue = (vehicle: Vehicle) => {
    const oilChangeDue = vehicle.currentMileage >= vehicle.nextOilChange - 1000;
    const inspectionDue = vehicle.nextInspection && new Date(vehicle.nextInspection) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return oilChangeDue || inspectionDue;
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
    const matchesType = typeFilter === 'all' || vehicle.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Vehicle Fleet Management</h1>
          <p className="text-gray-600">Manage your service and delivery vehicle fleet</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
                </div>
                <Car className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Vehicles</p>
                  <p className="text-2xl font-bold text-green-600">
                    {vehicles.filter(v => v.status === 'active').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Maintenance Due</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {vehicles.filter(v => isMaintenanceDue(v)).length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Lease Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${vehicles.reduce((sum, v) => sum + (v.monthlyPayment || 0), 0).toLocaleString()}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search vehicles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="out-of-service">Out of Service</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="service">Service Vehicles</SelectItem>
              <SelectItem value="delivery">Delivery Vehicles</SelectItem>
              <SelectItem value="management">Management Vehicles</SelectItem>
            </SelectContent>
          </Select>

          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Vehicle</DialogTitle>
                <DialogDescription>
                  Add a new vehicle to your fleet management system
                </DialogDescription>
              </DialogHeader>
              {/* Add Vehicle Form would go here */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input id="make" placeholder="Ford" />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" placeholder="Transit" />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" type="number" placeholder="2024" />
                </div>
                <div>
                  <Label htmlFor="vin">VIN</Label>
                  <Input id="vin" placeholder="1FTBW2CM8NKA12345" />
                </div>
                <div>
                  <Label htmlFor="license">License Plate</Label>
                  <Input id="license" placeholder="SRV-001" />
                </div>
                <div>
                  <Label htmlFor="type">Vehicle Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Service Vehicle</SelectItem>
                      <SelectItem value="delivery">Delivery Vehicle</SelectItem>
                      <SelectItem value="management">Management Vehicle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline">Cancel</Button>
                <Button>Add Vehicle</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vehicle List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(vehicle.type)}
                    <div>
                      <CardTitle className="text-lg">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </CardTitle>
                      <CardDescription>{vehicle.licensePlate}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={getStatusColor(vehicle.status)}>
                      {vehicle.status}
                    </Badge>
                    {vehicle.maintenanceAlerts > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <Bell className="h-3 w-3 mr-1" />
                        {vehicle.maintenanceAlerts}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Gauge className="h-4 w-4" />
                      Current Mileage
                    </span>
                    <span className="font-medium">{vehicle.currentMileage.toLocaleString()} mi</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Fuel className="h-4 w-4" />
                      Next Oil Change
                    </span>
                    <span className={`font-medium ${vehicle.currentMileage >= vehicle.nextOilChange - 1000 ? 'text-yellow-600' : ''}`}>
                      {vehicle.nextOilChange.toLocaleString()} mi
                    </span>
                  </div>
                  
                  {vehicle.assignedTechnician && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        Assigned Tech
                      </span>
                      <span className="font-medium">{vehicle.assignedTechnician}</span>
                    </div>
                  )}
                  
                  {vehicle.ownership === 'leased' && vehicle.leaseExpiration && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Lease Expires
                      </span>
                      <span className="font-medium">
                        {new Date(vehicle.leaseExpiration).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {vehicle.monthlyPayment && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Monthly Payment
                      </span>
                      <span className="font-medium">${vehicle.monthlyPayment}/mo</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setSelectedVehicle(vehicle)}
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

        {/* Vehicle Detail Modal */}
        {selectedVehicle && (
          <Dialog open={!!selectedVehicle} onOpenChange={() => setSelectedVehicle(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </DialogTitle>
                <DialogDescription>
                  Vehicle Details and Maintenance History
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                  <TabsTrigger value="costs">Costs</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Vehicle Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>VIN:</span>
                            <span className="font-medium">{selectedVehicle.vin}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>License Plate:</span>
                            <span className="font-medium">{selectedVehicle.licensePlate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <span className="font-medium capitalize">{selectedVehicle.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ownership:</span>
                            <span className="font-medium capitalize">{selectedVehicle.ownership}</span>
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
                            <Badge className={getStatusColor(selectedVehicle.status)}>
                              {selectedVehicle.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Current Mileage:</span>
                            <span className="font-medium">{selectedVehicle.currentMileage.toLocaleString()} mi</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Assigned Technician:</span>
                            <span className="font-medium">{selectedVehicle.assignedTechnician || 'Unassigned'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
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
                      .filter(record => record.vehicleId === selectedVehicle.id)
                      .map((record) => (
                        <Card key={record.id}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium capitalize">
                                  {record.type.replace('-', ' ')}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {record.date.toLocaleDateString()} • {record.mileage.toLocaleString()} mi
                                </p>
                              </div>
                              <p className="font-medium">${record.cost}</p>
                            </div>
                            <p className="text-sm">{record.description}</p>
                            <p className="text-xs text-gray-500">Vendor: {record.vendor}</p>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="costs">
                  <Card>
                    <CardHeader>
                      <CardTitle>Cost Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Monthly Payment</p>
                            <p className="text-2xl font-bold">
                              ${selectedVehicle.monthlyPayment || 0}/mo
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Total Maintenance Cost</p>
                            <p className="text-2xl font-bold">
                              ${maintenanceRecords
                                .filter(r => r.vehicleId === selectedVehicle.id)
                                .reduce((sum, r) => sum + r.cost, 0)
                                .toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="schedule">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upcoming Maintenance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <p className="font-medium">Oil Change</p>
                            <p className="text-sm text-gray-600">
                              Due at {selectedVehicle.nextOilChange.toLocaleString()} mi
                            </p>
                          </div>
                          <Badge variant={selectedVehicle.currentMileage >= selectedVehicle.nextOilChange - 1000 ? "destructive" : "secondary"}>
                            {selectedVehicle.nextOilChange - selectedVehicle.currentMileage} mi remaining
                          </Badge>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <p className="font-medium">Annual Inspection</p>
                            <p className="text-sm text-gray-600">
                              Due: {selectedVehicle.nextInspection.toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {Math.ceil((selectedVehicle.nextInspection.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                          </Badge>
                        </div>
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

export default VehicleManagement;