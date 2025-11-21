import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, DollarSign, Heart, Users, Loader } from 'lucide-react';
import { useState } from 'react';

export function ReportsHub() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const reports = [
    {
      key: 'service-sla-compliance',
      title: 'SLA Compliance Report',
      description: 'Service ticket resolution time and SLA adherence metrics',
      icon: TrendingUp,
      category: 'Service'
    },
    {
      key: 'sales-pipeline',
      title: 'Sales Pipeline Analysis',
      description: 'Pipeline value, deal velocity, and conversion rates',
      icon: BarChart3,
      category: 'Sales'
    },
    {
      key: 'revenue-recognition',
      title: 'Revenue Recognition',
      description: 'Monthly revenue, collections, and billing metrics',
      icon: DollarSign,
      category: 'Billing'
    },
    {
      key: 'customer-health',
      title: 'Customer Health Scores',
      description: 'Health scores, engagement, and at-risk customers',
      icon: Heart,
      category: 'Success'
    },
    {
      key: 'technician-utilization',
      title: 'Technician Utilization',
      description: 'Technician efficiency, hours, and productivity metrics',
      icon: Users,
      category: 'Service'
    }
  ];

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['/api/reports', selectedReport],
    enabled: !!selectedReport,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Reports Hub</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Access comprehensive business intelligence and analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Card 
              key={report.key}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedReport(report.key)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      {report.title}
                    </CardTitle>
                    <CardDescription>{report.description}</CardDescription>
                  </div>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2 py-1 rounded">
                    {report.category}
                  </span>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {selectedReport && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">
            {reports.find(r => r.key === selectedReport)?.title}
          </h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : reportData ? (
            <Card>
              <CardHeader>
                <CardTitle>Report Data</CardTitle>
              </CardHeader>
              <CardContent>
                <ReportDisplay data={reportData} reportKey={selectedReport} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ReportDisplay({ data, reportKey }: any) {
  if (reportKey === 'service-sla-compliance') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Tickets</p>
            <p className="text-2xl font-bold">{data.totalTickets}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">On Time</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{data.onTimeTickets}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Late</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.lateTickets}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Compliance %</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{data.slaCompliancePercent}%</p>
          </div>
        </div>
        
        <div className="mt-6">
          <h3 className="font-semibold mb-3">By Technician</h3>
          <div className="space-y-2">
            {data.byTechnician.map((tech: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="font-medium">{tech.technicianName}</span>
                <div className="flex gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{tech.ticketCount} tickets</span>
                  <span className="font-semibold">{tech.compliance}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (reportKey === 'sales-pipeline') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Pipeline Value</p>
            <p className="text-2xl font-bold">${(data.totalPipelineValue / 1000).toFixed(0)}K</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Deal Count</p>
            <p className="text-2xl font-bold">{data.dealCount}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Deal Value</p>
            <p className="text-2xl font-bold">${(data.averageDealValue / 1000).toFixed(0)}K</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Conversion Rate</p>
            <p className="text-2xl font-bold">{data.conversionRate}%</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold mb-3">Top Reps</h3>
          <div className="space-y-2">
            {data.topReps.map((rep: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="font-medium">{rep.repName}</span>
                <div className="flex gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{rep.dealCount} deals</span>
                  <span className="font-semibold">${(rep.pipelineValue / 1000).toFixed(0)}K</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (reportKey === 'revenue-recognition') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
            <p className="text-2xl font-bold">${(data.totalRevenue / 1000).toFixed(0)}K</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Recognized</p>
            <p className="text-2xl font-bold">${(data.recognizedRevenue / 1000).toFixed(0)}K</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Deferred</p>
            <p className="text-2xl font-bold">${(data.deferredRevenue / 1000).toFixed(0)}K</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
            <p className="text-sm font-semibold">Invoices</p>
            <p className="text-lg mt-2">Total: {data.invoiceCount}</p>
            <p className="text-lg">Paid: {data.paidInvoices}</p>
            <p className="text-lg text-red-600 dark:text-red-400">Outstanding: {data.outstandingInvoices}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
            <p className="text-sm font-semibold">Collection Rate</p>
            <p className="text-3xl font-bold mt-2">{data.collectionRate}%</p>
          </div>
        </div>
      </div>
    );
  }

  if (reportKey === 'customer-health') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Customers</p>
            <p className="text-2xl font-bold">{data.totalCustomers}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Health Score</p>
            <p className="text-2xl font-bold">{data.averageHealthScore}</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">At Risk</p>
            <p className="text-2xl font-bold">{data.atRiskCount}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Critical</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.criticalCount}</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold mb-3">At-Risk Customers</h3>
          <div className="space-y-2">
            {data.atRiskCustomers.map((cust: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="font-medium">{cust.customerName}</span>
                <div className="flex gap-4">
                  <span className="text-sm px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded">
                    {cust.riskLevel}
                  </span>
                  <span className="font-semibold">{cust.healthScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (reportKey === 'technician-utilization') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Technicians</p>
            <p className="text-2xl font-bold">{data.totalTechnicians}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Utilization</p>
            <p className="text-2xl font-bold">{data.averageUtilizationPercent}%</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Excellent</p>
            <p className="text-2xl font-bold">{data.excellentCount}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
            <p className="text-sm text-gray-600 dark:text-gray-400">Good</p>
            <p className="text-2xl font-bold">{data.goodCount}</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold mb-3">Top Technicians</h3>
          <div className="space-y-2">
            {data.byTechnician.map((tech: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <span className="font-medium">{tech.name}</span>
                <div className="flex gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{tech.ticketsCompleted} tickets</span>
                  <span className="font-semibold">{tech.utilizationPercent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <div>Report data visualization coming soon...</div>;
}
