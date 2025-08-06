import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock, 
  Target, 
  BarChart3, 
  Eye,
  Plus,
  Download,
  RefreshCw,
  Users,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Settings,
  Search,
  Filter,
  Calendar,
  Award,
  PlayCircle,
  PauseCircle,
  Siren,
  Brain,
  Network,
  FileText,
  MessageSquare,
  Timer,
  Star
} from 'lucide-react';
import { format } from 'date-fns';

interface IncidentResponseData {
  responseOverview: {
    activeIncidents: number;
    criticalIncidents: number;
    highIncidents: number;
    mediumIncidents: number;
    lowIncidents: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    mttr: number;
    slaCompliance: number;
    escalatedIncidents: number;
    falsePositives: number;
  };
  activeIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    priority: string;
    status: string;
    category: string;
    subcategory: string;
    detectedAt: Date;
    reportedBy: string;
    assignedTo: string;
    responder: string;
    affectedSystems: string[];
    affectedUsers: number;
    estimatedImpact: string;
    businessImpact: string;
    detectionMethod: string;
    confidenceLevel: number;
    ttl: number;
    slaDeadline: Date;
    currentPhase: string;
    progress: number;
    tags: string[];
    threatActors: string[];
    indicators: string[];
  }>;
  incidentStats: {
    monthlyTrends: Array<{
      month: string;
      incidents: number;
      resolved: number;
      avgTime: number;
    }>;
    categoriesBreakdown: Array<{
      category: string;
      count: number;
      percentage: number;
      avgSeverity: string;
    }>;
    severityDistribution: {
      [key: string]: {
        count: number;
        percentage: number;
        avgResolutionTime: number;
      };
    };
    detectionSources: Array<{
      source: string;
      incidents: number;
      percentage: number;
    }>;
  };
  teamPerformance: {
    teams: Array<{
      name: string;
      lead: string;
      members: number;
      specialization: string;
      activeIncidents: number;
      avgResponseTime: number;
      avgResolutionTime: number;
      slaCompliance: number;
      workload: string;
      status: string;
      onCallSchedule: string;
    }>;
    individuals: Array<{
      name: string;
      role: string;
      team: string;
      activeIncidents: number;
      totalIncidents: number;
      avgResponseTime: number;
      avgResolutionTime: number;
      specialties: string[];
      certifications: string[];
      availability: string;
      performance: string;
    }>;
  };
  threatIntelligence: {
    activeThreatFeeds: number;
    iocMatches: number;
    newThreats: number;
    currentThreats: Array<{
      threatId: string;
      name: string;
      threatActor: string;
      firstSeen: Date;
      lastUpdated: Date;
      severity: string;
      confidence: number;
      targeting: string[];
      ttps: string[];
      iocs: Array<{
        type: string;
        value: string;
        confidence: number;
      }>;
      mitigation: string;
      relevanceScore: number;
    }>;
  };
  automatedResponse: {
    playbooks: Array<{
      id: string;
      name: string;
      triggers: string[];
      automationLevel: number;
      steps: number;
      avgExecutionTime: number;
      successRate: number;
      lastUpdated: Date;
      status: string;
    }>;
    automationMetrics: {
      totalAutomatedActions: number;
      automationSuccessRate: number;
      timesSaved: number;
      falsePositiveReduction: number;
      humanInterventionRequired: number;
    };
  };
}

const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'investigating': return 'bg-yellow-100 text-yellow-800';
    case 'analyzing': return 'bg-blue-100 text-blue-800';
    case 'contained': return 'bg-orange-100 text-orange-800';
    case 'resolved': return 'bg-green-100 text-green-800';
    case 'escalated': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPhaseIcon = (phase: string) => {
  switch (phase.toLowerCase()) {
    case 'detection': return <Search className="h-4 w-4" />;
    case 'analysis': return <Brain className="h-4 w-4" />;
    case 'containment': return <Shield className="h-4 w-4" />;
    case 'eradication': return <Zap className="h-4 w-4" />;
    case 'recovery': return <Activity className="h-4 w-4" />;
    case 'lessons_learned': return <FileText className="h-4 w-4" />;
    default: return <AlertCircle className="h-4 w-4" />;
  }
};

const getWorkloadColor = (workload: string) => {
  switch (workload.toLowerCase()) {
    case 'high': return 'bg-red-100 text-red-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatDuration = (hours: number) => {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  return `${hours.toFixed(1)}h`;
};

export default function IncidentResponseSystem() {
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateIncident, setShowCreateIncident] = useState(false);

  // Fetch incident response data
  const { data: responseData, isLoading, refetch } = useQuery({
    queryKey: ['/api/incident-response/dashboard', selectedSeverity, selectedCategory],
    select: (data: any) => ({
      ...data,
      activeIncidents: data.activeIncidents?.map((incident: any) => ({
        ...incident,
        detectedAt: new Date(incident.detectedAt),
        slaDeadline: new Date(incident.slaDeadline)
      })) || [],
      threatIntelligence: {
        ...data.threatIntelligence,
        currentThreats: data.threatIntelligence?.currentThreats?.map((threat: any) => ({
          ...threat,
          firstSeen: new Date(threat.firstSeen),
          lastUpdated: new Date(threat.lastUpdated)
        })) || []
      },
      automatedResponse: {
        ...data.automatedResponse,
        playbooks: data.automatedResponse?.playbooks?.map((playbook: any) => ({
          ...playbook,
          lastUpdated: new Date(playbook.lastUpdated)
        })) || []
      }
    }),
    refetchInterval: 60000 // Refresh every minute for real-time updates
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading incident response dashboard...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Siren className="h-6 w-6 text-red-600" />
            Security Incident Response System
          </h1>
          <p className="text-gray-600 mt-1">Real-time incident detection, response coordination, and threat management</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Dialog open={showCreateIncident} onOpenChange={setShowCreateIncident}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700">
                <Siren className="h-4 w-4 mr-2" />
                Declare Incident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Declare Security Incident</DialogTitle>
                <DialogDescription>
                  Create a new security incident for immediate response and investigation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="incident-title">Incident Title</Label>
                    <Input id="incident-title" placeholder="Brief description of the incident" />
                  </div>
                  <div>
                    <Label htmlFor="incident-severity">Severity Level</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="incident-description">Incident Description</Label>
                  <Textarea id="incident-description" placeholder="Detailed description of the security incident" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateIncident(false)}>
                    Cancel
                  </Button>
                  <Button className="bg-red-600 hover:bg-red-700">
                    Declare Incident
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {responseData && (
        <>
          {/* Response Overview KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <Card className="border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Incidents</p>
                    <p className="text-2xl font-bold text-red-900">
                      {responseData.responseOverview.activeIncidents}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Badge className={getSeverityColor('critical')} variant="outline">
                    {responseData.responseOverview.criticalIncidents} Critical
                  </Badge>
                  <Badge className={getSeverityColor('high')} variant="outline">
                    {responseData.responseOverview.highIncidents} High
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatDuration(responseData.responseOverview.avgResponseTime / 60)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Timer className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    MTTR: {formatDuration(responseData.responseOverview.mttr)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">SLA Compliance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(responseData.responseOverview.slaCompliance)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Target className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={responseData.responseOverview.slaCompliance} className="h-2" />
                  <p className="text-sm text-green-600 mt-1">Excellent performance</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">False Positives</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {responseData.responseOverview.falsePositives}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Activity className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <TrendingDown className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {responseData.responseOverview.escalatedIncidents} escalated
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="active" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 sm:gap-0">
              <TabsTrigger value="active" className="text-xs sm:text-sm px-2 py-2">Active</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm px-2 py-2">Analytics</TabsTrigger>
              <TabsTrigger value="teams" className="text-xs sm:text-sm px-2 py-2">Teams</TabsTrigger>
              <TabsTrigger value="threats" className="text-xs sm:text-sm px-2 py-2">Threats</TabsTrigger>
              <TabsTrigger value="automation" className="text-xs sm:text-sm px-2 py-2">Automation</TabsTrigger>
              <TabsTrigger value="playbooks" className="text-xs sm:text-sm px-2 py-2">Playbooks</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-6">
              <div className="space-y-4">
                {responseData.activeIncidents.map((incident: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow border-l-4 border-l-red-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-lg text-gray-900">{incident.title}</h3>
                            <Badge className={getSeverityColor(incident.severity)}>
                              {incident.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {incident.priority.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-3">{incident.businessImpact}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge className={getStatusColor(incident.status)}>
                            {incident.status.replace('_', ' ')}
                          </Badge>
                          <div className="text-xs text-gray-500">
                            ID: {incident.id}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Incident Details</div>
                          <div className="space-y-1 text-sm">
                            <div><strong>Detected:</strong> {format(incident.detectedAt, 'MMM dd, HH:mm')}</div>
                            <div><strong>Reporter:</strong> {incident.reportedBy}</div>
                            <div><strong>Responder:</strong> {incident.responder}</div>
                            <div><strong>TTL:</strong> {formatDuration(incident.ttl)}</div>
                            <div><strong>Confidence:</strong> {formatPercentage(incident.confidenceLevel)}</div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Impact & Scope</div>
                          <div className="space-y-1 text-sm">
                            <div><strong>Affected Users:</strong> {incident.affectedUsers}</div>
                            <div><strong>Systems:</strong> {incident.affectedSystems.length}</div>
                            <div><strong>Impact Level:</strong> {incident.estimatedImpact}</div>
                            <div><strong>Category:</strong> {incident.category.replace('_', ' ')}</div>
                          </div>
                          <div className="mt-2">
                            <div className="text-xs text-gray-600 mb-1">Affected Systems:</div>
                            <div className="flex flex-wrap gap-1">
                              {incident.affectedSystems.slice(0, 2).map((system: string, sysIdx: number) => (
                                <Badge key={sysIdx} variant="outline" className="text-xs">
                                  {system}
                                </Badge>
                              ))}
                              {incident.affectedSystems.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{incident.affectedSystems.length - 2} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Response Progress</div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getPhaseIcon(incident.currentPhase)}
                              <span className="text-sm font-medium capitalize">
                                {incident.currentPhase} Phase
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">Progress</span>
                                <span className="text-xs font-medium">{incident.progress}%</span>
                              </div>
                              <Progress value={incident.progress} className="h-2" />
                            </div>
                            <div className="text-xs text-gray-500">
                              SLA Deadline: {format(incident.slaDeadline, 'MMM dd, HH:mm')}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-600 mb-1">Threat Intelligence</div>
                            <div className="flex flex-wrap gap-1">
                              {incident.tags.slice(0, 3).map((tag: string, tagIdx: number) => (
                                <Badge key={tagIdx} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {incident.threatActors.length > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {incident.threatActors[0]}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                            <Button size="sm" className="bg-red-600 hover:bg-red-700">
                              <PlayCircle className="h-4 w-4 mr-2" />
                              Execute Playbook
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Category Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Incident Categories
                    </CardTitle>
                    <CardDescription>Breakdown by incident type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {responseData.incidentStats.categoriesBreakdown.map((category: any, idx: number) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium capitalize">
                              {category.category.replace('_', ' ')}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{category.count}</span>
                              <Badge className={getSeverityColor(category.avgSeverity)} variant="outline">
                                {category.avgSeverity}
                              </Badge>
                            </div>
                          </div>
                          <Progress value={category.percentage} className="h-2" />
                          <div className="text-xs text-gray-500">
                            {formatPercentage(category.percentage)} of total incidents
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Detection Sources */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="h-5 w-5" />
                      Detection Sources
                    </CardTitle>
                    <CardDescription>How incidents are detected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {responseData.incidentStats.detectionSources.map((source: any, idx: number) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{source.source}</span>
                            <span className="text-sm font-bold">{source.incidents}</span>
                          </div>
                          <Progress value={source.percentage} className="h-2" />
                          <div className="text-xs text-gray-500">
                            {formatPercentage(source.percentage)} of detections
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Severity Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Severity Distribution & Resolution Times
                  </CardTitle>
                  <CardDescription>Incident severity levels and average resolution times</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(responseData.incidentStats.severityDistribution).map(([severity, data]: [string, any]) => (
                      <div key={severity} className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-gray-900 mb-1">
                          {data.count}
                        </div>
                        <div className={`text-sm font-medium mb-2 capitalize ${
                          severity === 'critical' ? 'text-red-600' :
                          severity === 'high' ? 'text-orange-600' :
                          severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                        }`}>
                          {severity}
                        </div>
                        <div className="text-xs text-gray-600 mb-1">
                          {formatPercentage(data.percentage)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Avg: {formatDuration(data.avgResolutionTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teams" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {responseData.teamPerformance.teams.map((team: any, idx: number) => (
                  <Card key={idx}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        <Badge className={getWorkloadColor(team.workload)}>
                          {team.workload} load
                        </Badge>
                      </div>
                      <CardDescription>{team.specialization}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Team Lead:</span>
                            <div className="font-medium">{team.lead}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Members:</span>
                            <div className="font-medium">{team.members}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Active Cases:</span>
                            <div className="font-medium">{team.activeIncidents}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {team.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Response Time</span>
                            <span className="text-sm font-medium">{formatDuration(team.avgResponseTime / 60)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Resolution Time</span>
                            <span className="text-sm font-medium">{formatDuration(team.avgResolutionTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">SLA Compliance</span>
                            <span className="text-sm font-medium">{formatPercentage(team.slaCompliance)}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50 rounded text-sm">
                          <div className="font-medium text-blue-800 mb-1">On-Call Schedule</div>
                          <div className="text-blue-700">{team.onCallSchedule}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Individual Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Top Performers
                  </CardTitle>
                  <CardDescription>Individual analyst performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {responseData.teamPerformance.individuals.map((analyst: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="font-medium">{analyst.name}</div>
                            <Badge variant="outline" className="text-xs">
                              {analyst.team}
                            </Badge>
                            <Badge className={
                              analyst.performance === 'excellent' ? 'bg-green-100 text-green-800' :
                              analyst.performance === 'good' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {analyst.performance}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mb-2">{analyst.role}</div>
                          <div className="flex flex-wrap gap-1">
                            {analyst.specialties.slice(0, 2).map((specialty: string, specIdx: number) => (
                              <Badge key={specIdx} variant="secondary" className="text-xs">
                                {specialty}
                              </Badge>
                            ))}
                            {analyst.certifications.slice(0, 2).map((cert: string, certIdx: number) => (
                              <Badge key={certIdx} variant="outline" className="text-xs">
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500">Active</div>
                              <div className="font-medium">{analyst.activeIncidents}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Total</div>
                              <div className="font-medium">{analyst.totalIncidents}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Response</div>
                              <div className="font-medium">{formatDuration(analyst.avgResponseTime / 60)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Resolution</div>
                              <div className="font-medium">{formatDuration(analyst.avgResolutionTime)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="threats" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-2xl font-bold text-blue-900">
                      {responseData.threatIntelligence.activeThreatFeeds}
                    </div>
                    <div className="text-sm text-gray-600">Active Threat Feeds</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-2xl font-bold text-orange-900">
                      {responseData.threatIntelligence.iocMatches}
                    </div>
                    <div className="text-sm text-gray-600">IOC Matches</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-2xl font-bold text-red-900">
                      {responseData.threatIntelligence.newThreats}
                    </div>
                    <div className="text-sm text-gray-600">New Threats (24h)</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {responseData.threatIntelligence.currentThreats.map((threat: any, idx: number) => (
                  <Card key={idx} className="border-orange-200">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-lg">{threat.name}</h3>
                            <Badge className={getSeverityColor(threat.severity)}>
                              {threat.severity}
                            </Badge>
                            <Badge variant="outline">
                              {formatPercentage(threat.confidence)} confidence
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            <strong>Threat Actor:</strong> {threat.threatActor}
                          </div>
                          <div className="text-sm text-gray-600">
                            <strong>First Seen:</strong> {format(threat.firstSeen, 'MMM dd, yyyy')} • 
                            <strong> Last Updated:</strong> {format(threat.lastUpdated, 'MMM dd, HH:mm')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Relevance Score</div>
                          <div className="text-lg font-bold text-orange-900">
                            {threat.relevanceScore.toFixed(1)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Targeting</div>
                          <div className="flex flex-wrap gap-1">
                            {threat.targeting.map((target: string, targetIdx: number) => (
                              <Badge key={targetIdx} variant="secondary" className="text-xs">
                                {target}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600 mb-2">TTPs</div>
                          <div className="flex flex-wrap gap-1">
                            {threat.ttps.map((ttp: string, ttpIdx: number) => (
                              <Badge key={ttpIdx} variant="outline" className="text-xs font-mono">
                                {ttp}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600 mb-2">IOCs ({threat.iocs.length})</div>
                          <div className="space-y-1">
                            {threat.iocs.slice(0, 2).map((ioc: any, iocIdx: number) => (
                              <div key={iocIdx} className="text-xs">
                                <Badge variant="destructive" className="text-xs mr-1">
                                  {ioc.type}
                                </Badge>
                                <span className="font-mono text-gray-600">
                                  {ioc.value.length > 20 ? `${ioc.value.substring(0, 20)}...` : ioc.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-orange-50 rounded">
                        <div className="text-sm font-medium text-orange-800 mb-1">Recommended Mitigation</div>
                        <div className="text-sm text-orange-700">{threat.mitigation}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="automation" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-2xl font-bold text-blue-900">
                      {responseData.automatedResponse.automationMetrics.totalAutomatedActions.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Automated Actions</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-2xl font-bold text-green-900">
                      {formatPercentage(responseData.automatedResponse.automationMetrics.automationSuccessRate)}
                    </div>
                    <div className="text-sm text-gray-600">Success Rate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-2xl font-bold text-purple-900">
                      {Math.round(responseData.automatedResponse.automationMetrics.timesSaved)}h
                    </div>
                    <div className="text-sm text-gray-600">Time Saved</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-2xl font-bold text-orange-900">
                      {formatPercentage(responseData.automatedResponse.automationMetrics.humanInterventionRequired)}
                    </div>
                    <div className="text-sm text-gray-600">Human Required</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="playbooks" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {responseData.automatedResponse.playbooks.map((playbook: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{playbook.name}</CardTitle>
                        <Badge className={playbook.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {playbook.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Steps:</span>
                            <div className="font-medium">{playbook.steps}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Avg Time:</span>
                            <div className="font-medium">{formatDuration(playbook.avgExecutionTime / 60)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Success Rate:</span>
                            <div className="font-medium">{formatPercentage(playbook.successRate)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Automation:</span>
                            <div className="font-medium">{formatPercentage(playbook.automationLevel)}</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Triggers</div>
                          <div className="flex flex-wrap gap-1">
                            {playbook.triggers.map((trigger: string, triggerIdx: number) => (
                              <Badge key={triggerIdx} variant="outline" className="text-xs">
                                {trigger.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            Updated: {format(playbook.lastUpdated, 'MMM dd, yyyy')}
                          </div>
                          <Button size="sm">
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Execute
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
      </div>
    </MainLayout>
  );
}