import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, Users, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { demoSchedulingSchema } from '@/lib/validation';

interface DemoSchedule {
  id: string;
  businessRecordId: string;
  customerName: string;
  contactPerson: string;
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  demoType: string;
  equipmentModels: string[];
  demoLocation: string;
  assignedSalesRep: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  preparationCompleted: boolean;
  demoObjectives?: string;
  proposalAmount?: number;
  createdAt: Date;
}

interface Customer {
  id: string;
  companyName: string;
  primaryContactName: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled': return 'bg-blue-100 text-blue-800';
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getConfirmationColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'declined': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function DemoScheduling() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({
    defaultValues: {
      businessRecordId: '',
      demoType: '',
      scheduledDate: '',
      scheduledTime: '',
      duration: 60,
      equipmentModels: '',
      demoLocation: '',
      assignedSalesRep: '',
      demoObjectives: '',
      proposalAmount: 0,
    }
  });



  // Fetch demo schedules
  const { data: demos = [], isLoading } = useQuery({
    queryKey: ['/api/demos'],
    select: (data: any[]) => data.map(demo => ({
      ...demo,
      scheduledDate: new Date(demo.scheduledDate),
      createdAt: new Date(demo.createdAt)
    }))
  });

  // Fetch customers for dropdown
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/demos/customers']
  });

  // Create demo mutation
  const createDemoMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/demos', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demos'] });
      setIsCreateDialogOpen(false);
      reset();
      toast({
        title: "Demo Scheduled",
        description: "The equipment demonstration has been scheduled successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to schedule demo. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update demo status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, confirmationStatus }: any) => 
      apiRequest(`/api/demos/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, confirmationStatus })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demos'] });
      toast({
        title: "Status Updated",
        description: "Demo status has been updated successfully.",
      });
    }
  });

  const onSubmit = (data: any) => {
    createDemoMutation.mutate({
      ...data,
      equipmentModels: data.equipmentModels ? data.equipmentModels.split(',').map((m: string) => m.trim()) : [],
      proposalAmount: data.proposalAmount ? parseFloat(data.proposalAmount) : null,
      duration: parseInt(data.duration) || 60
    });
  };

  const handleStatusChange = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status, confirmationStatus: status === 'confirmed' ? 'confirmed' : 'pending' });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading demo schedules...</p>
          </div>
        </div>
      </div>
    );
  }

  const upcomingDemos = demos.filter(demo => 
    new Date(demo.scheduledDate) >= new Date() && demo.status !== 'cancelled'
  );
  const pastDemos = demos.filter(demo => 
    new Date(demo.scheduledDate) < new Date() || demo.status === 'completed'
  );

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Demo Scheduling</h1>
          <p className="text-gray-600 mt-2">Manage equipment demonstrations and customer meetings</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Schedule Demo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Equipment Demo</DialogTitle>
              <DialogDescription>
                Create a new equipment demonstration appointment with a customer.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessRecordId">Customer</Label>
                  <Select onValueChange={(value) => setValue('businessRecordId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="demoType">Demo Type</Label>
                  <Select onValueChange={(value) => setValue('demoType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equipment">Equipment Demo</SelectItem>
                      <SelectItem value="presentation">Presentation</SelectItem>
                      <SelectItem value="trial">Trial Period</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Date</Label>
                  <Input
                    type="date"
                    {...register('scheduledDate', { required: true })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="scheduledTime">Time</Label>
                  <Input
                    type="time"
                    {...register('scheduledTime', { required: true })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    type="number"
                    placeholder="60"
                    {...register('duration')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipmentModels">Equipment Models</Label>
                <Input
                  placeholder="Canon imageRUNNER ADVANCE C3330i, Xerox VersaLink C7000"
                  {...register('equipmentModels')}
                />
                <p className="text-sm text-gray-500">Separate multiple models with commas</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="demoLocation">Location</Label>
                <Select onValueChange={(value) => setValue('demoLocation', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer_site">Customer Site</SelectItem>
                    <SelectItem value="dealer_showroom">Dealer Showroom</SelectItem>
                    <SelectItem value="virtual">Virtual Demo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="proposalAmount">Expected Deal Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="15000.00"
                    {...register('proposalAmount')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="demoAddress">Address (if on-site)</Label>
                  <Input
                    placeholder="123 Main St, City, State 12345"
                    {...register('demoAddress')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="demoObjectives">Demo Objectives</Label>
                <Textarea
                  placeholder="What do you want to achieve in this demo? Key features to highlight, customer pain points to address..."
                  {...register('demoObjectives')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerRequirements">Customer Requirements</Label>
                <Textarea
                  placeholder="Special requirements, focus areas, specific features the customer is interested in..."
                  {...register('customerRequirements')}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDemoMutation.isPending}>
                  {createDemoMutation.isPending ? 'Scheduling...' : 'Schedule Demo'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming Demos ({upcomingDemos.length})</TabsTrigger>
          <TabsTrigger value="past">Past Demos ({pastDemos.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingDemos.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Demos</h3>
                <p className="text-gray-600 mb-4">Schedule your first equipment demonstration to get started.</p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Demo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingDemos.map((demo) => (
                <Card key={demo.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{demo.customerName}</CardTitle>
                        <CardDescription>{demo.contactPerson}</CardDescription>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge className={getStatusColor(demo.status)}>
                          {demo.status}
                        </Badge>
                        <Badge className={getConfirmationColor(demo.confirmationStatus)}>
                          {demo.confirmationStatus}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {format(demo.scheduledDate, 'PPP')}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      {demo.scheduledTime} ({demo.duration} min)
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {demo.demoLocation.replace('_', ' ')}
                    </div>

                    {demo.equipmentModels.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Equipment:</p>
                        <div className="flex flex-wrap gap-1">
                          {demo.equipmentModels.map((model, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {model}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {demo.proposalAmount && (
                      <div className="text-sm">
                        <span className="font-medium">Expected Value: </span>
                        ${demo.proposalAmount.toLocaleString()}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {demo.preparationCompleted ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="text-sm text-gray-600">
                        Preparation {demo.preparationCompleted ? 'Complete' : 'Pending'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {demo.status === 'scheduled' && (
                        <Button 
                          size="sm" 
                          onClick={() => handleStatusChange(demo.id, 'confirmed')}
                          disabled={updateStatusMutation.isPending}
                        >
                          Confirm
                        </Button>
                      )}
                      {demo.status === 'confirmed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleStatusChange(demo.id, 'in_progress')}
                          disabled={updateStatusMutation.isPending}
                        >
                          Start Demo
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {pastDemos.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Past Demos</h3>
                <p className="text-gray-600">Completed demonstrations will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pastDemos.map((demo) => (
                <Card key={demo.id}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{demo.customerName}</h3>
                        <p className="text-sm text-gray-600">
                          {format(demo.scheduledDate, 'PPP')} at {demo.scheduledTime}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={getStatusColor(demo.status)}>
                          {demo.status}
                        </Badge>
                        <Button size="sm" variant="outline">
                          View Results
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Calendar View</h3>
              <p className="text-gray-600">Calendar integration will be available in the next update.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}