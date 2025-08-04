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
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  Lock, 
  FileText, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Activity, 
  Eye, 
  Settings,
  Zap,
  Database,
  Key,
  Fingerprint,
  Wifi,
  Globe,
  Search,
  Filter,
  Download,
  Upload,
  Bell,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Timer,
  BarChart3,
  PieChart,
  LineChart,
  Gauge,
  Award,
  Crosshair,
  Target,
  Radar,
  ScanLine,
  Bug,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  UserCheck,
  UserX,
  RefreshCw,
  Calendar,
  MapPin,
  Monitor,
  Smartphone,
  Server,
  HardDrive,
  Network,
  Cpu
} from 'lucide-react';
import { format } from 'date-fns';

interface SecurityComplianceData {
  securityOverview: {
    overallSecurityScore: number;
    complianceStatus: string;
    activeThreats: number;
    resolvedThreats: number;
    securityIncidents: number;
    lastSecurityAudit: Date;
    nextAuditDue: Date;
    certificationsActive: number;
    vulnerabilitiesDetected: number;
    vulnerabilitiesPatched: number;
    securityTrainingCompliance: number;
    dataBackupStatus: string;
    encryptionCoverage: number;
  };
  threatDetection: {
    realTimeMonitoring: {
      activeScans: number;
      threatsDetected: number;
      falsePositives: number;
      threatScore: number;
      lastScanCompleted: Date;
      nextScheduledScan: Date;
      monitoringUptime: number;
    };
    detectedThreats: Array<{
      id: string;
      type: string;
      severity: string;
      status: string;
      detectedAt: Date;
      source: string;
      targetUser: string;
      description: string;
      riskScore: number;
      affectedSystems: string[];
      mitigationActions: string[];
      investigator: string;
      estimatedResolutionTime: number;
      resolvedAt?: Date;
    }>;
    threatTrends: Array<{
      category: string;
      count: number;
      change: string;
      severity: string;
    }>;
  };
  complianceManagement: {
    regulations: Array<{
      id: string;
      name: string;
      status: string;
      complianceScore: number;
      lastAudit: Date;
      nextAudit: Date;
      requirements: number;
      compliantRequirements: number;
      nonCompliantRequirements: number;
      actionItemsOpen: number;
      actionItemsCompleted: number;
      certificationStatus: string;
      expiryDate: Date;
      auditor: string;
      riskLevel: string;
    }>;
    actionItems: Array<{
      id: string;
      regulation: string;
      priority: string;
      title: string;
      description: string;
      assignee: string;
      dueDate: Date;
      status: string;
      progress: number;
      estimatedHours: number;
      completedHours: number;
      riskIfDelayed: string;
    }>;
    complianceMetrics: {
      overallComplianceScore: number;
      regulationsMonitored: number;
      activeCompliance: number;
      nonCompliantRegulations: number;
      overdueActionItems: number;
      upcomingAudits: number;
      certificationRenewals: number;
      complianceTrainingCompletion: number;
    };
  };
  accessControl: {
    userAccessMatrix: {
      totalUsers: number;
      activeUsers: number;
      inactiveUsers: number;
      privilegedUsers: number;
      serviceAccounts: number;
      pendingAccessRequests: number;
      expiredAccounts: number;
      multiFactorEnabled: number;
      singleSignOnEnabled: number;
    };
    roleBasedAccess: {
      totalRoles: number;
      customRoles: number;
      defaultRoles: number;
      roleAssignments: number;
      roleConflicts: number;
      segregationOfDutiesViolations: number;
      leastPrivilegeCompliance: number;
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
    case 'compliant': return 'bg-green-100 text-green-800';
    case 'active': return 'bg-green-100 text-green-800';
    case 'resolved': return 'bg-green-100 text-green-800';
    case 'investigating': return 'bg-yellow-100 text-yellow-800';
    case 'contained': return 'bg-blue-100 text-blue-800';
    case 'overdue': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'high': return 'bg-red-100 text-red-800 border-red-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const getSecurityScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-yellow-600';
  return 'text-red-600';
};

const getThreatIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'suspicious_login_attempt': return <UserX className="h-5 w-5 text-orange-600" />;
    case 'data_access_anomaly': return <Database className="h-5 w-5 text-red-600" />;
    case 'malware_detection': return <Bug className="h-5 w-5 text-red-600" />;
    case 'phishing_attempts': return <Wifi className="h-5 w-5 text-yellow-600" />;
    case 'ddos_attempts': return <Network className="h-5 w-5 text-red-600" />;
    default: return <AlertTriangle className="h-5 w-5 text-gray-600" />;
  }
};

export default function SecurityComplianceManagement() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedThreatFilter, setSelectedThreatFilter] = useState('all');
  const [selectedComplianceFilter, setSelectedComplianceFilter] = useState('all');

  // Fetch security compliance data
  const { data: securityData, isLoading, refetch } = useQuery({
    queryKey: ['/api/security-compliance/dashboard'],
    select: (data: any) => ({
      ...data,
      securityOverview: {
        ...data.securityOverview,
        lastSecurityAudit: new Date(data.securityOverview.lastSecurityAudit),
        nextAuditDue: new Date(data.securityOverview.nextAuditDue)
      },
      threatDetection: {
        ...data.threatDetection,
        realTimeMonitoring: {
          ...data.threatDetection.realTimeMonitoring,
          lastScanCompleted: new Date(data.threatDetection.realTimeMonitoring.lastScanCompleted),
          nextScheduledScan: new Date(data.threatDetection.realTimeMonitoring.nextScheduledScan)
        },
        detectedThreats: data.threatDetection?.detectedThreats?.map((threat: any) => ({
          ...threat,
          detectedAt: new Date(threat.detectedAt),
          resolvedAt: threat.resolvedAt ? new Date(threat.resolvedAt) : undefined
        })) || []
      },
      complianceManagement: {
        ...data.complianceManagement,
        regulations: data.complianceManagement?.regulations?.map((reg: any) => ({
          ...reg,
          lastAudit: new Date(reg.lastAudit),
          nextAudit: new Date(reg.nextAudit),
          expiryDate: new Date(reg.expiryDate)
        })) || [],
        actionItems: data.complianceManagement?.actionItems?.map((item: any) => ({
          ...item,
          dueDate: new Date(item.dueDate)
        })) || []
      }
    }),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading security & compliance data...</p>
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
            <Shield className="h-6 w-6 text-red-600" />
            Advanced Security & Compliance Management
          </h1>
          <p className="text-gray-600 mt-1">Comprehensive security monitoring, threat detection, and regulatory compliance management</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Security Audit
          </Button>
          
          <Button className="bg-red-600 hover:bg-red-700">
            <AlertCircle className="h-4 w-4 mr-2" />
            Security Center
          </Button>
        </div>
      </div>

      {securityData && (
        <>
          {/* Security Overview KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Security Score</p>
                    <p className={`text-2xl font-bold ${getSecurityScoreColor(securityData.securityOverview.overallSecurityScore)}`}>
                      {formatPercentage(securityData.securityOverview.overallSecurityScore)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                    <Shield className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600 capitalize">
                    {securityData.securityOverview.complianceStatus}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Threats</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {securityData.securityOverview.activeThreats}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Target className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-blue-600">
                    {securityData.securityOverview.resolvedThreats} resolved
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Vulnerabilities</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {securityData.securityOverview.vulnerabilitiesDetected}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Bug className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {securityData.securityOverview.vulnerabilitiesPatched} patched
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Compliance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(securityData.complianceManagement.complianceMetrics.overallComplianceScore)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Award className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-blue-600">
                    {securityData.securityOverview.certificationsActive} certifications
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="threats" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="threats">Threat Detection</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="access">Access Control</TabsTrigger>
              <TabsTrigger value="monitoring">Security Monitoring</TabsTrigger>
              <TabsTrigger value="audits">Audits & Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="threats" className="space-y-6">
              {/* Real-time Monitoring */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radar className="h-5 w-5 text-blue-600" />
                    Real-time Threat Monitoring
                  </CardTitle>
                  <CardDescription>Live security monitoring and threat detection status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-blue-900">
                        {securityData.threatDetection.realTimeMonitoring.activeScans}
                      </div>
                      <div className="text-sm text-gray-600">Active Scans</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-red-900">
                        {securityData.threatDetection.realTimeMonitoring.threatsDetected}
                      </div>
                      <div className="text-sm text-gray-600">Threats Detected</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-yellow-900">
                        {securityData.threatDetection.realTimeMonitoring.falsePositives}
                      </div>
                      <div className="text-sm text-gray-600">False Positives</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-orange-900">
                        {securityData.threatDetection.realTimeMonitoring.threatScore.toFixed(1)}/10
                      </div>
                      <div className="text-sm text-gray-600">Threat Score</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-green-900">
                        {formatPercentage(securityData.threatDetection.realTimeMonitoring.monitoringUptime)}
                      </div>
                      <div className="text-sm text-gray-600">Uptime</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-purple-900">
                        {format(securityData.threatDetection.realTimeMonitoring.nextScheduledScan, 'HH:mm')}
                      </div>
                      <div className="text-sm text-gray-600">Next Scan</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detected Threats */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        Detected Threats
                      </CardTitle>
                      <CardDescription>Current security threats requiring attention</CardDescription>
                    </div>
                    <Select value={selectedThreatFilter} onValueChange={setSelectedThreatFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Threats</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {securityData.threatDetection.detectedThreats.map((threat: any, idx: number) => (
                      <div key={idx} className={`p-4 border rounded-lg ${getSeverityColor(threat.severity)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getThreatIcon(threat.type)}
                              <h3 className="font-semibold capitalize">{threat.type.replace('_', ' ')}</h3>
                              <Badge className={getSeverityColor(threat.severity)}>
                                {threat.severity}
                              </Badge>
                              <Badge className={getStatusColor(threat.status)}>
                                {threat.status}
                              </Badge>
                            </div>
                            <p className="text-sm mb-2">{threat.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{threat.riskScore.toFixed(1)}</div>
                            <div className="text-xs text-gray-500">risk score</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Source:</span>
                            <span className="ml-2 font-medium">{threat.source}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Target:</span>
                            <span className="ml-2 font-medium">{threat.targetUser}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Detected:</span>
                            <span className="ml-2 font-medium">{format(threat.detectedAt, 'MMM dd, HH:mm')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Investigator:</span>
                            <span className="ml-2 font-medium capitalize">{threat.investigator.replace('_', ' ')}</span>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <div className="text-sm text-gray-600 mb-2">Affected Systems:</div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {threat.affectedSystems.map((system: string, sysIdx: number) => (
                              <Badge key={sysIdx} variant="secondary" className="text-xs">
                                {system.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-2">Mitigation Actions:</div>
                          <div className="flex flex-wrap gap-1">
                            {threat.mitigationActions.map((action: string, actionIdx: number) => (
                              <Badge key={actionIdx} variant="outline" className="text-xs">
                                {action.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-4 pt-3 border-t">
                          <div className="text-sm text-gray-600">
                            ETA: {threat.estimatedResolutionTime} minutes
                            {threat.resolvedAt && (
                              <span className="ml-2 text-green-600">
                                Resolved {format(threat.resolvedAt, 'MMM dd, HH:mm')}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              Details
                            </Button>
                            {threat.status !== 'resolved' && (
                              <Button size="sm">
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Threat Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Threat Trends
                  </CardTitle>
                  <CardDescription>Security threat patterns and trends analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {securityData.threatDetection.threatTrends.map((trend: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium capitalize">{trend.category.replace('_', ' ')}</div>
                          <Badge className={getSeverityColor(trend.severity)}>
                            {trend.severity}
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold">{trend.count}</div>
                        <div className={`text-sm flex items-center gap-1 ${
                          trend.change.startsWith('+') ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {trend.change.startsWith('+') ? 
                            <TrendingUp className="h-4 w-4" /> : 
                            <TrendingDown className="h-4 w-4" />
                          }
                          {trend.change}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-6">
              {/* Compliance Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-green-600" />
                    Compliance Status Overview
                  </CardTitle>
                  <CardDescription>Current regulatory compliance status and metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-green-900">
                        {formatPercentage(securityData.complianceManagement.complianceMetrics.overallComplianceScore)}
                      </div>
                      <div className="text-sm text-gray-600">Overall Score</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-blue-900">
                        {securityData.complianceManagement.complianceMetrics.regulationsMonitored}
                      </div>
                      <div className="text-sm text-gray-600">Regulations</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-green-900">
                        {securityData.complianceManagement.complianceMetrics.activeCompliance}
                      </div>
                      <div className="text-sm text-gray-600">Compliant</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-red-900">
                        {securityData.complianceManagement.complianceMetrics.nonCompliantRegulations}
                      </div>
                      <div className="text-sm text-gray-600">Non-Compliant</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-orange-900">
                        {securityData.complianceManagement.complianceMetrics.overdueActionItems}
                      </div>
                      <div className="text-sm text-gray-600">Overdue</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-purple-900">
                        {securityData.complianceManagement.complianceMetrics.upcomingAudits}
                      </div>
                      <div className="text-sm text-gray-600">Audits Due</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-yellow-900">
                        {securityData.complianceManagement.complianceMetrics.certificationRenewals}
                      </div>
                      <div className="text-sm text-gray-600">Renewals</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-indigo-900">
                        {formatPercentage(securityData.complianceManagement.complianceMetrics.complianceTrainingCompletion)}
                      </div>
                      <div className="text-sm text-gray-600">Training</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Regulations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Regulatory Compliance
                  </CardTitle>
                  <CardDescription>Status of regulatory frameworks and compliance requirements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {securityData.complianceManagement.regulations.map((regulation: any, idx: number) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{regulation.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getStatusColor(regulation.status)}>
                                {regulation.status}
                              </Badge>
                              <Badge variant="outline" className={`capitalize ${
                                regulation.riskLevel === 'low' ? 'text-green-600' :
                                regulation.riskLevel === 'medium' ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {regulation.riskLevel} risk
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              {formatPercentage(regulation.complianceScore)}
                            </div>
                            <div className="text-xs text-gray-500">compliance</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-gray-600">Requirements:</span>
                            <span className="ml-2 font-medium">{regulation.compliantRequirements}/{regulation.requirements}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Action Items:</span>
                            <span className="ml-2 font-medium">{regulation.actionItemsOpen} open</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Last Audit:</span>
                            <span className="ml-2 font-medium">{format(regulation.lastAudit, 'MMM dd, yyyy')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Next Audit:</span>
                            <span className="ml-2 font-medium">{format(regulation.nextAudit, 'MMM dd, yyyy')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Auditor:</span>
                            <span className="ml-2 font-medium">{regulation.auditor}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Expires:</span>
                            <span className="ml-2 font-medium">{format(regulation.expiryDate, 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Compliance Progress</span>
                            <span>{regulation.compliantRequirements}/{regulation.requirements}</span>
                          </div>
                          <Progress 
                            value={(regulation.compliantRequirements / regulation.requirements) * 100} 
                            className="h-2"
                          />
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <Badge className={regulation.certificationStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {regulation.certificationStatus} certification
                          </Badge>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Action Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    Compliance Action Items
                  </CardTitle>
                  <CardDescription>Outstanding compliance tasks and their progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {securityData.complianceManagement.actionItems.map((item: any, idx: number) => (
                      <div key={idx} className={`p-4 border rounded-lg ${getPriorityColor(item.priority)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{item.title}</h3>
                              <Badge className={getPriorityColor(item.priority)}>
                                {item.priority} priority
                              </Badge>
                              <Badge className={getStatusColor(item.status)}>
                                {item.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                            <div className="text-sm text-gray-600">
                              Regulation: <span className="font-medium">{item.regulation}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{item.progress}%</div>
                            <div className="text-xs text-gray-500">complete</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Assignee:</span>
                            <span className="ml-2 font-medium capitalize">{item.assignee.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Due Date:</span>
                            <span className="ml-2 font-medium">{format(item.dueDate, 'MMM dd, yyyy')}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Hours:</span>
                            <span className="ml-2 font-medium">{item.completedHours}/{item.estimatedHours}</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{item.progress}%</span>
                          </div>
                          <Progress value={item.progress} className="h-2" />
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-sm">
                            <span className="text-gray-600">Risk if delayed:</span>
                            <span className="ml-2 font-medium capitalize text-red-600">
                              {item.riskIfDelayed.replace('_', ' ')}
                            </span>
                          </div>
                          <Button size="sm">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Update Progress
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access" className="space-y-6">
              {/* Access Control Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-purple-600" />
                    Access Control Overview
                  </CardTitle>
                  <CardDescription>User access management and identity security metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-4">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-blue-900">
                        {securityData.accessControl.userAccessMatrix.totalUsers}
                      </div>
                      <div className="text-sm text-gray-600">Total Users</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-green-900">
                        {securityData.accessControl.userAccessMatrix.activeUsers}
                      </div>
                      <div className="text-sm text-gray-600">Active</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-gray-900">
                        {securityData.accessControl.userAccessMatrix.inactiveUsers}
                      </div>
                      <div className="text-sm text-gray-600">Inactive</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-orange-900">
                        {securityData.accessControl.userAccessMatrix.privilegedUsers}
                      </div>
                      <div className="text-sm text-gray-600">Privileged</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-purple-900">
                        {securityData.accessControl.userAccessMatrix.serviceAccounts}
                      </div>
                      <div className="text-sm text-gray-600">Service Accounts</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-yellow-900">
                        {securityData.accessControl.userAccessMatrix.pendingAccessRequests}
                      </div>
                      <div className="text-sm text-gray-600">Pending</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-red-900">
                        {securityData.accessControl.userAccessMatrix.expiredAccounts}
                      </div>
                      <div className="text-sm text-gray-600">Expired</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-indigo-900">
                        {securityData.accessControl.userAccessMatrix.multiFactorEnabled}
                      </div>
                      <div className="text-sm text-gray-600">MFA Enabled</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-cyan-900">
                        {securityData.accessControl.userAccessMatrix.singleSignOnEnabled}
                      </div>
                      <div className="text-sm text-gray-600">SSO Enabled</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Role-Based Access Control */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Role-Based Access Control
                  </CardTitle>
                  <CardDescription>RBAC configuration and compliance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">
                        {securityData.accessControl.roleBasedAccess.totalRoles}
                      </div>
                      <div className="text-sm text-gray-600">Total Roles</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {securityData.accessControl.roleBasedAccess.customRoles} custom, {securityData.accessControl.roleBasedAccess.defaultRoles} default
                      </div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        {securityData.accessControl.roleBasedAccess.roleAssignments}
                      </div>
                      <div className="text-sm text-gray-600">Role Assignments</div>
                      <div className="text-xs text-green-600 mt-1">Active assignments</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-900">
                        {securityData.accessControl.roleBasedAccess.roleConflicts}
                      </div>
                      <div className="text-sm text-gray-600">Role Conflicts</div>
                      <div className="text-xs text-red-600 mt-1">Conflicts detected</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatPercentage(securityData.accessControl.roleBasedAccess.leastPrivilegeCompliance)}
                      </div>
                      <div className="text-sm text-gray-600">Least Privilege</div>
                      <div className="text-xs text-purple-600 mt-1">Compliance rate</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Segregation of Duties Compliance</span>
                    </div>
                    <p className="text-sm text-green-700">
                      No segregation of duties violations detected. All critical business functions maintain proper access separation.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
              <div className="text-center py-12">
                <Monitor className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Security Monitoring Dashboard</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Advanced security monitoring, analytics, and incident response tracking
                </p>
                <Button>
                  <Activity className="h-4 w-4 mr-2" />
                  View Monitoring
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="audits" className="space-y-6">
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Audit Reports & Documentation</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Security audit reports, compliance documentation, and regulatory filing management
                </p>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
      </div>
    </MainLayout>
  );
}