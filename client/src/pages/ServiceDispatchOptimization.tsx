import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  Navigation, MapPin, Clock, User, Route, TrendingUp, Zap, 
  Settings, Bell, Calendar, Smartphone, Users, AlertTriangle,
  CheckCircle, ChevronRight, Filter, Search, Eye, Play,
  Pause, MoreHorizontal, Target, Timer, Activity, Phone
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format, addMinutes, isAfter, isBefore } from "date-fns";
import { MobileFAB } from "@/components/ui/mobile-fab";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";

// Types
interface DispatchMetrics {
  totalTechnicians: number;
  activeTechnicians: number;
  averageResponseTime: number;
  routeOptimizationSavings: number;
  customerSatisfactionScore: number;
  firstCallResolutionRate: number;
  dailyJobsCompleted: number;
  milesDrivenToday: number;
}

interface TechnicianLocation {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'en_route' | 'offline';
  currentLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  nextAppointment?: {
    time: string;
    customerName: string;
    address: string;
    estimatedTravelTime: number;
  };
  performanceToday: {
    jobsCompleted: number;
    milesdriven: number;
    customerRating: number;
    onTimePercentage: number;
  };
  skills: string[];
  workload: 'light' | 'moderate' | 'heavy';
}

interface ServiceRoute {
  id: string;
  technicianId: string;
  technicianName: string;
  totalJobs: number;
  completedJobs: number;
  estimatedCompletionTime: string;
  totalMiles: number;
  optimizationScore: number;
  jobs: RouteJob[];
  actualRoute?: {
    travelTime: number;
    distance: number;
    trafficConditions: 'light' | 'moderate' | 'heavy';
  };
}

interface RouteJob {
  id: string;
  customerName: string;
  address: string;
  serviceType: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration: number;
  scheduledTime: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'delayed';
  gpsCoordinates: {
    lat: number;
    lng: number;
  };
  customerContactInfo: {
    phone: string;
    email: string;
  };
  specialInstructions?: string;
}

interface DispatchAlert {
  id: string;
  type: 'traffic' | 'delay' | 'emergency' | 'route_optimization' | 'technician_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  technicianId?: string;
  customerId?: string;
  timestamp: string;
  actionRequired: boolean;
  suggestedAction?: string;
}

export default function ServiceDispatchOptimization() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTechnician, setSelectedTechnician] = useState<string>("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("today");
  const [routeOptimizationEnabled, setRouteOptimizationEnabled] = useState(true);
  const [realTimeTrackingEnabled, setRealTimeTrackingEnabled] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Mock data - in real implementation, these would come from APIs
  const mockMetrics: DispatchMetrics = {
    totalTechnicians: 12,
    activeTechnicians: 8,
    averageResponseTime: 45, // minutes
    routeOptimizationSavings: 23, // percentage
    customerSatisfactionScore: 4.6,
    firstCallResolutionRate: 87, // percentage
    dailyJobsCompleted: 34,
    milesDrivenToday: 456
  };

  const mockTechnicians: TechnicianLocation[] = [
    {
      id: "tech-001",
      name: "Mike Johnson",
      status: "busy",
      currentLocation: {
        lat: 40.7128,
        lng: -74.0060,
        address: "Downtown Manhattan, NY"
      },
      nextAppointment: {
        time: "14:30",
        customerName: "TechCorp Solutions",
        address: "45 Broadway, New York, NY",
        estimatedTravelTime: 12
      },
      performanceToday: {
        jobsCompleted: 4,
        milesdriven: 67,
        customerRating: 4.8,
        onTimePercentage: 100
      },
      skills: ["Printer Repair", "Network Setup", "Installation"],
      workload: "moderate"
    },
    {
      id: "tech-002", 
      name: "Sarah Chen",
      status: "available",
      currentLocation: {
        lat: 40.7589,
        lng: -73.9851,
        address: "Midtown Manhattan, NY"
      },
      performanceToday: {
        jobsCompleted: 3,
        milesdriven: 45,
        customerRating: 4.9,
        onTimePercentage: 95
      },
      skills: ["Copier Maintenance", "Troubleshooting", "Training"],
      workload: "light"
    },
    {
      id: "tech-003",
      name: "David Rodriguez", 
      status: "en_route",
      currentLocation: {
        lat: 40.6892,
        lng: -74.0445,
        address: "Brooklyn Heights, NY"
      },
      nextAppointment: {
        time: "15:45",
        customerName: "Brooklyn Medical Center",
        address: "123 Atlantic Ave, Brooklyn, NY",
        estimatedTravelTime: 8
      },
      performanceToday: {
        jobsCompleted: 5,
        milesdriven: 89,
        customerRating: 4.7,
        onTimePercentage: 90
      },
      skills: ["Medical Equipment", "Emergency Repair", "Maintenance"],
      workload: "heavy"
    }
  ];

  const mockRoutes: ServiceRoute[] = [
    {
      id: "route-001",
      technicianId: "tech-001",
      technicianName: "Mike Johnson",
      totalJobs: 6,
      completedJobs: 4,
      estimatedCompletionTime: "17:30",
      totalMiles: 67,
      optimizationScore: 94,
      jobs: [
        {
          id: "job-001",
          customerName: "TechCorp Solutions",
          address: "45 Broadway, New York, NY",
          serviceType: "Printer Installation",
          priority: "high",
          estimatedDuration: 90,
          scheduledTime: "14:30",
          status: "scheduled",
          gpsCoordinates: { lat: 40.7128, lng: -74.0060 },
          customerContactInfo: { phone: "(555) 123-4567", email: "tech@techcorp.com" }
        },
        {
          id: "job-002", 
          customerName: "Financial District Office",
          address: "88 Pine St, New York, NY",
          serviceType: "Maintenance",
          priority: "medium",
          estimatedDuration: 60,
          scheduledTime: "16:00",
          status: "scheduled",
          gpsCoordinates: { lat: 40.7074, lng: -74.0113 },
          customerContactInfo: { phone: "(555) 987-6543", email: "admin@fdoffice.com" }
        }
      ],
      actualRoute: {
        travelTime: 89,
        distance: 67,
        trafficConditions: "moderate"
      }
    }
  ];

  const mockAlerts: DispatchAlert[] = [
    {
      id: "alert-001",
      type: "traffic",
      severity: "medium",
      title: "Traffic Delay Expected",
      message: "Heavy traffic on I-95 may delay Mike Johnson's 3:30 PM appointment by 15 minutes",
      technicianId: "tech-001",
      timestamp: new Date().toISOString(),
      actionRequired: true,
      suggestedAction: "Contact customer to adjust appointment time"
    },
    {
      id: "alert-002",
      type: "route_optimization",
      severity: "low", 
      title: "Route Optimization Available",
      message: "Reordering Sarah Chen's afternoon schedule could save 23 minutes of travel time",
      technicianId: "tech-002",
      timestamp: new Date().toISOString(),
      actionRequired: false,
      suggestedAction: "Apply optimized route"
    },
    {
      id: "alert-003",
      type: "emergency",
      severity: "high",
      title: "Emergency Service Request",
      message: "Urgent copier repair needed at Brooklyn Medical Center - Patient records system down",
      timestamp: new Date().toISOString(),
      actionRequired: true,
      suggestedAction: "Assign nearest technician immediately"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'default';
      case 'busy': return 'secondary';  
      case 'en_route': return 'outline';
      case 'offline': return 'destructive';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'low': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getWorkloadColor = (workload: string) => {
    switch (workload) {
      case 'heavy': return 'text-red-600';
      case 'moderate': return 'text-yellow-600';
      case 'light': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Service Dispatch Optimization</h1>
            <p className="text-gray-600 mt-1">AI-powered route optimization and real-time technician tracking</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-dispatch-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Badge variant="outline" className="px-3 py-2">
              <Activity className="h-4 w-4 mr-2" />
              Live Tracking: {realTimeTrackingEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Contextual Help */}
        <ContextualHelp page="service-dispatch-optimization" />

        {/* Page Alerts */}
        <PageAlerts 
          alerts={mockAlerts.filter(alert => alert.actionRequired).map(alert => ({
            id: alert.id,
            type: alert.severity === 'critical' || alert.severity === 'high' ? 'error' : 'warning',
            title: alert.title,
            message: alert.message,
            action: alert.suggestedAction ? {
              label: "Take Action",
              onClick: () => console.log(`Taking action for alert ${alert.id}`)
            } : undefined
          }))}
        />

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Technicians</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-active-technicians">
                {mockMetrics.activeTechnicians}/{mockMetrics.totalTechnicians}
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((mockMetrics.activeTechnicians / mockMetrics.totalTechnicians) * 100)}% capacity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-response-time">
                {mockMetrics.averageResponseTime}m
              </div>
              <p className="text-xs text-muted-foreground">
                12% better than industry avg
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Route Optimization</CardTitle>
              <Route className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-route-savings">
                {mockMetrics.routeOptimizationSavings}%
              </div>
              <p className="text-xs text-muted-foreground">
                Time savings vs manual routing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="metric-satisfaction">
                {mockMetrics.customerSatisfactionScore}/5.0
              </div>
              <p className="text-xs text-muted-foreground">
                {mockMetrics.firstCallResolutionRate}% first-call resolution
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="live-map">Live Map</TabsTrigger>
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="technicians">Technicians</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Real-time Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-orange-600" />
                    Real-time Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockAlerts.slice(0, 4).map((alert) => (
                      <div 
                        key={alert.id} 
                        className={`p-3 rounded-lg border ${getAlertSeverityColor(alert.severity)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{alert.title}</p>
                            <p className="text-xs mt-1 opacity-90">{alert.message}</p>
                            <p className="text-xs mt-2 opacity-75">
                              {format(new Date(alert.timestamp), 'HH:mm')}
                            </p>
                          </div>
                          {alert.actionRequired && (
                            <Button size="sm" variant="outline" className="ml-2">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Today's Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Today's Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Jobs Completed</span>
                      <span className="font-bold text-green-600">{mockMetrics.dailyJobsCompleted}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Miles Driven</span>
                      <span className="font-bold">{mockMetrics.milesDrivenToday}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Route Efficiency</span>
                      <Badge variant="outline" className="text-blue-600">
                        {mockMetrics.routeOptimizationSavings}% optimized
                      </Badge>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>First Call Resolution</span>
                        <span>{mockMetrics.firstCallResolutionRate}%</span>
                      </div>
                      <Progress value={mockMetrics.firstCallResolutionRate} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Technician Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Technician Status Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {mockTechnicians.map((technician) => (
                    <div key={technician.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium" data-testid={`technician-name-${technician.id}`}>
                          {technician.name}
                        </h3>
                        <Badge variant={getStatusColor(technician.status)}>
                          {technician.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600">{technician.currentLocation.address}</span>
                        </div>
                        
                        {technician.nextAppointment && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600">
                              Next: {technician.nextAppointment.time} - {technician.nextAppointment.customerName}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between mt-3 pt-2 border-t">
                          <div className="text-center">
                            <p className="font-medium">{technician.performanceToday.jobsCompleted}</p>
                            <p className="text-xs text-gray-600">Jobs</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">{technician.performanceToday.customerRating}</p>
                            <p className="text-xs text-gray-600">Rating</p>
                          </div>
                          <div className="text-center">
                            <p className={`font-medium ${getWorkloadColor(technician.workload)}`}>
                              {technician.workload}
                            </p>
                            <p className="text-xs text-gray-600">Load</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live-map" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Live Technician Map
                </CardTitle>
                <CardDescription>
                  Real-time GPS tracking and route visualization (Map integration would go here)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 rounded-lg p-8 text-center min-h-[400px] flex items-center justify-center">
                  <div className="space-y-4">
                    <MapPin className="h-16 w-16 text-gray-400 mx-auto" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-600">Interactive Map View</h3>
                      <p className="text-gray-500 mt-2">
                        Google Maps integration would display:
                      </p>
                      <ul className="text-sm text-gray-500 mt-2 space-y-1">
                        <li>• Real-time technician locations</li>
                        <li>• Optimized route overlays</li>
                        <li>• Traffic conditions</li>
                        <li>• Customer locations</li>
                        <li>• Emergency service requests</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Map Controls */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch id="show-routes" defaultChecked />
                      <Label htmlFor="show-routes">Show Routes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="show-traffic" defaultChecked />
                      <Label htmlFor="show-traffic">Traffic Layer</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="auto-refresh" defaultChecked />
                      <Label htmlFor="auto-refresh">Auto Refresh (30s)</Label>
                    </div>
                  </div>
                  <Button variant="outline">
                    <Navigation className="h-4 w-4 mr-2" />
                    Recalculate All Routes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routes" className="space-y-6">
            {/* Route Filters */}
            <div className="flex items-center space-x-4">
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {mockTechnicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Route Cards */}
            <div className="space-y-4">
              {mockRoutes.map((route) => (
                <Card key={route.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Route className="h-5 w-5 text-blue-600" />
                        {route.technicianName}'s Route
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-green-600">
                          {route.optimizationScore}% optimized
                        </Badge>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View Map
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      {route.completedJobs}/{route.totalJobs} jobs completed • 
                      {route.totalMiles} miles • 
                      ETA: {route.estimatedCompletionTime}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {route.jobs.map((job, index) => (
                        <div 
                          key={job.id} 
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-medium">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{job.customerName}</p>
                              <p className="text-sm text-gray-600">{job.serviceType}</p>
                              <p className="text-xs text-gray-500">{job.address}</p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant={getPriorityColor(job.priority)}>
                              {job.priority}
                            </Badge>
                            <p className="text-sm font-medium">{job.scheduledTime}</p>
                            <p className="text-xs text-gray-600">
                              {formatDuration(job.estimatedDuration)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {route.actualRoute && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">Route Analytics</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-blue-600">Travel Time</p>
                            <p className="font-medium">{formatDuration(route.actualRoute.travelTime)}</p>
                          </div>
                          <div>
                            <p className="text-blue-600">Distance</p>
                            <p className="font-medium">{route.actualRoute.distance} miles</p>
                          </div>
                          <div>
                            <p className="text-blue-600">Traffic</p>
                            <p className="font-medium capitalize">{route.actualRoute.trafficConditions}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="technicians" className="space-y-6">
            {/* Technician Performance Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {mockTechnicians.map((technician) => (
                <Card key={technician.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{technician.name}</CardTitle>
                      <Badge variant={getStatusColor(technician.status)}>
                        {technician.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Performance Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">
                            {technician.performanceToday.jobsCompleted}
                          </p>
                          <p className="text-sm text-green-700">Jobs Today</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">
                            {technician.performanceToday.customerRating}
                          </p>
                          <p className="text-sm text-blue-700">Rating</p>
                        </div>
                      </div>

                      {/* Skills */}
                      <div>
                        <p className="text-sm font-medium mb-2">Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {technician.skills.map((skill, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Current Status */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{technician.currentLocation.address}</span>
                        </div>
                        
                        {technician.nextAppointment && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">
                              Next: {technician.nextAppointment.time} - {technician.nextAppointment.customerName}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Activity className={`h-4 w-4 ${getWorkloadColor(technician.workload)}`} />
                          <span className={`text-sm ${getWorkloadColor(technician.workload)}`}>
                            Workload: {technician.workload}
                          </span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Navigation className="h-4 w-4 mr-2" />
                          Track
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    AI Dispatch Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-2">Smart Route Optimization</h4>
                      <p className="text-sm text-purple-700 mb-3">
                        AI analysis suggests reordering routes could save an additional 18 minutes and 12 miles across all technicians today.
                      </p>
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                        Apply Optimization
                      </Button>
                    </div>
                    
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">Predictive Maintenance Alert</h4>
                      <p className="text-sm text-green-700 mb-3">
                        Based on service patterns, 3 customers are due for proactive equipment checks this week.
                      </p>
                      <Button size="sm" variant="outline">
                        Schedule Checks
                      </Button>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">Technician Performance</h4>
                      <p className="text-sm text-blue-700">
                        Sarah Chen consistently outperforms on customer satisfaction. Consider her for training new technicians.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Performance Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Response Time</span>
                        <span className="text-sm font-medium text-green-600">↓ 12% this week</span>
                      </div>
                      <Progress value={88} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Route Efficiency</span>
                        <span className="text-sm font-medium text-blue-600">↑ 23% this month</span>
                      </div>
                      <Progress value={94} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Customer Satisfaction</span>
                        <span className="text-sm font-medium text-purple-600">↑ 8% this quarter</span>
                      </div>
                      <Progress value={92} className="h-2" />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">Key Achievements</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Achieved 95% on-time arrival rate this month</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Reduced average travel time by 23%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Improved first-call resolution to 87%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Mobile Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <MobileFAB
            icon={Navigation}
            label="Quick Dispatch"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-2xl"
            onClick={() => setActiveTab('live-map')}
            data-testid="mobile-fab-dispatch"
          />
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dispatch Optimization Settings</DialogTitle>
              <DialogDescription>
                Configure AI-powered routing and tracking preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="route-optimization">Route Optimization</Label>
                    <p className="text-sm text-gray-600">Use AI to automatically optimize technician routes</p>
                  </div>
                  <Switch 
                    id="route-optimization"
                    checked={routeOptimizationEnabled}
                    onCheckedChange={setRouteOptimizationEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="real-time-tracking">Real-time Tracking</Label>
                    <p className="text-sm text-gray-600">Enable GPS tracking for all technicians</p>
                  </div>
                  <Switch 
                    id="real-time-tracking"
                    checked={realTimeTrackingEnabled}
                    onCheckedChange={setRealTimeTrackingEnabled}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsSettingsDialogOpen(false)}>
                  Save Settings
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}