import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Calendar, Clock, Wrench, AlertTriangle, TrendingUp, DollarSign, CheckCircle, Plus, Settings, Zap } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface MaintenanceSchedule {
  id: string;
  equipmentId: string;
  equipmentModel: string;
  customerName: string;
  customerLocation: string;
  maintenanceType: string;
  serviceName: string;
  frequency: string;
  frequencyValue: number;
  nextDueDate: Date;
  lastServiceDate: Date;
  meterBasedScheduling: boolean;
  currentMeterReading: number;
  meterAtLastService: number;
  nextServiceMeter: number | null;
  meterThreshold: number | null;
  estimatedDuration: number;
  requiredSkills: string[];
  requiredParts: string[];
  status: string;
  priority: string;
  urgencyScore: number;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  scheduledDate: Date | null;
  scheduledTimeSlot: string | null;
  autoScheduleEnabled: boolean;
  reminderDaysBefore: number;
  escalationDays: number;
  serviceHistory: Array<{
    date: Date;
    technician: string;
    duration: number;
    partsUsed: string[];
    issues: string[];
    meterReading: number;
  }>;
  predictiveInsights: {
    riskLevel: string;
    failurePrediction: number;
    recommendedActions: string[];
    costSavings: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface MaintenanceTemplate {
  id: string;
  templateName: string;
  description: string;
  equipmentTypes: string[];
  estimatedDuration: number;
  frequency: string;
  checklist: Array<{
    item: string;
    required: boolean;
    estimatedTime: number;
  }>;
  requiredParts: Array<{
    partName: string;
    quantity: number;
    optional: boolean;
  }>;
  requiredSkills: string[];
  safetyRequirements: string[];
  isActive: boolean;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled': return 'bg-blue-100 text-blue-800';
    case 'overdue': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'high': return 'bg-red-100 text-red-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const HEALTH_COLORS = ['#82ca9d', '#ffc658', '#ff7c7c'];

export default function PreventiveMaintenanceAutomation() {
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue } = useForm();

  // Fetch maintenance schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['/api/maintenance/schedules'],
    select: (data: any[]) => data.map(schedule => ({
      ...schedule,
      nextDueDate: new Date(schedule.nextDueDate),
      lastServiceDate: new Date(schedule.lastServiceDate),
      scheduledDate: schedule.scheduledDate ? new Date(schedule.scheduledDate) : null,
      serviceHistory: schedule.serviceHistory.map((h: any) => ({
        ...h,
        date: new Date(h.date)
      })),
      createdAt: new Date(schedule.createdAt),
      updatedAt: new Date(schedule.updatedAt)
    }))
  });

  // Fetch maintenance templates
  const { data: templates = [] } = useQuery<MaintenanceTemplate[]>({
    queryKey: ['/api/maintenance/templates'],
    select: (data: any[]) => data.map(template => ({
      ...template,
      lastUsed: new Date(template.lastUsed),
      createdAt: new Date(template.createdAt)
    }))
  });

  // Fetch maintenance analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/maintenance/analytics']
  });

  // Fetch predictive maintenance
  const { data: predictions = [] } = useQuery({
    queryKey: ['/api/maintenance/predictions']
  });

  // Auto-generate schedules mutation
  const autoGenerateMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/maintenance/auto-generate', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/schedules'] });
      toast({
        title: "Schedules Generated",
        description: "Maintenance schedules have been automatically generated.",
      });
    }
  });

  const handleAutoGenerate = () => {
    // Sample equipment IDs - in real implementation, this would come from equipment list
    const equipmentIds = ['eq-001', 'eq-002', 'eq-003', 'eq-004', 'eq-005'];
    autoGenerateMutation.mutate({
      equipmentIds,
      templateId: 'template-1',
      startDate: new Date(),
      frequency: 'quarterly'
    });
  };

  if (schedulesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading maintenance data...</p>
          </div>
        </div>
      </div>
    );
  }

  const overdueSchedules = schedules.filter(s => s.status === 'overdue').length;
  const dueSoon = schedules.filter(s => {
    const daysUntilDue = differenceInDays(s.nextDueDate, new Date());
    return daysUntilDue <= 7 && daysUntilDue >= 0;
  }).length;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Preventive Maintenance Automation</h1>
          <p className="text-gray-600 mt-2">Automated scheduling and predictive maintenance management</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleAutoGenerate}
            disabled={autoGenerateMutation.isPending}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Auto-Generate Schedules
          </Button>
          
          <Dialog open={isCreateScheduleOpen} onOpenChange={setIsCreateScheduleOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Maintenance Schedule</DialogTitle>
                <DialogDescription>
                  Set up automated preventive maintenance for equipment.
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm text-gray-600">
                Schedule creation form would be implemented here with equipment selection, template choice, and frequency settings.
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Maintenance Compliance</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.efficiency.maintenanceCompliance}%</div>
              <p className="text-xs text-muted-foreground">
                On-time completion rate
              </p>
              <Progress value={analytics.efficiency.maintenanceCompliance} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics.summary.costSavings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Monthly preventive savings
              </p>
              <div className="text-xs text-green-600 mt-1">
                {analytics.summary.preventiveVsReactive}% preventive vs reactive
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.efficiency.averageResponseTime}h</div>
              <p className="text-xs text-muted-foreground">
                Average service response
              </p>
              <div className="text-xs text-gray-600 mt-1">
                {analytics.efficiency.firstTimeFixRate}% first-time fix rate
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipment Health</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.summary.totalEquipment}</div>
              <p className="text-xs text-muted-foreground">
                Total managed equipment
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="text-red-600">{overdueSchedules} overdue</span>
                <span className="text-yellow-600">{dueSoon} due soon</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="schedules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="schedules">Maintenance Schedules</TabsTrigger>
          <TabsTrigger value="predictive">Predictive Analysis</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-6">
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Maintenance Schedules</h3>
                <p className="text-gray-600 mb-4">Create your first automated maintenance schedule.</p>
                <Button onClick={() => setIsCreateScheduleOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{schedule.equipmentModel}</h3>
                          <Badge className={getStatusColor(schedule.status)}>
                            {schedule.status}
                          </Badge>
                          <Badge className={getPriorityColor(schedule.priority)}>
                            {schedule.priority}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Customer:</span>
                            <br />
                            {schedule.customerName}
                          </div>
                          <div>
                            <span className="font-medium">Service Type:</span>
                            <br />
                            {schedule.serviceName}
                          </div>
                          <div>
                            <span className="font-medium">Next Due:</span>
                            <br />
                            {format(schedule.nextDueDate, 'MMM dd, yyyy')}
                          </div>
                          <div>
                            <span className="font-medium">Frequency:</span>
                            <br />
                            {schedule.frequency}
                          </div>
                        </div>

                        {schedule.meterBasedScheduling && (
                          <div className="bg-blue-50 rounded-lg p-3 mb-3">
                            <h5 className="font-medium text-blue-800 mb-2">Meter-Based Scheduling</h5>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Current Reading:</span>
                                <span className="ml-2 font-medium">{schedule.currentMeterReading.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Next Service:</span>
                                <span className="ml-2 font-medium">{schedule.nextServiceMeter?.toLocaleString() || 'N/A'}</span>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span>Progress to next service</span>
                                <span>
                                  {schedule.nextServiceMeter ? 
                                    Math.round(((schedule.currentMeterReading - schedule.meterAtLastService) / 
                                    (schedule.nextServiceMeter - schedule.meterAtLastService)) * 100) : 0}%
                                </span>
                              </div>
                              {schedule.nextServiceMeter && (
                                <Progress 
                                  value={((schedule.currentMeterReading - schedule.meterAtLastService) / 
                                         (schedule.nextServiceMeter - schedule.meterAtLastService)) * 100} 
                                />
                              )}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Duration:</span>
                            <span className="ml-2 font-medium">{schedule.estimatedDuration} min</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Skills Required:</span>
                            <span className="ml-2 font-medium">{schedule.requiredSkills.join(', ')}</span>
                          </div>
                        </div>

                        {schedule.assignedTechnicianName && (
                          <div className="text-sm">
                            <span className="text-gray-600">Assigned:</span>
                            <span className="ml-2 font-medium">{schedule.assignedTechnicianName}</span>
                            {schedule.scheduledTimeSlot && (
                              <span className="ml-2 text-gray-500">• {schedule.scheduledTimeSlot}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">{schedule.urgencyScore}</div>
                        <div className="text-xs text-gray-500">Urgency Score</div>
                        
                        <div className="mt-2 text-xs">
                          <div className="text-green-600 font-medium">
                            ${schedule.predictiveInsights.costSavings} savings
                          </div>
                          <Badge className={getRiskColor(schedule.predictiveInsights.riskLevel)} variant="outline">
                            {schedule.predictiveInsights.riskLevel} risk
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {schedule.predictiveInsights.recommendedActions.length > 0 && (
                      <div className="border-t pt-3">
                        <h6 className="text-sm font-medium text-gray-700 mb-2">Recommended Actions:</h6>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {schedule.predictiveInsights.recommendedActions.map((action, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-blue-600 mt-0.5">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-4">
                      <Button size="sm" variant="outline">
                        View History
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                      <Button size="sm">
                        Schedule Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="predictive" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {predictions.map((prediction: any) => (
              <Card key={prediction.equipmentId} className="border-l-4 border-l-red-500">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{prediction.model}</CardTitle>
                      <CardDescription>{prediction.customer} • {prediction.location}</CardDescription>
                    </div>
                    <Badge className={getRiskColor(prediction.prediction.riskLevel)}>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {prediction.prediction.riskLevel} risk
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Failure Probability</div>
                      <div className="text-xl font-bold text-red-600">{prediction.prediction.failureProbability}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Time to Failure</div>
                      <div className="text-xl font-bold">{prediction.prediction.timeToFailure} days</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Predicted Component: {prediction.prediction.predictedComponent}</div>
                    <div className="text-sm text-gray-600">Confidence: {prediction.prediction.confidence}%</div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-3">
                    <h5 className="font-medium text-yellow-800 mb-2">Cost Analysis</h5>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-gray-600">Preventive</div>
                        <div className="font-medium text-green-600">${prediction.recommendation.preventiveCost}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Reactive</div>
                        <div className="font-medium text-red-600">${prediction.recommendation.reactiveCost}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Savings</div>
                        <div className="font-medium text-green-600">${prediction.recommendation.potentialSavings}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Current Metrics:</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Meter: {prediction.dataPoints.currentMeterReading.toLocaleString()}</div>
                      <div>Monthly Volume: {prediction.dataPoints.averageMonthlyVolume.toLocaleString()}</div>
                      <div>Print Quality: {prediction.dataPoints.performanceMetrics.printQuality}</div>
                      <div>Speed Reduction: {prediction.dataPoints.performanceMetrics.speedReduction}</div>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    variant={prediction.recommendation.priority === 'urgent' ? 'default' : 'outline'}
                  >
                    {prediction.recommendation.action === 'immediate_service' ? 'Schedule Immediate Service' : 'Schedule Service'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{template.templateName}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    <Badge variant={template.isActive ? 'default' : 'secondary'}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Equipment Types:</div>
                      <div className="font-medium">{template.equipmentTypes.join(', ')}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Duration:</div>
                      <div className="font-medium">{template.estimatedDuration} min</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Frequency:</div>
                      <div className="font-medium">{template.frequency}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Usage Count:</div>
                      <div className="font-medium">{template.usageCount}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Checklist Items ({template.checklist.length})</div>
                    <div className="text-xs text-gray-600 max-h-20 overflow-y-auto">
                      {template.checklist.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-start gap-1 mb-1">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>{item.item} ({item.estimatedTime}m)</span>
                        </div>
                      ))}
                      {template.checklist.length > 3 && (
                        <div className="text-gray-500">+ {template.checklist.length - 3} more items</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">Required Skills:</div>
                    <div className="flex flex-wrap gap-1">
                      {template.requiredSkills.map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {skill.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      Edit Template
                    </Button>
                    <Button size="sm" className="flex-1">
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Equipment Health Distribution</CardTitle>
                    <CardDescription>Current health status across equipment categories</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.equipment_health.map((category: any) => (
                        <div key={category.category}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{category.category}</span>
                            <span className="text-sm text-gray-600">{category.totalUnits} units</span>
                          </div>
                          <div className="flex rounded-full overflow-hidden h-2">
                            <div 
                              className="bg-green-500" 
                              style={{ width: `${(category.healthyUnits / category.totalUnits) * 100}%` }}
                            ></div>
                            <div 
                              className="bg-yellow-500" 
                              style={{ width: `${(category.warningUnits / category.totalUnits) * 100}%` }}
                            ></div>
                            <div 
                              className="bg-red-500" 
                              style={{ width: `${(category.criticalUnits / category.totalUnits) * 100}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>{category.healthyUnits} healthy</span>
                            <span>{category.warningUnits} warning</span>
                            <span>{category.criticalUnits} critical</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cost Trends</CardTitle>
                    <CardDescription>Maintenance costs over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.cost_analysis.costTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`$${value}`, '']} />
                        <Bar dataKey="preventive" fill="#82ca9d" name="Preventive" />
                        <Bar dataKey="reactive" fill="#ff7c7c" name="Reactive" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Trends</CardTitle>
                  <CardDescription>Key maintenance metrics over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={analytics.performance_trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="compliance" 
                        stroke="#8884d8" 
                        name="Compliance %" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="satisfaction" 
                        stroke="#82ca9d" 
                        name="Satisfaction" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}