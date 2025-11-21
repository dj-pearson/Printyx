import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Calculator, 
  Calendar, 
  Activity, 
  DollarSign, 
  FileText, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMeterReadingSchema, insertContractTieredRateSchema } from "@shared/schema";
import type { MeterReading, Equipment, Contract, ContractTieredRate, Invoice } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const createMeterReadingSchema = insertMeterReadingSchema.extend({
  readingDate: z.string(),
});

const createTieredRateSchema = insertContractTieredRateSchema.extend({
  rate: z.string(),
  minimumCharge: z.string().optional(),
});

type CreateMeterReadingInput = z.infer<typeof createMeterReadingSchema>;
type CreateTieredRateInput = z.infer<typeof createTieredRateSchema>;

export default function MeterBilling() {
  const [isCreateReadingDialogOpen, setIsCreateReadingDialogOpen] = useState(false);
  const [isCreateTieredRateDialogOpen, setIsCreateTieredRateDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<string>("");
  const queryClient = useQueryClient();

  // Data fetching
  const { data: meterReadings, isLoading: isLoadingReadings } = useQuery<MeterReading[]>({
    queryKey: ["/api/meter-readings"],
  });

  const { data: equipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: tieredRates } = useQuery<ContractTieredRate[]>({
    queryKey: ["/api/contract-tiered-rates"],
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  // Forms
  const meterForm = useForm<CreateMeterReadingInput>({
    resolver: zodResolver(createMeterReadingSchema),
    defaultValues: {
      readingDate: new Date().toISOString().split('T')[0],
      blackMeter: 0,
      colorMeter: 0,
      collectionMethod: 'manual',
      notes: '',
    },
  });

  const tieredRateForm = useForm<CreateTieredRateInput>({
    resolver: zodResolver(createTieredRateSchema),
    defaultValues: {
      contractId: selectedContract,
      tierName: '',
      colorType: 'black',
      minimumVolume: 0,
      rate: '0.0000',
      sortOrder: 0,
    },
  });

  // Mutations
  const createMeterReadingMutation = useMutation({
    mutationFn: async (data: CreateMeterReadingInput) => {
      const response = await apiRequest('/api/meter-readings', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          readingDate: new Date(data.readingDate),
          blackMeter: parseInt((data.blackMeter || 0).toString()),
          colorMeter: parseInt((data.colorMeter || 0).toString()),
        }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meter-readings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setIsCreateReadingDialogOpen(false);
      meterForm.reset();
    },
  });

  const createTieredRateMutation = useMutation({
    mutationFn: async (data: CreateTieredRateInput) => {
      const response = await apiRequest('/api/contract-tiered-rates', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          rate: parseFloat(data.rate),
          minimumCharge: data.minimumCharge ? parseFloat(data.minimumCharge) : null,
        }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-tiered-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsCreateTieredRateDialogOpen(false);
      tieredRateForm.reset();
    },
  });

  const generateInvoicesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/billing/generate-invoices', {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meter-readings"] });
    },
  });

  // Handlers
  const handleCreateMeterReading = (data: CreateMeterReadingInput) => {
    createMeterReadingMutation.mutate(data);
  };

  const handleCreateTieredRate = (data: CreateTieredRateInput) => {
    createTieredRateMutation.mutate(data);
  };

  // Utility functions
  const getEquipmentName = (equipmentId: string) => {
    const eq = equipment?.find(e => e.id === equipmentId);
    return eq ? `${eq.manufacturer} ${eq.model} (${eq.serialNumber})` : 'Unknown Equipment';
  };

  const getContractNumber = (contractId: string) => {
    const contract = contracts?.find(c => c.id === contractId);
    return contract?.contractNumber || 'Unknown Contract';
  };

  const getCollectionMethodBadge = (method: string) => {
    const variants = {
      manual: { variant: 'default' as const, color: 'bg-gray-100' },
      email: { variant: 'secondary' as const, color: 'bg-blue-100' },
      dca: { variant: 'outline' as const, color: 'bg-green-100' },
      api: { variant: 'outline' as const, color: 'bg-purple-100' },
      remote_monitoring: { variant: 'secondary' as const, color: 'bg-orange-100' },
    };
    
    const config = variants[method as keyof typeof variants] || variants.manual;
    
    return (
      <Badge variant={config.variant}>
        {method.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getBillingStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: 'outline' as const, icon: Clock },
      processed: { variant: 'secondary' as const, icon: CheckCircle },
      billed: { variant: 'default' as const, icon: FileText },
      disputed: { variant: 'destructive' as const, icon: AlertCircle },
    };
    
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  // Calculate metrics
  const monthlyRevenue = invoices?.reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0) || 0;
  const pendingReadings = meterReadings?.filter(r => r.billingStatus === 'pending').length || 0;
  const averageBlackRate = contracts?.reduce((sum, c) => sum + parseFloat(c.blackRate?.toString() || '0'), 0) / (contracts?.length || 1) || 0;
  const averageColorRate = contracts?.reduce((sum, c) => sum + parseFloat(c.colorRate?.toString() || '0'), 0) / (contracts?.length || 1) || 0;

  if (isLoadingReadings) {
    return (
      <MainLayout 
        title="Meter Billing" 
        description="Comprehensive meter billing and contract management system"
      >
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
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
      title="Meter Billing" 
      description="Comprehensive meter billing and contract management system"
    >
      <div className="space-y-6">
        {/* Billing Metrics Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Monthly Revenue</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">
                    ${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Pending Readings</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{pendingReadings}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Avg B&W Rate</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">
                    ${averageBlackRate.toFixed(4)}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Avg Color Rate</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">
                    ${averageColorRate.toFixed(4)}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Dialog open={isCreateReadingDialogOpen} onOpenChange={setIsCreateReadingDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Meter Reading
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Meter Reading</DialogTitle>
                <DialogDescription>
                  Record new meter readings for equipment billing calculations
                </DialogDescription>
              </DialogHeader>
              <Form {...meterForm}>
                <form onSubmit={meterForm.handleSubmit(handleCreateMeterReading)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={meterForm.control}
                      name="equipmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select equipment" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {equipment?.map((eq) => (
                                <SelectItem key={eq.id} value={eq.id}>
                                  {eq.manufacturer} {eq.model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={meterForm.control}
                      name="contractId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select contract" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {contracts?.map((contract) => (
                                <SelectItem key={contract.id} value={contract.id}>
                                  {contract.contractNumber}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={meterForm.control}
                    name="readingDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reading Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={meterForm.control}
                      name="blackMeter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Black & White Meter</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={meterForm.control}
                      name="colorMeter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Meter</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={meterForm.control}
                    name="collectionMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select collection method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manual">Manual Entry</SelectItem>
                            <SelectItem value="email">Email Collection</SelectItem>
                            <SelectItem value="dca">DCA Integration</SelectItem>
                            <SelectItem value="api">API Collection</SelectItem>
                            <SelectItem value="remote_monitoring">Remote Monitoring</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={meterForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateReadingDialogOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMeterReadingMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {createMeterReadingMutation.isPending ? 'Creating...' : 'Create Reading'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            onClick={() => generateInvoicesMutation.mutate()}
            className="w-full sm:w-auto"
            disabled={generateInvoicesMutation.isPending}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {generateInvoicesMutation.isPending ? 'Generating...' : 'Generate Invoices'}
          </Button>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="readings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto sm:h-10">
            <TabsTrigger value="readings" className="text-xs sm:text-sm">Meter Readings</TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs sm:text-sm">Contract Management</TabsTrigger>
            <TabsTrigger value="profitability" className="text-xs sm:text-sm">Profitability Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="readings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Meter Readings</CardTitle>
                <CardDescription>
                  Track equipment usage and billing calculations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {meterReadings?.slice(0, 10).map((reading) => (
                    <div key={reading.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{getEquipmentName(reading.equipmentId)}</p>
                          {getCollectionMethodBadge(reading.collectionMethod)}
                          {getBillingStatusBadge(reading.billingStatus)}
                        </div>
                        <p className="text-sm text-gray-600">
                          Contract: {getContractNumber(reading.contractId)} | 
                          Date: {format(new Date(reading.readingDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          B&W: {reading.blackCopies?.toLocaleString()} copies
                        </p>
                        <p className="text-sm text-gray-600">
                          Color: {reading.colorCopies?.toLocaleString()} copies
                        </p>
                        {reading.billingAmount && (
                          <p className="text-sm font-medium text-green-600">
                            ${parseFloat(reading.billingAmount.toString()).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Overview</CardTitle>
                <CardDescription>
                  Manage billing contracts and pricing structures
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contracts?.map((contract) => (
                    <div key={contract.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-medium">{contract.contractNumber}</h3>
                          <p className="text-sm text-gray-600">
                            {format(new Date(contract.startDate), 'MMM dd, yyyy')} - 
                            {format(new Date(contract.endDate), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <Badge variant={contract.status === 'active' ? 'default' : 'secondary'}>
                          {contract.status?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-gray-600">B&W Rate</p>
                          <p className="font-medium">${contract.blackRate || '0.0000'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Color Rate</p>
                          <p className="font-medium">${contract.colorRate || '0.0000'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Monthly Base</p>
                          <p className="font-medium">${contract.monthlyBase || '0.00'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profitability" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Profitability Analysis</CardTitle>
                <CardDescription>
                  Analyze contract performance and profitability metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Revenue by Contract</h4>
                    {contracts?.map((contract) => {
                      const contractInvoices = invoices?.filter(inv => inv.contractId === contract.id) || [];
                      const totalRevenue = contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0);
                      const equipmentCost = parseFloat(contract.equipmentCost?.toString() || '0');
                      const margin = equipmentCost > 0 ? ((totalRevenue - equipmentCost) / totalRevenue * 100) : 0;
                      
                      return (
                        <div key={contract.id} className="p-3 border rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{contract.contractNumber}</span>
                            <span className="text-green-600">${totalRevenue.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600 mt-1">
                            <span>Margin: {margin.toFixed(1)}%</span>
                            <span>{contractInvoices.length} invoices</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Collection Method Performance</h4>
                    {['manual', 'email', 'dca', 'api'].map(method => {
                      const methodReadings = meterReadings?.filter(r => r.collectionMethod === method) || [];
                      const successRate = methodReadings.length > 0 
                        ? (methodReadings.filter(r => r.billingStatus !== 'pending').length / methodReadings.length * 100) 
                        : 0;
                      
                      return (
                        <div key={method} className="p-3 border rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{method.replace('_', ' ').toUpperCase()}</span>
                            <span>{successRate.toFixed(1)}%</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {methodReadings.length} readings
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}