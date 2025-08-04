import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Lock,
  Key,
  FileCheck,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Settings,
  Search,
  Filter,
  Calendar,
  Award,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';

interface SecurityData {
  securityOverview: {
    securityScore: number;
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    complianceScore: number;
    lastSecurityAudit: Date;
    nextAuditDue: Date;
    activeThreats: number;
    resolvedIncidents: number;
    systemUptime: number;
  };
  complianceStatus: Array<{
    framework: string;
    status: string;
    score: number;
    lastAudit: Date;
    nextAudit: Date;
    findings: number;
    remediated: number;
    inProgress: number;
    requirements: {
      total: number;
      implemented: number;
      pending: number;
      notApplicable: number;
    };
  }>;
  securityIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    category: string;
    reportedAt: Date;
    reportedBy: string;
    affectedSystems: string[];
    description: string;
    assignedTo: string;
    estimatedResolution?: Date;
    resolvedAt?: Date;
    actions: string[];
  }>;
  vulnerabilities: Array<{
    id: string;
    title: string;
    severity: string;
    cvss: number;
    category: string;
    affectedAssets: string[];
    discoveredDate: Date;
    status: string;
    dueDate: Date;
    assignedTo: string;
    description: string;
    remediation: string;
    businessImpact: string;
  }>;
  accessControl: {
    userAccounts: {
      total: number;
      active: number;
      inactive: number;
      privileged: number;
      serviceAccounts: number;
      pendingActivation: number;
      pendingDeactivation: number;
    };
    permissions: {
      totalRoles: number;
      customRoles: number;
      defaultRoles: number;
      roleAssignments: number;
      excessivePrivileges: number;
      unusedPermissions: number;
    };
    authentication: {
      mfaEnabled: number;
      mfaDisabled: number;
      ssoUsers: number;
      localAuthUsers: number;
      passwordExpiring: number;
      accountsLocked: number;
    };
  };
  dataProtection: {
    dataClassification: {
      public: number;
      internal: number;
      confidential: number;
      restricted: number;
      total: number;
    };
    dataRetention: {
      policiesTotal: number;
      policiesActive: number;
      retentionCompliant: number;
      recordsScheduledDeletion: number;
      recordsDeleted: number;
      retentionViolations: number;
    };
    privacyRequests: Array<{
      id: string;
      type: string;
      requestDate: Date;
      status: string;
      responseTime?: number;
      dataSubject: string;
      completedDate?: Date;
      estimatedCompletion?: Date;
    }>;
  };
  securityTraining: {
    trainingPrograms: Array<{
      program: string;
      participants: number;
      completed: number;
      inProgress: number;
      completionRate: number;
      averageScore: number;
      lastUpdated: Date;
    }>;
    phishingSimulations: {
      totalCampaigns: number;
      totalEmails: number;
      clicked: number;
      reported: number;
      clickRate: number;
      reportRate: number;
      improvementTrend: string;
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
    case 'resolved': return 'bg-green-100 text-green-800';
    case 'investigating': return 'bg-yellow-100 text-yellow-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'open': return 'bg-red-100 text-red-800';
    case 'contained': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'compliant':
    case 'resolved':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'investigating':
    case 'in_progress':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'open':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'contained':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-600" />;
  }
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export default function SecurityComplianceManagement() {
  const [selectedFramework, setSelectedFramework] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [showCreateIncident, setShowCreateIncident] = useState(false);

  // Fetch security dashboard data
  const { data: securityData, isLoading, refetch } = useQuery({
    queryKey: ['/api/security/dashboard', selectedFramework, selectedSeverity],
    select: (data: any) => ({
      ...data,
      securityOverview: {
        ...data.securityOverview,
        lastSecurityAudit: new Date(data.securityOverview.lastSecurityAudit),
        nextAuditDue: new Date(data.securityOverview.nextAuditDue)
      },
      complianceStatus: data.complianceStatus?.map((compliance: any) => ({
        ...compliance,
        lastAudit: new Date(compliance.lastAudit),
        nextAudit: new Date(compliance.nextAudit)
      })) || [],
      securityIncidents: data.securityIncidents?.map((incident: any) => ({
        ...incident,
        reportedAt: new Date(incident.reportedAt),
        estimatedResolution: incident.estimatedResolution ? new Date(incident.estimatedResolution) : undefined,
        resolvedAt: incident.resolvedAt ? new Date(incident.resolvedAt) : undefined
      })) || [],
      vulnerabilities: data.vulnerabilities?.map((vuln: any) => ({
        ...vuln,
        discoveredDate: new Date(vuln.discoveredDate),
        dueDate: new Date(vuln.dueDate)
      })) || [],
      dataProtection: {
        ...data.dataProtection,
        privacyRequests: data.dataProtection?.privacyRequests?.map((request: any) => ({
          ...request,
          requestDate: new Date(request.requestDate),
          completedDate: request.completedDate ? new Date(request.completedDate) : undefined,
          estimatedCompletion: request.estimatedCompletion ? new Date(request.estimatedCompletion) : undefined
        })) || []
      },
      securityTraining: {
        ...data.securityTraining,
        trainingPrograms: data.securityTraining?.trainingPrograms?.map((program: any) => ({
          ...program,
          lastUpdated: new Date(program.lastUpdated)
        })) || []
      }
    }),
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading security dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Security & Compliance Management
          </h1>
          <p className="text-gray-600 mt-1">Monitor security posture, manage compliance, and protect sensitive data</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedFramework} onValueChange={setSelectedFramework}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              <SelectItem value="soc2">SOC 2</SelectItem>
              <SelectItem value="gdpr">GDPR</SelectItem>
              <SelectItem value="ccpa">CCPA</SelectItem>
              <SelectItem value="hipaa">HIPAA</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Dialog open={showCreateIncident} onOpenChange={setShowCreateIncident}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Report Incident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Report Security Incident</DialogTitle>
                <DialogDescription>
                  Report a new security incident for investigation and response
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="incident-title">Incident Title</Label>
                    <Input id="incident-title" placeholder="Brief description of the incident" />
                  </div>
                  <div>
                    <Label htmlFor="incident-severity">Severity</Label>
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
                  <Label htmlFor="incident-description">Description</Label>
                  <Textarea id="incident-description" placeholder="Detailed description of the security incident" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateIncident(false)}>
                    Cancel
                  </Button>
                  <Button>
                    Report Incident
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {securityData && (
        <>
          {/* Security Overview KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Security Score</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(securityData.securityOverview.securityScore)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={securityData.securityOverview.securityScore} className="h-2" />
                  <p className="text-sm text-green-600 mt-1 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Excellent security posture
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(securityData.securityOverview.complianceScore)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileCheck className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={securityData.securityOverview.complianceScore} className="h-2" />
                  <p className="text-sm text-blue-600 mt-1">
                    Next audit: {format(securityData.securityOverview.nextAuditDue, 'MMM dd, yyyy')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Vulnerabilities</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {securityData.securityOverview.vulnerabilities.total}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Badge className={getSeverityColor('critical')} variant="outline">
                    {securityData.securityOverview.vulnerabilities.critical} Critical
                  </Badge>
                  <Badge className={getSeverityColor('high')} variant="outline">
                    {securityData.securityOverview.vulnerabilities.high} High
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">System Uptime</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(securityData.securityOverview.systemUptime)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Activity className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {securityData.securityOverview.resolvedIncidents} incidents resolved
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="incidents" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="incidents">Incidents</TabsTrigger>
              <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="access">Access Control</TabsTrigger>
              <TabsTrigger value="data">Data Protection</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
            </TabsList>

            <TabsContent value="incidents" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {securityData.securityIncidents.map((incident: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{incident.title}</CardTitle>
                          <CardDescription className="mt-1">{incident.description}</CardDescription>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={getSeverityColor(incident.severity)}>
                            {incident.severity}
                          </Badge>
                          <Badge className={getStatusColor(incident.status)}>
                            {getStatusIcon(incident.status)}
                            <span className="ml-1">{incident.status.replace('_', ' ')}</span>
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Reported:</span>
                            <span className="ml-2 font-medium">
                              {format(incident.reportedAt, 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Category:</span>
                            <span className="ml-2 font-medium capitalize">
                              {incident.category.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Assigned to:</span>
                            <span className="ml-2 font-medium">{incident.assignedTo}</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Affected Systems:</div>
                          <div className="flex flex-wrap gap-1">
                            {incident.affectedSystems.map((system: string, sysIdx: number) => (
                              <Badge key={sysIdx} variant="outline" className="text-xs">
                                {system}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Recent Actions:</div>
                          <div className="space-y-1">
                            {incident.actions.slice(0, 2).map((action: string, actionIdx: number) => (
                              <div key={actionIdx} className="text-xs text-gray-700 flex items-center">
                                <div className="w-1 h-1 bg-blue-500 rounded-full mr-2"></div>
                                {action}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            ID: {incident.id}
                          </div>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>

                        {incident.estimatedResolution && (
                          <div className="text-xs text-blue-600">
                            Est. resolution: {format(incident.estimatedResolution, 'MMM dd, HH:mm')}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="vulnerabilities" className="space-y-6">
              <div className="space-y-4">
                {securityData.vulnerabilities.map((vuln: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{vuln.title}</h3>
                            <Badge className={getSeverityColor(vuln.severity)}>
                              {vuln.severity} (CVSS {vuln.cvss})
                            </Badge>
                          </div>
                          <p className="text-gray-600 text-sm">{vuln.description}</p>
                        </div>
                        <Badge className={getStatusColor(vuln.status)} variant="outline">
                          {vuln.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Affected Assets:</div>
                          <div className="space-y-1">
                            {vuln.affectedAssets.map((asset: string, assetIdx: number) => (
                              <div key={assetIdx} className="text-sm font-medium">{asset}</div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Timeline:</div>
                          <div className="space-y-1 text-sm">
                            <div>Discovered: {format(vuln.discoveredDate, 'MMM dd, yyyy')}</div>
                            <div>Due: {format(vuln.dueDate, 'MMM dd, yyyy')}</div>
                            <div>Assigned: {vuln.assignedTo}</div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Remediation:</div>
                          <div className="text-sm">{vuln.remediation}</div>
                          <div className="text-xs text-orange-600 mt-2">
                            <strong>Impact:</strong> {vuln.businessImpact}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {securityData.complianceStatus.map((compliance: any, idx: number) => (
                  <Card key={idx}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <FileCheck className="h-5 w-5" />
                          {compliance.framework}
                        </CardTitle>
                        <Badge className={getStatusColor(compliance.status)}>
                          {getStatusIcon(compliance.status)}
                          <span className="ml-1">{compliance.status}</span>
                        </Badge>
                      </div>
                      <CardDescription>
                        Compliance score: {formatPercentage(compliance.score)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Overall Compliance</span>
                            <span className="text-sm font-medium">{formatPercentage(compliance.score)}</span>
                          </div>
                          <Progress value={compliance.score} className="h-2" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Last Audit:</span>
                            <div className="font-medium">{format(compliance.lastAudit, 'MMM dd, yyyy')}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Next Audit:</span>
                            <div className="font-medium">{format(compliance.nextAudit, 'MMM dd, yyyy')}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Findings:</span>
                            <div className="font-medium">{compliance.findings} open</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Remediated:</span>
                            <div className="font-medium">{compliance.remediated} fixed</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Requirements Status:</div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="text-center p-2 bg-green-50 rounded">
                              <div className="font-bold text-green-900">{compliance.requirements.implemented}</div>
                              <div className="text-green-600">Implemented</div>
                            </div>
                            <div className="text-center p-2 bg-yellow-50 rounded">
                              <div className="font-bold text-yellow-900">{compliance.requirements.pending}</div>
                              <div className="text-yellow-600">Pending</div>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <div className="font-bold text-gray-900">{compliance.requirements.notApplicable}</div>
                              <div className="text-gray-600">N/A</div>
                            </div>
                            <div className="text-center p-2 bg-blue-50 rounded">
                              <div className="font-bold text-blue-900">{compliance.requirements.total}</div>
                              <div className="text-blue-600">Total</div>
                            </div>
                          </div>
                        </div>

                        <Button variant="outline" className="w-full">
                          <Download className="h-4 w-4 mr-2" />
                          Generate Report
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="access" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* User Accounts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Accounts
                    </CardTitle>
                    <CardDescription>Account status and management</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Accounts</span>
                        <span className="font-bold">{securityData.accessControl.userAccounts.total}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Active</span>
                          <span className="text-sm font-medium text-green-600">
                            {securityData.accessControl.userAccounts.active}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Inactive</span>
                          <span className="text-sm font-medium text-gray-600">
                            {securityData.accessControl.userAccounts.inactive}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Privileged</span>
                          <span className="text-sm font-medium text-orange-600">
                            {securityData.accessControl.userAccounts.privileged}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Service Accounts</span>
                          <span className="text-sm font-medium text-blue-600">
                            {securityData.accessControl.userAccounts.serviceAccounts}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Permissions & Roles */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Permissions & Roles
                    </CardTitle>
                    <CardDescription>Role assignments and permissions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Roles</span>
                        <span className="font-bold">{securityData.accessControl.permissions.totalRoles}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Custom Roles</span>
                          <span className="text-sm font-medium">
                            {securityData.accessControl.permissions.customRoles}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Role Assignments</span>
                          <span className="text-sm font-medium">
                            {securityData.accessControl.permissions.roleAssignments}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Excessive Privileges</span>
                          <span className="text-sm font-medium text-orange-600">
                            {securityData.accessControl.permissions.excessivePrivileges}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Unused Permissions</span>
                          <span className="text-sm font-medium text-gray-600">
                            {securityData.accessControl.permissions.unusedPermissions}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Authentication */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Authentication
                    </CardTitle>
                    <CardDescription>Authentication methods and security</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">MFA Enabled</span>
                          <span className="text-sm font-medium text-green-600">
                            {securityData.accessControl.authentication.mfaEnabled}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">MFA Disabled</span>
                          <span className="text-sm font-medium text-red-600">
                            {securityData.accessControl.authentication.mfaDisabled}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">SSO Users</span>
                          <span className="text-sm font-medium text-blue-600">
                            {securityData.accessControl.authentication.ssoUsers}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Passwords Expiring</span>
                          <span className="text-sm font-medium text-yellow-600">
                            {securityData.accessControl.authentication.passwordExpiring}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Accounts Locked</span>
                          <span className="text-sm font-medium text-red-600">
                            {securityData.accessControl.authentication.accountsLocked}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Data Classification */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Data Classification
                    </CardTitle>
                    <CardDescription>Classification of data assets by sensitivity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-gray-900">
                          {securityData.dataProtection.dataClassification.total.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Records</div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                          <span className="font-medium text-green-800">Public</span>
                          <span className="font-bold text-green-900">
                            {securityData.dataProtection.dataClassification.public.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                          <span className="font-medium text-blue-800">Internal</span>
                          <span className="font-bold text-blue-900">
                            {securityData.dataProtection.dataClassification.internal.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <span className="font-medium text-yellow-800">Confidential</span>
                          <span className="font-bold text-yellow-900">
                            {securityData.dataProtection.dataClassification.confidential.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
                          <span className="font-medium text-red-800">Restricted</span>
                          <span className="font-bold text-red-900">
                            {securityData.dataProtection.dataClassification.restricted.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Privacy Requests */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Privacy Requests
                    </CardTitle>
                    <CardDescription>Data subject rights and privacy requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {securityData.dataProtection.privacyRequests.map((request: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-sm">{request.id}</div>
                            <Badge className={getStatusColor(request.status)} variant="outline">
                              {request.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>
                              <strong>Type:</strong> {request.type.replace('_', ' ')}
                            </div>
                            <div>
                              <strong>Subject:</strong> {request.dataSubject}
                            </div>
                            <div>
                              <strong>Requested:</strong> {format(request.requestDate, 'MMM dd, yyyy')}
                            </div>
                            {request.completedDate && (
                              <div>
                                <strong>Completed:</strong> {format(request.completedDate, 'MMM dd, yyyy')}
                              </div>
                            )}
                            {request.estimatedCompletion && !request.completedDate && (
                              <div>
                                <strong>Est. Completion:</strong> {format(request.estimatedCompletion, 'MMM dd, yyyy')}
                              </div>
                            )}
                            {request.responseTime && (
                              <div>
                                <strong>Response Time:</strong> {request.responseTime}h
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Data Retention */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Data Retention Management
                  </CardTitle>
                  <CardDescription>Data retention policies and compliance status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-900">
                        {securityData.dataProtection.dataRetention.policiesActive}
                      </div>
                      <div className="text-sm text-gray-600">Active Policies</div>
                      <div className="text-xs text-gray-500 mt-1">
                        of {securityData.dataProtection.dataRetention.policiesTotal} total
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-900">
                        {formatPercentage(securityData.dataProtection.dataRetention.retentionCompliant)}
                      </div>
                      <div className="text-sm text-gray-600">Compliance Rate</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {securityData.dataProtection.dataRetention.retentionViolations} violations
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-900">
                        {securityData.dataProtection.dataRetention.recordsScheduledDeletion.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Scheduled for Deletion</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {securityData.dataProtection.dataRetention.recordsDeleted.toLocaleString()} deleted this period
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="training" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Training Programs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Security Training Programs
                    </CardTitle>
                    <CardDescription>Employee security awareness and training</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {securityData.securityTraining.trainingPrograms.map((program: any, idx: number) => (
                        <div key={idx} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{program.program}</div>
                            <Badge variant="outline">
                              {formatPercentage(program.completionRate)}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-gray-500">Participants:</span>
                              <div className="font-medium">{program.participants}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Completed:</span>
                              <div className="font-medium text-green-600">{program.completed}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Avg Score:</span>
                              <div className="font-medium">{formatPercentage(program.averageScore)}</div>
                            </div>
                          </div>
                          
                          <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-600">Progress</span>
                              <span className="text-xs font-medium">{program.completed}/{program.participants}</span>
                            </div>
                            <Progress value={program.completionRate} className="h-2" />
                          </div>
                          
                          <div className="text-xs text-gray-500">
                            Last updated: {format(program.lastUpdated, 'MMM dd, yyyy')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Phishing Simulations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Phishing Simulations
                    </CardTitle>
                    <CardDescription>Phishing awareness test results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded">
                          <div className="text-xl font-bold text-blue-900">
                            {securityData.securityTraining.phishingSimulations.totalCampaigns}
                          </div>
                          <div className="text-sm text-blue-600">Total Campaigns</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded">
                          <div className="text-xl font-bold text-blue-900">
                            {securityData.securityTraining.phishingSimulations.totalEmails}
                          </div>
                          <div className="text-sm text-blue-600">Emails Sent</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-red-50 border border-red-200 rounded">
                          <div className="text-xl font-bold text-red-900">
                            {formatPercentage(securityData.securityTraining.phishingSimulations.clickRate)}
                          </div>
                          <div className="text-sm text-red-600">Click Rate</div>
                          <div className="text-xs text-red-500 mt-1">
                            {securityData.securityTraining.phishingSimulations.clicked} clicked
                          </div>
                        </div>
                        <div className="text-center p-3 bg-green-50 border border-green-200 rounded">
                          <div className="text-xl font-bold text-green-900">
                            {formatPercentage(securityData.securityTraining.phishingSimulations.reportRate)}
                          </div>
                          <div className="text-sm text-green-600">Report Rate</div>
                          <div className="text-xs text-green-500 mt-1">
                            {securityData.securityTraining.phishingSimulations.reported} reported
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 border border-green-200 rounded text-center">
                        <div className="flex items-center justify-center gap-2 text-green-800">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-medium">
                            Improvement Trend: {securityData.securityTraining.phishingSimulations.improvementTrend}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}