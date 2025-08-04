import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Smartphone, MapPin, Clock, CheckCircle, AlertTriangle, Phone, Camera, Navigation, Package, Star, Wrench, Play, Pause, Square, FileText, User, Route } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface Job {
  id: string;
  priority: string;
  status: string;
  customerName: string;
  contactPerson: string;
  contactPhone: string;
  address: string;
  coordinates: { lat: number; lng: number };
  equipment: {
    model: string;
    serialNumber: string;
    location: string;
  };
  serviceType: string;
  issueDescription: string;
  estimatedDuration: number;
  scheduledTime: Date;
  requiredParts: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    available: boolean;
  }>;
  customerNotes: string;
  internalNotes: string;
  routeOptimization: {
    driveTime: number;
    distanceFromPrevious: number;
    trafficConditions: string;
    parkingNotes: string;
  };
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'assigned': return 'bg-blue-100 text-blue-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'parts_needed': return 'bg-orange-100 text-orange-800';
    case 'escalated': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getTrafficColor = (condition: string) => {
  switch (condition) {
    case 'light': return 'text-green-600';
    case 'moderate': return 'text-yellow-600';
    case 'heavy': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

export default function MobileServiceApp() {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTimer) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Get geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  }, []);

  // Fetch mobile dashboard
  const { data: mobileData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/mobile/dashboard'],
    select: (data: any) => ({
      ...data,
      jobsQueue: data.jobsQueue?.map((job: any) => ({
        ...job,
        scheduledTime: new Date(job.scheduledTime)
      })) || []
    }),
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });

  // Fetch route optimization
  const { data: routeData } = useQuery({
    queryKey: ['/api/mobile/route-optimization']
  });

  // Update job status mutation
  const updateJobMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/mobile/jobs/${data.jobId}/status`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mobile/dashboard'] });
      toast({
        title: "Job Updated",
        description: "Job status has been updated successfully.",
      });
    }
  });

  // Submit service report mutation
  const submitReportMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/mobile/service-report', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mobile/dashboard'] });
      toast({
        title: "Report Submitted",
        description: "Service report has been submitted successfully.",
      });
    }
  });

  const handleStatusUpdate = (jobId: string, status: string, notes: string = '') => {
    updateJobMutation.mutate({
      jobId,
      status,
      notes,
      location: currentLocation,
      timeSpent: activeTimer === jobId ? elapsedTime : 0
    });
  };

  const startTimer = (jobId: string) => {
    setActiveTimer(jobId);
    setElapsedTime(0);
    handleStatusUpdate(jobId, 'in_progress', 'Work started');
  };

  const stopTimer = () => {
    setActiveTimer(null);
    setElapsedTime(0);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (dashboardLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading mobile service app...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="h-6 w-6" />
            Mobile Service App
          </h1>
          <p className="text-gray-600 mt-1">Field technician dashboard and job management</p>
        </div>
        
        {activeTimer && (
          <div className="bg-green-100 px-4 py-2 rounded-lg">
            <div className="text-sm text-green-800">Active Job Timer</div>
            <div className="text-lg font-bold text-green-900">{formatTime(elapsedTime)}</div>
          </div>
        )}
      </div>

      {/* Technician Summary */}
      {mobileData && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">{mobileData.technician.name}</h3>
                  <div className="text-sm text-gray-600">{mobileData.technician.certification}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium">{mobileData.technician.rating}</span>
                    <span className="text-sm text-gray-500">
                      ({mobileData.technician.completedJobs} jobs)
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  ${mobileData.todaysSummary.totalRevenue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Today's Revenue</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {mobileData.todaysSummary.assignedJobs}
                </div>
                <div className="text-sm text-gray-600">Assigned</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">
                  {mobileData.todaysSummary.completedJobs}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-yellow-600">
                  {mobileData.todaysSummary.inProgress}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">
                  {mobileData.todaysSummary.pendingParts}
                </div>
                <div className="text-sm text-gray-600">Pending Parts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="jobs" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="jobs">Today's Jobs</TabsTrigger>
          <TabsTrigger value="route">Route</TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          {mobileData && mobileData.jobsQueue.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Assigned</h3>
                <p className="text-gray-600">Check back later for new service assignments.</p>
              </CardContent>
            </Card>
          ) : (
            mobileData?.jobsQueue.map((job: Job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getPriorityColor(job.priority)}>
                          {job.priority}
                        </Badge>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {format(job.scheduledTime, 'HH:mm')}
                        </span>
                      </div>
                      
                      <h4 className="font-medium text-lg">{job.customerName}</h4>
                      <div className="text-sm text-gray-600 mb-2">
                        {job.equipment.model} - {job.equipment.location}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.address}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {job.estimatedDuration}min
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-700 mb-3">
                        {job.issueDescription}
                      </div>
                      
                      {/* Route Info */}
                      <div className="bg-gray-50 rounded p-2 text-sm">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Navigation className="h-4 w-4 text-blue-600" />
                            <span>{job.routeOptimization.driveTime}min drive</span>
                            <span className="text-gray-500">•</span>
                            <span>{job.routeOptimization.distanceFromPrevious.toFixed(1)} miles</span>
                          </div>
                          <div className={`font-medium ${getTrafficColor(job.routeOptimization.trafficConditions)}`}>
                            {job.routeOptimization.trafficConditions} traffic
                          </div>
                        </div>
                        <div className="text-gray-600 mt-1">
                          Parking: {job.routeOptimization.parkingNotes}
                        </div>
                      </div>
                      
                      {/* Required Parts */}
                      {job.requiredParts.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-gray-700 mb-1">Required Parts:</div>
                          <div className="space-y-1">
                            {job.requiredParts.map((part, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">
                                  {part.description} (x{part.quantity})
                                </span>
                                <Badge className={part.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                  {part.available ? 'Available' : 'Not Available'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right ml-4">
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`tel:${job.contactPhone}`, '_self')}
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          Call
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(
                            `https://maps.google.com/?q=${job.coordinates.lat},${job.coordinates.lng}`,
                            '_blank'
                          )}
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Navigate
                        </Button>
                        
                        {job.status === 'assigned' && (
                          <Button
                            size="sm"
                            onClick={() => startTimer(job.id)}
                            disabled={!!activeTimer}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Start Job
                          </Button>
                        )}
                        
                        {job.status === 'in_progress' && activeTimer === job.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              stopTimer();
                              handleStatusUpdate(job.id, 'completed', 'Job completed successfully');
                            }}
                          >
                            <Square className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Additional Action Buttons */}
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedJob(job.id)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    
                    {job.status === 'in_progress' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusUpdate(job.id, 'parts_needed', 'Additional parts required')}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Need Parts
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusUpdate(job.id, 'escalated', 'Technical assistance required')}
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Escalate
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="route" className="space-y-6">
          {routeData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  Optimized Route
                </CardTitle>
                <CardDescription>Today's route optimized for efficiency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {routeData.optimizedRoute.totalDistance} mi
                      </div>
                      <div className="text-sm text-blue-700">Total Distance</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {Math.floor(routeData.optimizedRoute.totalDriveTime / 60)}h {routeData.optimizedRoute.totalDriveTime % 60}m
                      </div>
                      <div className="text-sm text-blue-700">Drive Time</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {Math.floor(routeData.optimizedRoute.totalServiceTime / 60)}h {routeData.optimizedRoute.totalServiceTime % 60}m
                      </div>
                      <div className="text-sm text-blue-700">Service Time</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        ${routeData.optimizedRoute.fuelCost.toFixed(2)}
                      </div>
                      <div className="text-sm text-blue-700">Fuel Cost</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {routeData.optimizedRoute.stops.map((stop: any, idx: number) => (
                    <div key={stop.jobId} className="border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center font-bold text-sm">
                          {stop.sequence}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{stop.customerName}</div>
                          <div className="text-sm text-gray-600">{stop.address}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-medium">
                            {format(new Date(stop.estimatedArrival), 'HH:mm')}
                          </div>
                          <div className="text-gray-600">{stop.serviceTime}min service</div>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Drive: {stop.drivingTime}min</span>
                          <span>Window: {stop.serviceWindow.start} - {stop.serviceWindow.end}</span>
                        </div>
                        <div className="mt-1">Parking: {stop.parkingInfo}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="parts" className="space-y-6">
          {mobileData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Parts Inventory
                </CardTitle>
                <CardDescription>Van stock and parts status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-800">
                      {mobileData.partsInventory.vanStock.tonerCartridges}
                    </div>
                    <div className="text-sm text-gray-600">Toner Cartridges</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-800">
                      {mobileData.partsInventory.vanStock.maintenanceKits}
                    </div>
                    <div className="text-sm text-gray-600">Maintenance Kits</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-800">
                      {mobileData.partsInventory.vanStock.paperFeedRollers}
                    </div>
                    <div className="text-sm text-gray-600">Feed Rollers</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-800">
                      {mobileData.partsInventory.vanStock.fuserUnits}
                    </div>
                    <div className="text-sm text-gray-600">Fuser Units</div>
                  </div>
                </div>
                
                {mobileData.partsInventory.criticalLowItems.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">Critical Low Stock</span>
                    </div>
                    <div className="space-y-1">
                      {mobileData.partsInventory.criticalLowItems.map((item: string, idx: number) => (
                        <div key={idx} className="text-sm text-red-700">
                          • {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
                  <span>Last Restocked: {format(new Date(mobileData.partsInventory.lastRestocked), 'MMM dd, yyyy')}</span>
                  <span>Pending Orders: {mobileData.partsInventory.pendingOrders}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
              <CardDescription>Your performance this week and month</CardDescription>
            </CardHeader>
            <CardContent>
              {mobileData && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">This Week</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">
                          {mobileData.performanceMetrics.thisWeek.jobsCompleted}
                        </div>
                        <div className="text-sm text-gray-600">Jobs Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">
                          {mobileData.performanceMetrics.thisWeek.averageJobTime}min
                        </div>
                        <div className="text-sm text-gray-600">Avg Job Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-yellow-600">
                          {mobileData.performanceMetrics.thisWeek.customerSatisfaction}
                        </div>
                        <div className="text-sm text-gray-600">Satisfaction</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-purple-600">
                          {mobileData.performanceMetrics.thisWeek.firstTimeFixRate}%
                        </div>
                        <div className="text-sm text-gray-600">First Fix Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-indigo-600">
                          {mobileData.performanceMetrics.thisWeek.onTimeArrival}%
                        </div>
                        <div className="text-sm text-gray-600">On Time</div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">This Month</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">
                          {mobileData.performanceMetrics.thisMonth.jobsCompleted}
                        </div>
                        <div className="text-sm text-gray-600">Jobs Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">
                          ${mobileData.performanceMetrics.thisMonth.revenue.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Revenue</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-orange-600">
                          {mobileData.performanceMetrics.thisMonth.partsUsed}
                        </div>
                        <div className="text-sm text-gray-600">Parts Used</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-gray-600">
                          {mobileData.performanceMetrics.thisMonth.milesdriven.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Miles Driven</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}