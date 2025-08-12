import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { MapPin, Clock, User, Route, Zap, TrendingUp, Target, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { 
  type ServiceTicket, 
  type Technician,
  type ServiceSession
} from '@shared/schema';
import ContextualHelp from "@/components/contextual/ContextualHelp";

// Using ServiceTicket and Technician from schema
// DispatchRecommendation extends ServiceTicket with optimization data
interface DispatchRecommendation extends Omit<ServiceTicket, 'id'> {
  id: string;
  ticketId: string;
  recommendedTechnician: {
    id: string;
    name: string;
    currentLocation: string;
    distanceToCustomer: number;
    travelTime: number;
    skillMatch: number;
    availabilityScore: number;
    workloadScore: number;
    overallScore: number;
    reasons: string[];
  };
  alternatives: Array<{
    id: string;
    name: string;
    distanceToCustomer: number;
    travelTime: number;
    skillMatch: number;
    availabilityScore: number;
    workloadScore: number;
    overallScore: number;
  }>;
  suggestedTimeSlot: string;
  routeOptimization: {
    beforeThisCall?: {
      ticketId: string;
      customer: string;
      endTime: string;
    };
    afterThisCall?: {
      ticketId: string;
      customer: string;
      startTime: string;
    };
    totalTravelTime: number;
    fuelSavings: number;
  };
}

// TechnicianAvailability extends Technician with availability and performance data
interface TechnicianAvailability extends Technician {
  availability: {
    totalHours: number;
    bookedHours: number;
    availableHours: number;
    utilizationRate: number;
  };
  currentAssignments: Array<{
    ticketId: string;
    customer: string;
    startTime: string;
    endTime: string;
    status: string;
  }>;
  performance: {
    completionRate: number;
    averageCallTime: number;
    customerSatisfaction: number;
    onTimeArrival: number;
  };
  nextAvailableSlot: string;
  endOfDayAvailable: string;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available': return 'bg-green-100 text-green-800';
    case 'busy': return 'bg-red-100 text-red-800';
    case 'on_route': return 'bg-blue-100 text-blue-800';
    case 'on_site': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const PERFORMANCE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

export default function ServiceDispatchOptimization() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  // Fetch dispatch recommendations
  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery({
    queryKey: ['/api/dispatch/recommendations', selectedDate],
    queryFn: () => apiRequest(`/api/dispatch/recommendations?date=${selectedDate}`)
  });

  // Fetch technician availability
  const { data: technicians = [] } = useQuery<TechnicianAvailability[]>({
    queryKey: ['/api/dispatch/technicians/availability', selectedDate],
    queryFn: () => apiRequest(`/api/dispatch/technicians/availability?date=${selectedDate}`)
  });

  // Fetch dispatch analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/dispatch/analytics']
  });

  // Fetch real-time tracking
  const { data: tracking = [] } = useQuery({
    queryKey: ['/api/dispatch/tracking'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Auto-assign mutation
  const autoAssignMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/dispatch/auto-assign', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dispatch/recommendations'] });
      toast({
        title: "Auto-Assignment Complete",
        description: "Tickets have been optimally assigned to technicians.",
      });
    }
  });

  const handleAutoAssign = () => {
    const ticketIds = recommendations.map((rec: DispatchRecommendation) => rec.ticketId);
    autoAssignMutation.mutate({ 
      ticketIds,
      constraints: {
        maxTravelTime: 30,
        preferSkillMatch: true,
        balanceWorkload: true
      }
    });
  };

  if (recommendationsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dispatch data...</p>
          </div>
        </div>
      </div>
    );
  }

  const averageOptimizationScore = recommendations.length > 0 
    ? (recommendations.reduce((sum: number, rec: DispatchRecommendation) => sum + rec.recommendedTechnician.overallScore, 0) / recommendations.length).toFixed(1)
    : '0';

  const totalTravelSavings = recommendations.reduce((sum: number, rec: DispatchRecommendation) => sum + rec.routeOptimization.fuelSavings, 0);

  return (
    <MainLayout title="Service Dispatch Optimization" description="AI-powered technician assignment and route optimization">
      <div className="container mx-auto p-6">
      <div className="mb-4">
        <ContextualHelp page="service-dispatch" />
      </div>
      <div className="flex justify-end items-center mb-6">
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          />
          
          <Button 
            onClick={handleAutoAssign}
            disabled={autoAssignMutation.isPending || recommendations.length === 0}
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Auto-Assign All
          </Button>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.summary.averageResponseTime}h</div>
              <p className="text-xs text-muted-foreground">
                92.3% on-time arrivals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">First Call Resolution</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.summary.firstCallResolution}%</div>
              <p className="text-xs text-muted-foreground">
                {analytics.summary.completedTickets} of {analytics.summary.totalTickets} tickets
              </p>
              <Progress value={analytics.summary.firstCallResolution} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.summary.technicianUtilization}%</div>
              <p className="text-xs text-muted-foreground">
                Average across all technicians
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Route Savings</CardTitle>
              <Route className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics.efficiency.routeOptimizationSavings}</div>
              <p className="text-xs text-muted-foreground">
                This period from optimization
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="recommendations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="recommendations">Smart Recommendations</TabsTrigger>
          <TabsTrigger value="technicians">Technician Status</TabsTrigger>
          <TabsTrigger value="tracking">Real-time Tracking</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-6">
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Dispatch Recommendations</h3>
                <p className="text-gray-600 mb-4">All tickets are currently assigned or no pending tickets available.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Optimization Recommendations</h3>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Average Score: <strong>{averageOptimizationScore}%</strong></span>
                  <span>Total Savings: <strong>${totalTravelSavings.toFixed(2)}</strong></span>
                </div>
              </div>
              
              {recommendations.map((rec: DispatchRecommendation) => (
                <Card key={rec.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{rec.title || rec.ticketTitle}</h4>
                          <Badge className={getPriorityColor(rec.priority)}>
                            {rec.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{rec.customerName} • {rec.customerAddress}</p>
                        <p className="text-sm text-gray-600">Duration: {rec.estimatedDuration} min • Skills: {rec.requiredSkills?.join(', ') || 'N/A'}</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">{rec.recommendedTechnician.overallScore.toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">Optimization Score</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* Recommended Technician */}
                      <div className="border rounded-lg p-4 bg-green-50">
                        <h5 className="font-medium text-green-800 mb-2">Recommended: {rec.recommendedTechnician.name}</h5>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Distance:</span>
                            <span className="ml-2 font-medium">{rec.recommendedTechnician.distanceToCustomer} mi</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Travel:</span>
                            <span className="ml-2 font-medium">{rec.recommendedTechnician.travelTime} min</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Skill Match:</span>
                            <span className="ml-2 font-medium">{rec.recommendedTechnician.skillMatch}%</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Availability:</span>
                            <span className="ml-2 font-medium">{rec.recommendedTechnician.availabilityScore}%</span>
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="text-xs text-gray-600 mb-1">Reasons:</div>
                          <ul className="text-xs text-gray-700 space-y-1">
                            {rec.recommendedTechnician.reasons.map((reason, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-green-600 mt-0.5">•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="text-sm">
                          <strong>Suggested Time:</strong> {rec.suggestedTimeSlot}
                        </div>
                      </div>

                      {/* Route Optimization */}
                      <div className="border rounded-lg p-4 bg-blue-50">
                        <h5 className="font-medium text-blue-800 mb-2">Route Optimization</h5>
                        
                        {rec.routeOptimization.beforeThisCall && (
                          <div className="text-sm mb-2">
                            <span className="text-gray-600">Before:</span>
                            <span className="ml-2">{rec.routeOptimization.beforeThisCall.customer}</span>
                            <span className="text-gray-500 ml-2">ends {rec.routeOptimization.beforeThisCall.endTime}</span>
                          </div>
                        )}
                        
                        <div className="text-sm mb-2 font-medium text-blue-700">
                          ← This Call ({rec.suggestedTimeSlot}) →
                        </div>
                        
                        {rec.routeOptimization.afterThisCall && (
                          <div className="text-sm mb-3">
                            <span className="text-gray-600">After:</span>
                            <span className="ml-2">{rec.routeOptimization.afterThisCall.customer}</span>
                            <span className="text-gray-500 ml-2">starts {rec.routeOptimization.afterThisCall.startTime}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-600">Time Saved:</span>
                            <span className="ml-2 font-medium text-green-600">{rec.routeOptimization.totalTravelTime} min</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Fuel Saved:</span>
                            <span className="ml-2 font-medium text-green-600">${rec.routeOptimization.fuelSavings.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {rec.alternatives.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h6 className="text-sm font-medium text-gray-700 mb-2">Alternative Technicians:</h6>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                          {rec.alternatives.map((alt, idx) => (
                            <div key={idx} className="text-xs border rounded p-2 bg-gray-50">
                              <div className="font-medium">{alt.name}</div>
                              <div>Score: {alt.overallScore.toFixed(1)}%</div>
                              <div>{alt.distanceToCustomer}mi • {alt.travelTime}min</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-4">
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                      <Button size="sm">
                        Assign Recommended
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="technicians" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {technicians.map((tech) => (
              <Card key={tech.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{tech.name}</CardTitle>
                      <CardDescription>{tech.email}</CardDescription>
                    </div>
                    <Badge className={getStatusColor(tech.status)}>
                      {tech.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Utilization</span>
                      <span>{tech.availability.utilizationRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={tech.availability.utilizationRate} />
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>{tech.availability.bookedHours}h booked</span>
                      <span>{tech.availability.availableHours}h available</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <div className="text-gray-600">Completion Rate</div>
                      <div className="font-medium">{tech.performance.completionRate}%</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Avg Call Time</div>
                      <div className="font-medium">{tech.performance.averageCallTime}m</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Customer Rating</div>
                      <div className="font-medium">{tech.performance.customerSatisfaction}/5.0</div>
                    </div>
                    <div>
                      <div className="text-gray-600">On-time Rate</div>
                      <div className="font-medium">{tech.performance.onTimeArrival}%</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Today's Schedule:</div>
                    <div className="space-y-1">
                      {tech.currentAssignments.map((assignment, idx) => (
                        <div key={idx} className="text-xs flex justify-between p-2 bg-gray-50 rounded">
                          <span>{assignment.customer}</span>
                          <span>{assignment.startTime}-{assignment.endTime}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm">
                    <div><strong>Next Available:</strong> {tech.nextAvailableSlot}</div>
                    <div><strong>Location:</strong> {tech.currentLocation}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-600 mb-1">Skills:</div>
                    <div className="flex flex-wrap gap-1">
                      {tech.skills.map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {skill.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {tracking.map((tech: any) => (
              <Card key={tech.technicianId}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{tech.name}</CardTitle>
                      <CardDescription>{tech.currentLocation.address}</CardDescription>
                    </div>
                    <Badge className={getStatusColor(tech.currentStatus)}>
                      <MapPin className="h-3 w-3 mr-1" />
                      {tech.currentStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {tech.currentTicket && (
                    <div className="border rounded-lg p-3 bg-blue-50">
                      <h5 className="font-medium text-blue-800 mb-2">Current Assignment</h5>
                      <div className="text-sm">
                        <div><strong>Customer:</strong> {tech.currentTicket.customer}</div>
                        {tech.currentTicket.estimatedArrival && (
                          <div><strong>ETA:</strong> {tech.currentTicket.estimatedArrival}</div>
                        )}
                        {tech.currentTicket.startedAt && (
                          <div><strong>Started:</strong> {tech.currentTicket.startedAt}</div>
                        )}
                        {tech.currentTicket.estimatedCompletion && (
                          <div><strong>Est. Completion:</strong> {tech.currentTicket.estimatedCompletion}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {tech.nextAssignment && (
                    <div className="border rounded-lg p-3 bg-yellow-50">
                      <h5 className="font-medium text-yellow-800 mb-2">Next Assignment</h5>
                      <div className="text-sm">
                        <div><strong>Customer:</strong> {tech.nextAssignment.customer}</div>
                        <div><strong>Scheduled:</strong> {tech.nextAssignment.scheduledStart}</div>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Last updated: {format(new Date(tech.lastUpdate), 'HH:mm:ss')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Performance Trends</CardTitle>
                    <CardDescription>Response times and satisfaction by day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.daily_trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="avgResponseTime" 
                          stroke="#8884d8" 
                          name="Avg Response Time (hrs)"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="satisfaction" 
                          stroke="#82ca9d" 
                          name="Customer Satisfaction"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Priority Distribution</CardTitle>
                    <CardDescription>Ticket priorities and response times</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(analytics.priority_distribution).map(([priority, data]: [string, any]) => (
                        <div key={priority} className="flex justify-between items-center">
                          <span className="capitalize">{priority}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">{data.count} tickets</span>
                            <span className="text-sm text-gray-600">{data.avgResponseTime}h avg</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  priority === 'urgent' ? 'bg-red-600' :
                                  priority === 'high' ? 'bg-orange-600' :
                                  priority === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
                                }`}
                                style={{ width: `${(data.count / analytics.summary.totalTickets) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Technician Performance Comparison</CardTitle>
                  <CardDescription>Individual performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={analytics.technician_performance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="ticketsCompleted" fill="#8884d8" name="Tickets Completed" />
                      <Bar dataKey="completionRate" fill="#82ca9d" name="Completion Rate %" />
                      <Bar dataKey="utilizationRate" fill="#ffc658" name="Utilization Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}