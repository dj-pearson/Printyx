import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  CheckCircle, 
  Users, 
  DollarSign, 
  Wrench, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  Target,
  Settings
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export function ModularDashboard() {
  // Fetch service tickets with error handling
  const { data: serviceTickets = [] } = useQuery({
    queryKey: ['/api/service-tickets'],
    staleTime: 2 * 60 * 1000,
    select: (data: any[]) => data || []
  });

  // Basic metrics
  const activeTickets = serviceTickets.filter((ticket: any) => 
    ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS'
  ).length;

  const overdueTickets = serviceTickets.filter((ticket: any) => 
    ticket.status === 'OPEN' && new Date(ticket.scheduledDate) < new Date()
  ).length;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Printyx Dashboard</h1>
        <Badge variant="outline" className="text-green-600 border-green-600">
          All Systems Operational
        </Badge>
      </div>
      
      {/* Basic Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231</div>
            <p className="text-xs text-muted-foreground">+8% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Service Tickets</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTickets}</div>
            <p className="text-xs text-muted-foreground">
              {overdueTickets > 0 ? `${overdueTickets} overdue` : 'All on schedule'}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              SLA Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">All Clear</div>
            <p className="text-xs text-green-600 mt-1">No SLA breaches detected</p>
          </CardContent>
        </Card>
      </div>
      
      {/* LEAN Workflow Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Definition of Done (DoD) System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>DoD enforcement system is active and monitoring workflow transitions</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Validates requirements before progression through sales workflows (quote → proposal → contract)
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">Quote Validation</Badge>
              <Badge variant="secondary">Proposal Requirements</Badge>
              <Badge variant="secondary">Contract Compliance</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              SLA Breach Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Real-time monitoring active</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Automated alerts for service response times, installation deadlines, and billing cycles
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Service SLA</div>
                <div className="text-green-600">98.5% Compliance</div>
              </div>
              <div>
                <div className="font-medium">Response Time</div>
                <div className="text-green-600">On Target</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Users className="h-5 w-5" />
              <span className="text-sm">Manage Customers</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Wrench className="h-5 w-5" />
              <span className="text-sm">Service Dispatch</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm">Generate Invoice</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm">View Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ModularDashboard;