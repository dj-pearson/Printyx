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
import {
  BarChart3,
  Plus,
  Search,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Clock,
  MoreHorizontal,
  Eye,
  Edit,
  Download,
  RefreshCcw,
  Calculator,
  Printer,
  Activity,
  FileText,
} from "lucide-react";
import { format, subMonths, isAfter } from "date-fns";

interface MeterReading {
  id: string;
  equipmentId: string;
  equipmentSerialNumber?: string;
  equipmentModel?: string;
  contractId?: string;
  readingDate: string;
  bwMeterReading?: number;
  colorMeterReading?: number;
  scanMeterReading?: number;
  faxMeterReading?: number;
  totalMeterReading: number;
  previousMeterReading?: number;
  readingDifference: number;
  readingMethod: string;
  readingType: string;
  billingPeriod?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomerMeterReadingsProps {
  customerId: string;
  customerName: string;
}

const readingMethodColors = {
  manual: "bg-blue-100 text-blue-800",
  automatic: "bg-green-100 text-green-800",
  email: "bg-purple-100 text-purple-800",
  remote: "bg-orange-100 text-orange-800",
  service_call: "bg-gray-100 text-gray-800",
};

const readingTypeColors = {
  regular: "bg-green-100 text-green-800",
  service: "bg-blue-100 text-blue-800",
  billing: "bg-purple-100 text-purple-800",
  estimate: "bg-yellow-100 text-yellow-800",
  correction: "bg-red-100 text-red-800",
};

export function CustomerMeterReadings({ customerId, customerName }: CustomerMeterReadingsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [selectedReading, setSelectedReading] = useState<MeterReading | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch meter readings for this customer
  const { data: meterReadings = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/meter-readings", "customer", customerId],
    enabled: !!customerId,
  });

  // Fetch equipment list for filtering
  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment", "customer", customerId],
    enabled: !!customerId,
  });

  // Filter readings based on search and filters
  const filteredReadings = meterReadings.filter((reading: MeterReading) => {
    const matchesSearch = 
      reading.equipmentSerialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reading.equipmentModel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reading.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEquipment = equipmentFilter === "all" || reading.equipmentId === equipmentFilter;
    
    let matchesPeriod = true;
    if (periodFilter !== "all") {
      const readingDate = new Date(reading.readingDate);
      const now = new Date();
      switch (periodFilter) {
        case "this_month":
          matchesPeriod = readingDate.getMonth() === now.getMonth() && 
                        readingDate.getFullYear() === now.getFullYear();
          break;
        case "last_month":
          const lastMonth = subMonths(now, 1);
          matchesPeriod = readingDate.getMonth() === lastMonth.getMonth() && 
                        readingDate.getFullYear() === lastMonth.getFullYear();
          break;
        case "last_3_months":
          const threeMonthsAgo = subMonths(now, 3);
          matchesPeriod = isAfter(readingDate, threeMonthsAgo);
          break;
        case "last_6_months":
          const sixMonthsAgo = subMonths(now, 6);
          matchesPeriod = isAfter(readingDate, sixMonthsAgo);
          break;
      }
    }
    
    return matchesSearch && matchesEquipment && matchesPeriod;
  });

  // Calculate summary statistics
  const totalReadings = filteredReadings.length;
  const totalVolume = filteredReadings.reduce((sum: number, reading: MeterReading) => 
    sum + (reading.readingDifference || 0), 0);
  const averageVolume = totalReadings > 0 ? Math.round(totalVolume / totalReadings) : 0;
  const uniqueEquipment = new Set(filteredReadings.map((r: MeterReading) => r.equipmentId)).size;

  // Get readings that need attention (no reading in last 30 days per equipment)
  const equipmentLastReading = new Map();
  filteredReadings.forEach((reading: MeterReading) => {
    const current = equipmentLastReading.get(reading.equipmentId);
    if (!current || new Date(reading.readingDate) > new Date(current.readingDate)) {
      equipmentLastReading.set(reading.equipmentId, reading);
    }
  });

  const overdueEquipment = Array.from(equipmentLastReading.values()).filter((reading: MeterReading) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(reading.readingDate) < thirtyDaysAgo;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Meter Readings</h2>
          <p className="text-sm text-gray-600">
            Track device usage for {customerName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Reading
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Readings</p>
                <p className="text-2xl font-bold text-gray-900">{totalReadings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Printer className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Equipment</p>
                <p className="text-2xl font-bold text-gray-900">{uniqueEquipment}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Volume</p>
                <p className="text-2xl font-bold text-gray-900">{totalVolume.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Volume</p>
                <p className="text-2xl font-bold text-gray-900">{averageVolume.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Alerts */}
      {overdueEquipment.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
              <h3 className="text-sm font-medium text-amber-800">
                {overdueEquipment.length} equipment unit(s) haven't been read in over 30 days
              </h3>
            </div>
            <div className="mt-2 text-sm text-amber-700">
              Last readings: {overdueEquipment.map((r: MeterReading) => 
                `${r.equipmentSerialNumber} (${format(new Date(r.readingDate), "MMM d")})`
              ).join(", ")}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search readings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                {equipment.map((eq: any) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.serialNumber} - {eq.modelNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                <SelectItem value="last_6_months">Last 6 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Readings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Meter Readings ({filteredReadings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReadings.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No meter readings found
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || equipmentFilter !== "all" || periodFilter !== "all"
                  ? "No readings match your current filters."
                  : "This customer doesn't have any meter readings yet."}
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add First Reading
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Reading Date</TableHead>
                    <TableHead>Total Reading</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>B&W</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReadings.map((reading: MeterReading) => (
                    <TableRow key={reading.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {reading.equipmentSerialNumber || "Unknown"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {reading.equipmentModel}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(reading.readingDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {reading.totalMeterReading?.toLocaleString() || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="font-medium">
                            {reading.readingDifference?.toLocaleString() || "—"}
                          </span>
                          {reading.readingDifference && reading.readingDifference > 1000 && (
                            <TrendingUp className="h-4 w-4 text-green-600 ml-1" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {reading.bwMeterReading?.toLocaleString() || "—"}
                      </TableCell>
                      <TableCell>
                        {reading.colorMeterReading?.toLocaleString() || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={readingMethodColors[reading.readingMethod as keyof typeof readingMethodColors] || "bg-gray-100 text-gray-800"}>
                          {reading.readingMethod?.replace("_", " ") || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={readingTypeColors[reading.readingType as keyof typeof readingTypeColors] || "bg-gray-100 text-gray-800"}>
                          {reading.readingType || "Regular"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedReading(reading);
                                setShowDetails(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Reading
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Calculator className="h-4 w-4 mr-2" />
                              Calculate Billing
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="h-4 w-4 mr-2" />
                              Generate Report
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reading Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Meter Reading Details</DialogTitle>
          </DialogHeader>
          {selectedReading && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Equipment</h4>
                  <p className="text-gray-600">
                    {selectedReading.equipmentSerialNumber} - {selectedReading.equipmentModel}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Reading Date</h4>
                  <p className="text-gray-600">
                    {format(new Date(selectedReading.readingDate), "MMMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Total Reading</h4>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedReading.totalMeterReading?.toLocaleString() || "—"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Volume This Period</h4>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedReading.readingDifference?.toLocaleString() || "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Black & White</h4>
                  <p className="text-gray-600">
                    {selectedReading.bwMeterReading?.toLocaleString() || "—"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Color</h4>
                  <p className="text-gray-600">
                    {selectedReading.colorMeterReading?.toLocaleString() || "—"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Scan</h4>
                  <p className="text-gray-600">
                    {selectedReading.scanMeterReading?.toLocaleString() || "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Reading Method</h4>
                  <Badge className={readingMethodColors[selectedReading.readingMethod as keyof typeof readingMethodColors] || "bg-gray-100 text-gray-800"}>
                    {selectedReading.readingMethod?.replace("_", " ") || "Unknown"}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Reading Type</h4>
                  <Badge className={readingTypeColors[selectedReading.readingType as keyof typeof readingTypeColors] || "bg-gray-100 text-gray-800"}>
                    {selectedReading.readingType || "Regular"}
                  </Badge>
                </div>
              </div>

              {selectedReading.notes && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {selectedReading.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Close
                </Button>
                <Button>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Reading
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}