import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  Cell,
} from 'recharts';
import MainLayout from '@/components/layout/main-layout';
import {
  Users,
  TrendingUp,
  Target,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Filter,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  trial_started: 'bg-blue-100 text-blue-800',
  activated: 'bg-green-100 text-green-800',
  churned: 'bg-red-100 text-red-800',
  disqualified: 'bg-gray-100 text-gray-800',
};

const sourceColors: Record<string, string> = {
  website: 'bg-purple-100 text-purple-800',
  marketing_campaign: 'bg-pink-100 text-pink-800',
  referral: 'bg-indigo-100 text-indigo-800',
  api: 'bg-cyan-100 text-cyan-800',
  manual: 'bg-slate-100 text-slate-800',
};

export default function RootAdminSignupsCRM() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Fetch signups
  const { data: signupsData, isLoading: signupsLoading } = useQuery({
    queryKey: ['/api/root-admin/signups', statusFilter === 'all' ? '' : statusFilter, page],
  });

  // Fetch analytics
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/root-admin/signups-analytics'],
  });

  // Fetch funnel
  const { data: funnelData, isLoading: funnelLoading } = useQuery({
    queryKey: ['/api/root-admin/trial-funnel'],
  });

  // Fetch high-value signups
  const { data: highValueData } = useQuery({
    queryKey: ['/api/root-admin/high-value-signups'],
  });

  const signups = signupsData?.data || [];
  const pagination = signupsData?.pagination;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Signups & Trials CRM
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage platform signups and monitor trial engagement
            </p>
          </div>
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Signups</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData?.totalSignups || 0}</div>
              <p className="text-xs text-gray-500">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData?.conversionRate || 0}%</div>
              <p className="text-xs text-gray-500">Signup to activated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Qualification</CardTitle>
              <Target className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analyticsData?.avgQualificationScore || 0}/100
              </div>
              <p className="text-xs text-gray-500">Lead quality score</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Value</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{highValueData?.data?.length || 0}</div>
              <p className="text-xs text-gray-500">Qualified leads (70+)</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="signups" className="space-y-4">
          <TabsList>
            <TabsTrigger value="signups">All Signups</TabsTrigger>
            <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="high-value">High Value Leads</TabsTrigger>
          </TabsList>

          {/* Signups Table */}
          <TabsContent value="signups" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Platform Signups</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="trial_started">Trial Started</SelectItem>
                        <SelectItem value="activated">Activated</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Signed Up</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signupsLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4">
                            Loading...
                          </TableCell>
                        </TableRow>
                      ) : signups.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                            No signups found
                          </TableCell>
                        </TableRow>
                      ) : (
                        signups
                          .filter(
                            (signup: any) =>
                              searchQuery === '' ||
                              signup.email.toLowerCase().includes(searchQuery.toLowerCase()),
                          )
                          .map((signup: any) => (
                            <TableRow key={signup.id}>
                              <TableCell className="font-medium">{signup.companyName}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-sm">
                                    {signup.firstName} {signup.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500">{signup.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={statusColors[signup.status]}>
                                  {signup.status.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={sourceColors[signup.source] || 'bg-gray-100'}>
                                  {signup.source}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-sm">
                                  {signup.qualificationScore}/100
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(signup.createdAt), 'MMM dd')}
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm">
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-600">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                        disabled={page === pagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversion Funnel */}
          <TabsContent value="funnel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trial Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                {funnelLoading ? (
                  <div className="text-center py-8">Loading funnel data...</div>
                ) : (
                  <div className="w-full h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData?.funnel || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="stage" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Signups by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(analyticsData?.bySource || {}).map(
                        ([source, count]: [string, any]) => (
                          <div key={source} className="flex justify-between items-center">
                            <span className="text-sm capitalize">{source.replace('_', ' ')}</span>
                            <span className="font-bold">{count}</span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Signups by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="text-center py-8">Loading...</div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(analyticsData?.byStatus || {}).map(
                        ([status, count]: [string, any]) => (
                          <div key={status} className="flex justify-between items-center">
                            <span className="text-sm">
                              <Badge className={statusColors[status]}>
                                {status.replace('_', ' ')}
                              </Badge>
                            </span>
                            <span className="font-bold">{count}</span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* High Value Leads */}
          <TabsContent value="high-value" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>High Value Signups (Score 70+)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {highValueData?.data?.map((signup: any) => (
                        <TableRow key={signup.id}>
                          <TableCell className="font-medium">{signup.companyName}</TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">
                                {signup.firstName} {signup.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{signup.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-green-600">
                              {signup.qualificationScore}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[signup.status]}>
                              {signup.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {signup.lastActivityAt
                              ? format(new Date(signup.lastActivityAt), 'MMM dd, HH:mm')
                              : 'Never'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
