import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calculator, Calendar, Activity } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMeterReadingSchema } from "@shared/schema";
import type { MeterReading, Equipment, Contract } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const createMeterReadingSchema = insertMeterReadingSchema.extend({
  readingDate: z.string(),
});

type CreateMeterReadingInput = z.infer<typeof createMeterReadingSchema>;

export default function MeterReadings() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: meterReadings, isLoading: isLoadingReadings } = useQuery<MeterReading[]>({
    queryKey: ["/api/meter-readings"],
  });

  const { data: equipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const form = useForm<CreateMeterReadingInput>({
    resolver: zodResolver(createMeterReadingSchema),
    defaultValues: {
      readingDate: new Date().toISOString().split('T')[0],
      blackMeter: 0,
      colorMeter: 0,
      collectionMethod: 'manual',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateMeterReadingInput) => {
      const response = await fetch('/api/meter-readings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          readingDate: new Date(data.readingDate),
          blackMeter: parseInt((data.blackMeter || 0).toString()),
          colorMeter: parseInt((data.colorMeter || 0).toString()),
        }),
      });
      if (!response.ok) throw new Error('Failed to create meter reading');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meter-readings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
  });

  const handleSubmit = (data: CreateMeterReadingInput) => {
    createMutation.mutate(data);
  };

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
      manual: 'default',
      email: 'secondary',
      dca: 'outline',
    } as const;
    
    return (
      <Badge variant={variants[method as keyof typeof variants] || 'default'}>
        {method.toUpperCase()}
      </Badge>
    );
  };

  if (isLoadingReadings) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Meter Readings</h1>
            <p className="text-gray-600">Manage equipment meter readings and calculate billing</p>
          </div>
        </div>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Meter Readings</h1>
          <p className="text-gray-600">Manage equipment meter readings and calculate billing</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Reading
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Meter Reading</DialogTitle>
              <DialogDescription>
                Record new meter readings for equipment billing calculations
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
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
                  control={form.control}
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="blackMeter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Black & White Meter</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="colorMeter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color Meter</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="collectionMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collection Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manual">Manual Entry</SelectItem>
                          <SelectItem value="email">Email Collection</SelectItem>
                          <SelectItem value="dca">DCA Integration</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Additional notes about this reading..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Reading"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {meterReadings?.map((reading) => (
          <Card key={reading.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {getEquipmentName(reading.equipmentId)}
                  </CardTitle>
                  <CardDescription>
                    Contract: {getContractNumber(reading.contractId)} • 
                    Reading Date: {format(new Date(reading.readingDate), 'MMM dd, yyyy')}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {getCollectionMethodBadge(reading.collectionMethod)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Black & White</p>
                    <p className="font-semibold">{reading.blackMeter.toLocaleString()}</p>
                    {(reading.blackCopies || 0) > 0 && (
                      <p className="text-xs text-green-600">+{(reading.blackCopies || 0).toLocaleString()} copies</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Color</p>
                    <p className="font-semibold">{reading.colorMeter.toLocaleString()}</p>
                    {(reading.colorCopies || 0) > 0 && (
                      <p className="text-xs text-blue-600">+{(reading.colorCopies || 0).toLocaleString()} copies</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-semibold">{format(new Date(reading.createdAt || new Date()), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm">
                    <Calculator className="w-4 h-4 mr-2" />
                    Calculate Billing
                  </Button>
                </div>
              </div>
              {reading.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">{reading.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {meterReadings?.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No meter readings yet</h3>
              <p className="text-gray-600 mb-4">Start by adding your first meter reading to track equipment usage and generate accurate billing.</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Reading
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}