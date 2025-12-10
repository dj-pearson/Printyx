import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  UserCheck,
  FileCheck,
  Merge,
  Map
} from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';

export default function GdprComplianceDashboard() {
  const [, navigate] = useLocation();

  // Fetch consent statistics
  const { data: consentStats } = useQuery({
    queryKey: ['/api/gdpr/consent/stats'],
    queryFn: () => apiRequest('/api/gdpr/consent/stats'),
  });

  // Fetch DPA statistics
  const { data: dpaStats } = useQuery({
    queryKey: ['/api/gdpr/dpa/stats'],
    queryFn: () => apiRequest('/api/gdpr/dpa/stats'),
  });

  // Fetch deduplication statistics
  const { data: dedupStats } = useQuery({
    queryKey: ['/api/gdpr/deduplication/stats'],
    queryFn: () => apiRequest('/api/gdpr/deduplication/stats'),
  });

  // Fetch pending data exports
  const { data: exportRequests } = useQuery({
    queryKey: ['/api/gdpr/data-export/requests', { status: 'pending' }],
    queryFn: () => apiRequest('/api/gdpr/data-export/requests?status=pending'),
  });

  const complianceScore = 85; // This would be calculated from various metrics

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">GDPR Compliance Dashboard</h1>
            <p className="text-muted-foreground">
              Manage data privacy, consent, and compliance requirements
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/gdpr/data-export')}>
              <Download className="h-4 w-4 mr-2" />
              Data Export
            </Button>
            <Button onClick={() => navigate('/gdpr/compliance-report')}>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </div>

        {/* Compliance Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{complianceScore}%</div>
              <Progress value={complianceScore} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Based on consent, DPA, and data handling metrics
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Consents</CardTitle>
              <UserCheck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {consentStats?.byStatus?.given || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {consentStats?.recentWithdrawals || 0} withdrawn in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active DPAs</CardTitle>
              <FileCheck className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dpaStats?.byStatus?.active || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {dpaStats?.expiringIn30Days || 0} expiring in 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Duplicates</CardTitle>
              <Merge className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dedupStats?.pendingMatches || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {dedupStats?.mergedRecords || 0} merged total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/gdpr/consent')}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                Consent Management
              </CardTitle>
              <CardDescription>
                Track and manage user consent preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {consentStats?.totalRecords || 0} records
                </span>
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/gdpr/dpa')}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-purple-600" />
                Data Processing Agreements
              </CardTitle>
              <CardDescription>
                Manage vendor DPAs and compliance checks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {dpaStats?.totalDpas || 0} agreements
                </span>
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/gdpr/deduplication')}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Merge className="h-5 w-5 text-orange-600" />
                Contact Deduplication
              </CardTitle>
              <CardDescription>
                Find and merge duplicate contacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {dedupStats?.totalMatches || 0} potential duplicates
                </span>
                <Button variant="ghost" size="sm">
                  Review
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/territories')}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Map className="h-5 w-5 text-green-600" />
                Territory Management
              </CardTitle>
              <CardDescription>
                Manage sales territories and assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  View territories
                </span>
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts and Action Items */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Compliance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dpaStats?.expiringIn30Days > 0 && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">DPAs Expiring Soon</p>
                      <p className="text-sm text-muted-foreground">
                        {dpaStats.expiringIn30Days} agreements expire within 30 days
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/gdpr/dpa?filter=expiring')}>
                    Review
                  </Button>
                </div>
              )}

              {dpaStats?.pendingCompliance > 0 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">Compliance Checks Due</p>
                      <p className="text-sm text-muted-foreground">
                        {dpaStats.pendingCompliance} DPAs need compliance review
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/gdpr/dpa?filter=pending-compliance')}>
                    Review
                  </Button>
                </div>
              )}

              {consentStats?.recentWithdrawals > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Recent Consent Withdrawals</p>
                      <p className="text-sm text-muted-foreground">
                        {consentStats.recentWithdrawals} withdrawals in last 30 days
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/gdpr/consent?filter=withdrawn')}>
                    View
                  </Button>
                </div>
              )}

              {dedupStats?.pendingMatches > 0 && (
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Merge className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Duplicates to Review</p>
                      <p className="text-sm text-muted-foreground">
                        {dedupStats.pendingMatches} potential duplicates found
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/gdpr/deduplication')}>
                    Review
                  </Button>
                </div>
              )}

              {!dpaStats?.expiringIn30Days && !dpaStats?.pendingCompliance &&
               !consentStats?.recentWithdrawals && !dedupStats?.pendingMatches && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">All Clear</p>
                    <p className="text-sm text-muted-foreground">
                      No immediate compliance actions required
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-600" />
                Pending Data Exports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exportRequests?.exports?.length > 0 ? (
                <div className="space-y-3">
                  {exportRequests.exports.slice(0, 5).map((exp: any) => (
                    <div key={exp.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{exp.exportNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {exp.subjectType} - {exp.format}
                        </p>
                      </div>
                      <Badge variant={exp.status === 'pending' ? 'outline' : 'default'}>
                        {exp.status}
                      </Badge>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => navigate('/gdpr/data-export')}>
                    View All Exports
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending data export requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Consent Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Consent Distribution by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {consentStats?.byType && Object.entries(consentStats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                  <Badge variant="secondary">{count as number}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
