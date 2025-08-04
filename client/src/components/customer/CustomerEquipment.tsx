import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Printer,
  Plus,
  Search,
  Settings,
  Wifi,
  Activity,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Eye,
  Wrench,
  BarChart3,
  RefreshCw,
  DollarSign,
  Shield,
} from "lucide-react";
import { format } from "date-fns";

interface Equipment {
  id: string;
  serialNumber: string;
  modelNumber: string;
  manufacturer: string;
  description: string;
  assetTag?: string;
  locationDescription?: string;
  installDate?: string;
  ipAddress?: string;
  meterType: string;
  isColorCapable: boolean;
  equipmentStatus: string;
  purchasePrice?: number;
  monthlyPayment?: number;
  leaseExpiresDate?: string;
  warrantyExpiresDate?: string;
  serviceContractNumber?: string;
  lastServiceDate?: string;
  currentMeterReading?: number;
  lastMeterReading?: number;
  customerId: string;
}

interface MeterReading {
  id: string;
  equipmentId: string;
  readingDate: string;
  currentMeterCount: number;
  previousMeterCount: number;
  printVolume: number;
  colorPages?: number;
  blackWhitePages?: number;
  readingType: string;
}

interface CustomerEquipmentProps {
  customerId: string;
  customerName: string;
}

const statusColors = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  retired: "bg-red-100 text-red-800",
};

const meterTypeLabels = {
  bw_only: "B&W Only",
  color: "Color",
  scan: "Scan",
  fax: "Fax",
};

export function CustomerEquipment({
  customerId,
  customerName,
}: CustomerEquipmentProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null
  );

  // Fetch equipment for this customer
  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: [`/api/customers/${customerId}/equipment`],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/equipment`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch equipment");
      return response.json();
    },
  });

  // Fetch meter readings for selected equipment
  const { data: meterReadings = [] } = useQuery<MeterReading[]>({
    queryKey: [`/api/equipment/${selectedEquipment?.id}/meter-readings`],
    queryFn: async () => {
      if (!selectedEquipment?.id) return [];
      const response = await fetch(
        `/api/equipment/${selectedEquipment.id}/meter-readings`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch meter readings");
      return response.json();
    },
    enabled: !!selectedEquipment?.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  // Filter equipment
  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch =
      item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.modelNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || item.equipmentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate equipment statistics
  const stats = {
    total: equipment.length,
    active: equipment.filter((e) => e.equipmentStatus === "active").length,
    maintenance: equipment.filter((e) => e.equipmentStatus === "maintenance")
      .length,
    color: equipment.filter((e) => e.isColorCapable).length,
    underWarranty: equipment.filter(
      (e) =>
        e.warrantyExpiresDate && new Date(e.warrantyExpiresDate) > new Date()
    ).length,
  };

  const getWarrantyStatus = (warrantyDate?: string) => {
    if (!warrantyDate) return { status: "expired", daysLeft: 0 };
    const expiry = new Date(warrantyDate);
    const today = new Date();
    const daysLeft = Math.ceil(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft > 0) {
      return { status: "active", daysLeft };
    } else {
      return { status: "expired", daysLeft: 0 };
    }
  };

  const getLeaseStatus = (leaseDate?: string) => {
    if (!leaseDate) return { status: "owned", daysLeft: 0 };
    const expiry = new Date(leaseDate);
    const today = new Date();
    const daysLeft = Math.ceil(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft > 0) {
      return { status: "active", daysLeft };
    } else {
      return { status: "expired", daysLeft: 0 };
    }
  };

  return (
    <div className="space-y-6">
      {/* Equipment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Printer className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Equipment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-gray-600">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Wrench className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.maintenance}</p>
                <p className="text-sm text-gray-600">Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.color}</p>
                <p className="text-sm text-gray-600">Color Capable</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.underWarranty}</p>
                <p className="text-sm text-gray-600">Under Warranty</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by serial number, model, or manufacturer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Equipment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Equipment</DialogTitle>
                  </DialogHeader>
                  <div className="p-4">
                    <p className="text-gray-600">
                      Equipment registration form would go here...
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="min-w-[150px]">Equipment</TableHead>
                    <TableHead className="min-w-[120px]">
                      Serial Number
                    </TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[100px]">Type</TableHead>
                    <TableHead className="min-w-[120px]">Location</TableHead>
                    <TableHead className="min-w-[100px]">
                      Install Date
                    </TableHead>
                    <TableHead className="min-w-[120px]">Warranty</TableHead>
                    <TableHead className="min-w-[120px]">
                      Lease Expires
                    </TableHead>
                    <TableHead className="min-w-[100px]">
                      Monthly Payment
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      Last Service
                    </TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipment.map((item) => {
                    const warrantyStatus = getWarrantyStatus(
                      item.warrantyExpiresDate
                    );
                    const leaseStatus = getLeaseStatus(item.leaseExpiresDate);

                    return (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {item.manufacturer} {item.modelNumber}
                            </div>
                            <div className="text-sm text-gray-500">
                              {item.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm">
                            {item.serialNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              statusColors[
                                item.equipmentStatus as keyof typeof statusColors
                              ]
                            }
                          >
                            {item.equipmentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">
                              {meterTypeLabels[
                                item.meterType as keyof typeof meterTypeLabels
                              ] || item.meterType}
                            </span>
                            {item.isColorCapable && (
                              <Badge variant="outline" className="text-xs">
                                Color
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.locationDescription || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.installDate
                            ? formatDate(item.installDate)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {warrantyStatus.status === "active" ? (
                              <Badge className="bg-green-100 text-green-800">
                                {warrantyStatus.daysLeft} days
                              </Badge>
                            ) : warrantyStatus.status === "expired" ? (
                              <Badge className="bg-red-100 text-red-800">
                                Expired
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.leaseExpiresDate ? (
                            <div className="text-sm">
                              {leaseStatus.status === "active" ? (
                                <Badge className="bg-blue-100 text-blue-800">
                                  {formatDate(item.leaseExpiresDate)}
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800">
                                  Expired
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">
                              Owned
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.monthlyPayment
                            ? formatCurrency(item.monthlyPayment)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {item.lastServiceDate
                            ? formatDate(item.lastServiceDate)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setSelectedEquipment(item)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Meter Readings
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Wrench className="mr-2 h-4 w-4" />
                                Schedule Service
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Update Status
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                Edit Equipment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Equipment Details Dialog */}
      {selectedEquipment && (
        <Dialog
          open={!!selectedEquipment}
          onOpenChange={() => setSelectedEquipment(null)}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Equipment Details - {selectedEquipment.manufacturer}{" "}
                {selectedEquipment.modelNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Serial Number:</span>
                    <p className="font-mono">
                      {selectedEquipment.serialNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Asset Tag:</span>
                    <p>{selectedEquipment.assetTag || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <Badge
                      className={
                        statusColors[
                          selectedEquipment.equipmentStatus as keyof typeof statusColors
                        ]
                      }
                    >
                      {selectedEquipment.equipmentStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-600">IP Address:</span>
                    <p>{selectedEquipment.ipAddress || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Financial Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Purchase Price:</span>
                    <p>
                      {selectedEquipment.purchasePrice
                        ? formatCurrency(selectedEquipment.purchasePrice)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Monthly Payment:</span>
                    <p>
                      {selectedEquipment.monthlyPayment
                        ? formatCurrency(selectedEquipment.monthlyPayment)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Warranty Expires:</span>
                    <p>
                      {selectedEquipment.warrantyExpiresDate
                        ? formatDate(selectedEquipment.warrantyExpiresDate)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Lease Expires:</span>
                    <p>
                      {selectedEquipment.leaseExpiresDate
                        ? formatDate(selectedEquipment.leaseExpiresDate)
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Meter Readings */}
            {meterReadings.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-4">Recent Meter Readings</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Current Reading</TableHead>
                        <TableHead>Print Volume</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meterReadings.slice(0, 5).map((reading) => (
                        <TableRow key={reading.id}>
                          <TableCell>
                            {formatDate(reading.readingDate)}
                          </TableCell>
                          <TableCell>
                            {reading.currentMeterCount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {reading.printVolume.toLocaleString()}
                          </TableCell>
                          <TableCell className="capitalize">
                            {reading.readingType}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* No equipment state */}
      {filteredEquipment.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Printer className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No equipment found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? "No equipment matches your search criteria."
                : "No equipment has been registered for this customer yet."}
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add First Equipment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
