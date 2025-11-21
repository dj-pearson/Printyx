import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Calculator,
  Calendar,
  Activity,
  Camera,
  Filter,
  X,
  TrendingUp,
  AlertCircle,
  MapPin,
  Search
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMeterReadingSchema } from "@shared/schema";
import type { MeterReading, Equipment, Contract, Location } from "@shared/schema";
import { z } from "zod";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const createMeterReadingSchema = insertMeterReadingSchema.extend({
  readingDate: z.string(),
  photoUrl: z.string().optional(),
});

type CreateMeterReadingInput = z.infer<typeof createMeterReadingSchema>;

type DateRangePreset = {
  label: string;
  value: string;
  getDates: () => { start: Date; end: Date };
};

const dateRangePresets: DateRangePreset[] = [
  {
    label: "Last 7 Days",
    value: "7d",
    getDates: () => ({
      start: subDays(new Date(), 7),
      end: new Date(),
    }),
  },
  {
    label: "Last 30 Days",
    value: "30d",
    getDates: () => ({
      start: subDays(new Date(), 30),
      end: new Date(),
    }),
  },
  {
    label: "This Month",
    value: "this_month",
    getDates: () => ({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    }),
  },
  {
    label: "Last Month",
    value: "last_month",
    getDates: () => ({
      start: startOfMonth(subMonths(new Date(), 1)),
      end: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
];

export default function MeterReadings() {
  const [, setLocationPath] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [urlFilter, setUrlFilter] = useState<{ type?: string; n?: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const type = params.get('filter') || undefined;
    const n = params.get('n') || undefined;
    if (type) setUrlFilter({ type, n });
  }, []);

  const { data: meterReadings, isLoading: isLoadingReadings } = useQuery<MeterReading[]>({
    queryKey: ["/api/meter-readings", typeof window !== 'undefined' ? window.location.search : ""],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const filter = urlParams.get('filter');
        const n = urlParams.get('n');
        if (filter) params.append('filter', filter);
        if (n) params.append('n', n);
      }
      const qs = params.toString();
      const path = `/api/meter-readings${qs ? `?${qs}` : ''}`;
      return await apiRequest(path, 'GET');
    }
  });

  const { data: equipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const form = useForm<CreateMeterReadingInput>({
    resolver: zodResolver(createMeterReadingSchema),
    defaultValues: {
      readingDate: new Date().toISOString().split("T")[0],
      blackMeter: 0,
      colorMeter: 0,
      collectionMethod: "manual",
      notes: "",
      photoUrl: "",
    },
  });

  const selectedEquipmentId = form.watch("equipmentId");

  // Get previous reading for selected equipment
  const previousReading = useMemo(() => {
    if (!selectedEquipmentId || !meterReadings) return null;
    const equipmentReadings = meterReadings
      .filter((r) => r.equipmentId === selectedEquipmentId)
      .sort((a, b) => new Date(b.readingDate).getTime() - new Date(a.readingDate).getTime());
    return equipmentReadings[0] || null;
  }, [selectedEquipmentId, meterReadings]);

  // Calculate deltas
  const blackDelta = useMemo(() => {
    const current = form.watch("blackMeter");
    if (!previousReading || !current) return 0;
    return current - previousReading.blackMeter;
  }, [form.watch("blackMeter"), previousReading]);

  const colorDelta = useMemo(() => {
    const current = form.watch("colorMeter");
    if (!previousReading || !current) return 0;
    return current - previousReading.colorMeter;
  }, [form.watch("colorMeter"), previousReading]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateMeterReadingInput) =>
      apiRequest("/api/meter-readings", "POST", {
        ...data,
        readingDate: new Date(data.readingDate),
        blackMeter: parseInt((data.blackMeter || 0).toString()),
        colorMeter: parseInt((data.colorMeter || 0).toString()),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meter-readings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setPhotoPreview(null);
    },
  });

  const handleSubmit = (data: CreateMeterReadingInput) => {
    createMutation.mutate(data);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        form.setValue("photoUrl", result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getEquipmentName = (equipmentId: string) => {
    const eq = equipment?.find((e) => e.id === equipmentId);
    return eq
      ? `${eq.manufacturer} ${eq.model} (${eq.serialNumber})`
      : "Unknown Equipment";
  };

  const getEquipmentLocation = (equipmentId: string) => {
    const eq = equipment?.find((e) => e.id === equipmentId);
    if (!eq?.locationId) return null;
    return locations?.find((l) => l.id === eq.locationId);
  };

  const getContractNumber = (contractId: string) => {
    const contract = contracts?.find((c) => c.id === contractId);
    return contract?.contractNumber || "Unknown Contract";
  };

  const getCollectionMethodBadge = (method: string) => {
    const variants = {
      manual: "default",
      email: "secondary",
      dca: "outline",
    } as const;

    return (
      <Badge
        variant={variants[method as keyof typeof variants] || "default"}
        className="touch-manipulation"
      >
        {method.toUpperCase()}
      </Badge>
    );
  };

  const isOverdue = (reading: MeterReading) => {
    const daysSinceReading = Math.floor(
      (new Date().getTime() - new Date(reading.readingDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceReading > 45; // Consider overdue after 45 days
  };

  // Filter readings based on selected filters
  const filteredReadings = useMemo(() => {
    if (!meterReadings) return [];

    let filtered = [...meterReadings];

    // Equipment filter
    if (selectedEquipment !== "all") {
      filtered = filtered.filter((r) => r.equipmentId === selectedEquipment);
    }

    // Location filter
    if (selectedLocation !== "all") {
      filtered = filtered.filter((r) => {
        const eq = equipment?.find((e) => e.id === r.equipmentId);
        return eq?.locationId === selectedLocation;
      });
    }

    // Status filter
    if (selectedStatus === "overdue") {
      filtered = filtered.filter(isOverdue);
    } else if (selectedStatus === "recent") {
      filtered = filtered.filter((r) => !isOverdue(r));
    }

    // Date range filter
    if (dateRange !== "all") {
      const preset = dateRangePresets.find((p) => p.value === dateRange);
      if (preset) {
        const { start, end } = preset.getDates();
        filtered = filtered.filter((r) => {
          const readingDate = new Date(r.readingDate);
          return readingDate >= start && readingDate <= end;
        });
      }
    }

    return filtered;
  }, [meterReadings, selectedEquipment, selectedLocation, selectedStatus, dateRange, equipment]);

  // Filter equipment by search
  const filteredEquipment = useMemo(() => {
    if (!equipment) return [];
    if (!equipmentSearch) return equipment;

    const search = equipmentSearch.toLowerCase();
    return equipment.filter((eq) => {
      const name = `${eq.manufacturer} ${eq.model} ${eq.serialNumber}`.toLowerCase();
      return name.includes(search);
    });
  }, [equipment, equipmentSearch]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedEquipment !== "all") count++;
    if (selectedLocation !== "all") count++;
    if (selectedStatus !== "all") count++;
    if (dateRange !== "all") count++;
    return count;
  }, [selectedEquipment, selectedLocation, selectedStatus, dateRange]);

  if (isLoadingReadings) {
    return (
      <MainLayout
        title="Meter Readings"
        description="Manage equipment meter readings and calculate billing"
      >
        <div className="grid gap-3 sm:gap-4 p-4 sm:p-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 sm:p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Meter Readings"
      description="Manage equipment meter readings and calculate billing"
    >
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* URL Filter Banner */}
        {urlFilter?.type === 'missed_cycles' && (
          <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span>
              Showing devices with missed meter cycles{urlFilter?.n ? ` (N=${urlFilter.n})` : ''}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocationPath('/meter-readings')}
              className="touch-manipulation active:scale-[0.98] min-h-[44px] w-full sm:w-auto"
            >
              Clear Filter
            </Button>
          </div>
        )}

        {/* Mobile-First Action Bar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Filter Toggle Button */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="touch-manipulation active:scale-[0.98] min-h-[44px] flex-1 sm:flex-none relative"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {/* Billing Button */}
          <Button
            variant="outline"
            onClick={() => setLocationPath('/advanced-billing')}
            className="touch-manipulation active:scale-[0.98] min-h-[44px] flex-1 sm:flex-none"
          >
            <Calculator className="w-4 h-4 mr-2" />
            <span className="sm:inline">Billing</span>
          </Button>

          {/* Add Reading Button */}
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                className="touch-manipulation active:scale-[0.98] min-h-[44px] flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4 mr-2" />
                Record Reading
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-full sm:max-w-[600px] max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto p-0">
              <DialogHeader className="p-4 sm:p-6 pb-4">
                <DialogTitle className="text-xl sm:text-2xl">Record Meter Reading</DialogTitle>
                <DialogDescription>
                  Enter new meter readings for equipment billing calculations
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4"
                >
                  {/* Equipment Selection with Search */}
                  <FormField
                    control={form.control}
                    name="equipmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Equipment *</FormLabel>
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Search equipment..."
                              value={equipmentSearch}
                              onChange={(e) => setEquipmentSearch(e.target.value)}
                              className="pl-9 min-h-[44px] touch-manipulation text-base"
                            />
                          </div>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="min-h-[44px] touch-manipulation text-base">
                                <SelectValue placeholder="Select equipment" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                              {filteredEquipment.map((eq) => {
                                const location = locations?.find((l) => l.id === eq.locationId);
                                return (
                                  <SelectItem
                                    key={eq.id}
                                    value={eq.id}
                                    className="min-h-[44px] touch-manipulation"
                                  >
                                    <div className="flex flex-col">
                                      <span>{eq.manufacturer} {eq.model}</span>
                                      <span className="text-xs text-gray-500">
                                        {eq.serialNumber} {location ? `• ${location.name}` : ''}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Contract Selection */}
                  <FormField
                    control={form.control}
                    name="contractId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Contract *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="min-h-[44px] touch-manipulation text-base">
                              <SelectValue placeholder="Select contract" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contracts?.map((contract) => (
                              <SelectItem
                                key={contract.id}
                                value={contract.id}
                                className="min-h-[44px] touch-manipulation"
                              >
                                {contract.contractNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Previous Reading Display */}
                  {previousReading && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                        <Activity className="w-4 h-4" />
                        Previous Reading ({format(new Date(previousReading.readingDate), "MMM dd, yyyy")})
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Black & White</p>
                          <p className="font-semibold text-lg">{previousReading.blackMeter.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Color</p>
                          <p className="font-semibold text-lg">{previousReading.colorMeter.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reading Date with Presets */}
                  <FormField
                    control={form.control}
                    name="readingDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Reading Date *</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              className="min-h-[44px] touch-manipulation text-base flex-1"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => field.onChange(new Date().toISOString().split("T")[0])}
                            className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                          >
                            Today
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Large Meter Inputs with Delta Calculation */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="blackMeter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Black & White Meter *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 0)
                              }
                              className="min-h-[56px] text-2xl font-semibold touch-manipulation"
                              placeholder="0"
                            />
                          </FormControl>
                          {blackDelta !== 0 && (
                            <FormDescription className={cn(
                              "flex items-center gap-1 text-base font-medium",
                              blackDelta > 0 ? "text-green-600" : "text-red-600"
                            )}>
                              <TrendingUp className="w-4 h-4" />
                              {blackDelta > 0 ? '+' : ''}{blackDelta.toLocaleString()} copies
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="colorMeter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Color Meter *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value) || 0)
                              }
                              className="min-h-[56px] text-2xl font-semibold touch-manipulation"
                              placeholder="0"
                            />
                          </FormControl>
                          {colorDelta !== 0 && (
                            <FormDescription className={cn(
                              "flex items-center gap-1 text-base font-medium",
                              colorDelta > 0 ? "text-blue-600" : "text-red-600"
                            )}>
                              <TrendingUp className="w-4 h-4" />
                              {colorDelta > 0 ? '+' : ''}{colorDelta.toLocaleString()} copies
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Photo Upload for Mobile */}
                  <div className="space-y-2">
                    <Label className="text-base">Meter Photo (Optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoCapture}
                        className="hidden"
                        id="meter-photo"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('meter-photo')?.click()}
                        className="flex-1 min-h-[44px] touch-manipulation active:scale-[0.98]"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        {photoPreview ? "Change Photo" : "Take Photo"}
                      </Button>
                      {photoPreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setPhotoPreview(null);
                            form.setValue("photoUrl", "");
                          }}
                          className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {photoPreview && (
                      <div className="mt-2 rounded-lg overflow-hidden border">
                        <img
                          src={photoPreview}
                          alt="Meter reading preview"
                          className="w-full h-auto"
                        />
                      </div>
                    )}
                  </div>

                  {/* Collection Method */}
                  <FormField
                    control={form.control}
                    name="collectionMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Collection Method</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="min-h-[44px] touch-manipulation text-base">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manual" className="min-h-[44px] touch-manipulation">
                              Manual Entry
                            </SelectItem>
                            <SelectItem value="email" className="min-h-[44px] touch-manipulation">
                              Email Collection
                            </SelectItem>
                            <SelectItem value="dca" className="min-h-[44px] touch-manipulation">
                              DCA Integration
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Additional notes about this reading..."
                            className="min-h-[100px] touch-manipulation text-base resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setPhotoPreview(null);
                      }}
                      className="w-full sm:w-auto min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="w-full sm:w-auto min-h-[44px] touch-manipulation active:scale-[0.98]"
                    >
                      {createMutation.isPending
                        ? "Saving..."
                        : "Save Reading"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mobile-Friendly Filter Panel */}
        {showFilters && (
          <Card className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Filter Readings</h3>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedEquipment("all");
                    setSelectedLocation("all");
                    setSelectedStatus("all");
                    setDateRange("all");
                  }}
                  className="text-sm touch-manipulation active:scale-[0.98]"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Equipment Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Equipment</Label>
                <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="min-h-[44px] touch-manipulation">
                      All Equipment
                    </SelectItem>
                    {equipment?.map((eq) => (
                      <SelectItem
                        key={eq.id}
                        value={eq.id}
                        className="min-h-[44px] touch-manipulation"
                      >
                        {eq.manufacturer} {eq.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Location</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="min-h-[44px] touch-manipulation">
                      All Locations
                    </SelectItem>
                    {locations?.map((loc) => (
                      <SelectItem
                        key={loc.id}
                        value={loc.id}
                        className="min-h-[44px] touch-manipulation"
                      >
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="min-h-[44px] touch-manipulation">
                      All Readings
                    </SelectItem>
                    <SelectItem value="recent" className="min-h-[44px] touch-manipulation">
                      Recent (Last 45 Days)
                    </SelectItem>
                    <SelectItem value="overdue" className="min-h-[44px] touch-manipulation">
                      Overdue (45+ Days)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="min-h-[44px] touch-manipulation">
                      All Time
                    </SelectItem>
                    {dateRangePresets.map((preset) => (
                      <SelectItem
                        key={preset.value}
                        value={preset.value}
                        className="min-h-[44px] touch-manipulation"
                      >
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}

        {/* Mobile-Optimized Reading Cards */}
        <div className="grid gap-3 sm:gap-4">
          {filteredReadings.map((reading) => {
            const location = getEquipmentLocation(reading.equipmentId);
            const overdue = isOverdue(reading);

            return (
              <Card
                key={reading.id}
                className={cn(
                  "transition-all touch-manipulation active:scale-[0.99]",
                  overdue && "border-orange-300 bg-orange-50/50"
                )}
              >
                <CardHeader className="p-4 sm:p-6 pb-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg line-clamp-2">
                        {getEquipmentName(reading.equipmentId)}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                        {location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {location.name}
                          </span>
                        )}
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(reading.readingDate), "MMM dd, yyyy")}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getCollectionMethodBadge(reading.collectionMethod)}
                      {overdue && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
                  {/* Meter Readings Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                      <Activity className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-gray-600 font-medium">
                          Black & White
                        </p>
                        <p className="font-bold text-lg sm:text-xl mt-1">
                          {reading.blackMeter.toLocaleString()}
                        </p>
                        {(reading.blackCopies || 0) > 0 && (
                          <p className="text-xs text-green-600 font-medium mt-1">
                            +{(reading.blackCopies || 0).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                      <Activity className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-gray-600 font-medium">
                          Color
                        </p>
                        <p className="font-bold text-lg sm:text-xl mt-1">
                          {reading.colorMeter.toLocaleString()}
                        </p>
                        {(reading.colorCopies || 0) > 0 && (
                          <p className="text-xs text-blue-600 font-medium mt-1">
                            +{(reading.colorCopies || 0).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contract Info */}
                  <div className="text-sm text-gray-600 px-3">
                    Contract: <span className="font-medium">{getContractNumber(reading.contractId)}</span>
                  </div>

                  {/* Notes */}
                  {reading.notes && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-gray-700">{reading.notes}</p>
                    </div>
                  )}

                  {/* Action Button */}
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px] touch-manipulation active:scale-[0.98]"
                    onClick={() => setLocationPath('/advanced-billing')}
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Calculate Billing
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {/* Empty State */}
          {filteredReadings.length === 0 && (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                  {activeFiltersCount > 0 ? "No matching readings" : "No meter readings yet"}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">
                  {activeFiltersCount > 0
                    ? "Try adjusting your filters to see more results."
                    : "Start by recording your first meter reading to track equipment usage and generate accurate billing."
                  }
                </p>
                {activeFiltersCount === 0 && (
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="min-h-[44px] touch-manipulation active:scale-[0.98]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Record First Reading
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
