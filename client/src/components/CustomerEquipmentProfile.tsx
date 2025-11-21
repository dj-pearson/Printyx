import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Printer,
  Activity,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  FileText,
  BarChart3,
  Settings,
} from "lucide-react";

interface Equipment {
  id: string;
  model: string;
  serialNumber: string;
  manufacturer: string;
  installDate: string;
  warranty: {
    status: "active" | "expired" | "expiring_soon";
    expiryDate: string;
  };
  serviceHistory: ServiceRecord[];
  maintenanceSchedule: MaintenanceRecord[];
  healthScore: number;
  usage: {
    monthlyVolume: number;
    averageDaily: number;
    currentMeterReading: number;
  };
  alerts: Alert[];
}

interface ServiceRecord {
  id: string;
  date: string;
  type: "repair" | "maintenance" | "installation";
  description: string;
  technician: string;
  partsUsed: string[];
  cost: number;
  status: "completed" | "pending" | "cancelled";
}

interface MaintenanceRecord {
  id: string;
  type: string;
  dueDate: string;
  lastCompleted?: string;
  frequency: string;
  priority: "low" | "medium" | "high";
}

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  dateCreated: string;
}

interface CustomerEquipmentProfileProps {
  customerId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerEquipmentProfile({
  customerId,
  isOpen,
  onClose,
}: CustomerEquipmentProfileProps) {
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  
  // Sample equipment data - in real app this would come from API
  const equipment: Equipment[] = [
    {
      id: "eq-001",
      model: "Canon imageRUNNER ADVANCE C5540i",
      serialNumber: "CAN001234567",
      manufacturer: "Canon",
      installDate: "2023-03-15",
      warranty: {
        status: "active",
        expiryDate: "2025-03-15",
      },
      serviceHistory: [
        {
          id: "srv-001",
          date: "2024-08-01",
          type: "maintenance",
          description: "Quarterly maintenance check",
          technician: "John Smith",
          partsUsed: ["Toner Cartridge", "Cleaning Kit"],
          cost: 150.00,
          status: "completed",
        },
        {
          id: "srv-002",
          date: "2024-05-15",
          type: "repair",
          description: "Paper jam mechanism repair",
          technician: "Sarah Johnson",
          partsUsed: ["Paper Feed Roller"],
          cost: 85.00,
          status: "completed",
        },
      ],
      maintenanceSchedule: [
        {
          id: "mnt-001",
          type: "Quarterly Maintenance",
          dueDate: "2024-11-01",
          lastCompleted: "2024-08-01",
          frequency: "Every 3 months",
          priority: "medium",
        },
        {
          id: "mnt-002",
          type: "Annual Inspection",
          dueDate: "2025-03-15",
          lastCompleted: "2024-03-15",
          frequency: "Annually",
          priority: "high",
        },
      ],
      healthScore: 87,
      usage: {
        monthlyVolume: 12500,
        averageDaily: 415,
        currentMeterReading: 245678,
      },
      alerts: [
        {
          id: "alert-001",
          type: "warning",
          message: "Toner level low (15% remaining)",
          severity: "medium",
          dateCreated: "2024-08-08",
        },
      ],
    },
    {
      id: "eq-002",
      model: "HP LaserJet Pro M404n",
      serialNumber: "HP987654321",
      manufacturer: "HP",
      installDate: "2023-06-20",
      warranty: {
        status: "expiring_soon",
        expiryDate: "2024-12-20",
      },
      serviceHistory: [
        {
          id: "srv-003",
          date: "2024-07-20",
          type: "repair",
          description: "Print quality issues resolved",
          technician: "Mike Wilson",
          partsUsed: ["Fuser Unit"],
          cost: 120.00,
          status: "completed",
        },
      ],
      maintenanceSchedule: [
        {
          id: "mnt-003",
          type: "Bi-annual Service",
          dueDate: "2024-12-20",
          lastCompleted: "2024-06-20",
          frequency: "Every 6 months",
          priority: "medium",
        },
      ],
      healthScore: 72,
      usage: {
        monthlyVolume: 3200,
        averageDaily: 107,
        currentMeterReading: 89432,
      },
      alerts: [
        {
          id: "alert-002",
          type: "warning",
          message: "Warranty expiring in 4 months",
          severity: "medium",
          dateCreated: "2024-08-05",
        },
        {
          id: "alert-003",
          type: "error",
          message: "Unusual print volume spike detected",
          severity: "high",
          dateCreated: "2024-08-07",
        },
      ],
    },
  ];

  const selectedEquipmentData = equipment.find(eq => eq.id === selectedEquipment);

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getWarrantyBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "expiring_soon":
        return "outline";
      case "expired":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Customer Equipment Profile
          </DialogTitle>
          <DialogDescription>
            Comprehensive equipment management and service history
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* Equipment List */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Equipment Inventory</h3>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {equipment.map((eq) => (
                    <Card
                      key={eq.id}
                      className={`cursor-pointer transition-all ${
                        selectedEquipment === eq.id
                          ? "ring-2 ring-blue-500 bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedEquipment(eq.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Printer className="h-4 w-4 text-gray-600" />
                              <span className="font-medium text-sm">{eq.manufacturer}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-2">
                              {eq.model}
                            </p>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={getWarrantyBadgeVariant(eq.warranty.status)}>
                                {eq.warranty.status.replace("_", " ")}
                              </Badge>
                              <span className={`text-sm font-medium ${getHealthScoreColor(eq.healthScore)}`}>
                                {eq.healthScore}% Health
                              </span>
                            </div>
                            {eq.alerts.length > 0 && (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                                <span className="text-xs text-red-600">
                                  {eq.alerts.length} alert{eq.alerts.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Equipment Details */}
            <div className="lg:col-span-2">
              {selectedEquipmentData ? (
                <Tabs defaultValue="overview" className="h-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="service">Service History</TabsTrigger>
                    <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <ScrollArea className="h-[450px]">
                      <div className="space-y-4">
                        {/* Equipment Details */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">{selectedEquipmentData.model}</CardTitle>
                            <CardDescription>
                              Serial: {selectedEquipmentData.serialNumber}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-600">Install Date</p>
                                <p className="font-medium">
                                  {new Date(selectedEquipmentData.installDate).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Warranty Status</p>
                                <Badge variant={getWarrantyBadgeVariant(selectedEquipmentData.warranty.status)}>
                                  {selectedEquipmentData.warranty.status.replace("_", " ")}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-600">Health Score</p>
                                <p className={`text-2xl font-bold ${getHealthScoreColor(selectedEquipmentData.healthScore)}`}>
                                  {selectedEquipmentData.healthScore}%
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Monthly Volume</p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {selectedEquipmentData.usage.monthlyVolume.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Active Alerts */}
                        {selectedEquipmentData.alerts.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                                Active Alerts ({selectedEquipmentData.alerts.length})
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {selectedEquipmentData.alerts.map((alert) => (
                                  <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                                    {getAlertIcon(alert.type)}
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{alert.message}</p>
                                      <p className="text-xs text-gray-500">
                                        {new Date(alert.dateCreated).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <Badge variant={alert.severity === "high" ? "destructive" : "outline"}>
                                      {alert.severity}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="service" className="space-y-4">
                    <ScrollArea className="h-[450px]">
                      <div className="space-y-3">
                        {selectedEquipmentData.serviceHistory.map((record) => (
                          <Card key={record.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Wrench className="h-4 w-4 text-gray-600" />
                                    <Badge variant={record.type === "repair" ? "destructive" : "default"}>
                                      {record.type}
                                    </Badge>
                                    <span className="text-sm text-gray-500">
                                      {new Date(record.date).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="font-medium">{record.description}</p>
                                  <p className="text-sm text-gray-600">Technician: {record.technician}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-green-600">${record.cost.toFixed(2)}</p>
                                  <Badge variant="outline">{record.status}</Badge>
                                </div>
                              </div>
                              {record.partsUsed.length > 0 && (
                                <div>
                                  <p className="text-sm text-gray-600 mb-1">Parts Used:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {record.partsUsed.map((part, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs">
                                        {part}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="maintenance" className="space-y-4">
                    <ScrollArea className="h-[450px]">
                      <div className="space-y-3">
                        {selectedEquipmentData.maintenanceSchedule.map((maintenance) => (
                          <Card key={maintenance.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="h-4 w-4 text-gray-600" />
                                    <span className="font-medium">{maintenance.type}</span>
                                    <Badge variant={maintenance.priority === "high" ? "destructive" : "default"}>
                                      {maintenance.priority}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-600">Due Date</p>
                                      <p className="font-medium">
                                        {new Date(maintenance.dueDate).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Frequency</p>
                                      <p className="font-medium">{maintenance.frequency}</p>
                                    </div>
                                  </div>
                                  {maintenance.lastCompleted && (
                                    <div className="mt-2">
                                      <p className="text-xs text-gray-500">
                                        Last completed: {new Date(maintenance.lastCompleted).toLocaleDateString()}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <Button size="sm" variant="outline">
                                  Schedule
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="analytics" className="space-y-4">
                    <ScrollArea className="h-[450px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              Usage Statistics
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm text-gray-600">Current Meter Reading</p>
                                <p className="text-2xl font-bold text-gray-900">
                                  {selectedEquipmentData.usage.currentMeterReading.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Average Daily Volume</p>
                                <p className="text-xl font-semibold text-blue-600">
                                  {selectedEquipmentData.usage.averageDaily}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Performance Insights
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm text-gray-600">Service Frequency</p>
                                <p className="text-lg font-semibold text-gray-900">
                                  {selectedEquipmentData.serviceHistory.length} services / year
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Avg Service Cost</p>
                                <p className="text-lg font-semibold text-green-600">
                                  ${(selectedEquipmentData.serviceHistory.reduce((sum, record) => sum + record.cost, 0) / selectedEquipmentData.serviceHistory.length).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Printer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Select equipment to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}