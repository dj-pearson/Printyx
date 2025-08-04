import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Calendar,
  FileText,
  BarChart3,
  PieChartIcon,
  Download,
  Filter,
  Activity
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import type { Customer, Contract, ServiceTicket, Invoice, MeterReading } from "@shared/schema";

export default function AdvancedReporting() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<string>("revenue");

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    setDateRange(range);
  };

  // Data fetching
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: serviceTickets } = useQuery<ServiceTicket[]>({
    queryKey: ["/api/service-tickets"],
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: meterReadings } = useQuery<MeterReading[]>({
    queryKey: ["/api/meter-readings"],
  });

  // Revenue Analytics
  const getRevenueData = () => {
    if (!invoices) return [];
    
    const monthlyRevenue = invoices
      .filter(inv => {
        const invDate = new Date(inv.issueDate);
        return invDate >= dateRange.from && invDate <= dateRange.to;
      })
      .reduce((acc, inv) => {
        const month = format(new Date(inv.issueDate), 'MMM yyyy');
        acc[month] = (acc[month] || 0) + parseFloat(inv.totalAmount.toString());
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(monthlyRevenue).map(([month, amount]) => ({
      month,
      revenue: amount,
      target: amount * 1.1 // 10% growth target
    }));
  };

  // Customer Profitability Analysis
  const getCustomerProfitabilityData = () => {
    if (!customers || !contracts || !invoices) return [];

    return customers.slice(0, 10).map(customer => {
      const customerContracts = contracts.filter(c => c.customerId === customer.id);
      const customerInvoices = invoices.filter(inv => 
        customerContracts.some(contract => contract.id === inv.contractId)
      );
      
      const revenue = customerInvoices.reduce((sum, inv) => 
        sum + parseFloat(inv.totalAmount.toString()), 0
      );
      
      const serviceCost = serviceTickets
        ?.filter(ticket => ticket.customerId === customer.id)
        .reduce((sum, ticket) => sum + (parseFloat(ticket.laborHours?.toString() || '0') * 75), 0) || 0;
      
      const profit = revenue - serviceCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        customer: customer.name,
        revenue,
        serviceCost,
        profit,
        margin: Math.round(margin * 100) / 100
      };
    }).sort((a, b) => b.profit - a.profit);
  };

  // Service Performance Metrics
  const getServiceMetrics = () => {
    if (!serviceTickets) return {
      totalTickets: 0,
      completedTickets: 0,
      averageResolutionTime: 0,
      ticketsByPriority: []
    };

    const filteredTickets = serviceTickets.filter(ticket => {
      const ticketDate = new Date(ticket.createdAt);
      return ticketDate >= dateRange.from && ticketDate <= dateRange.to;
    });

    const completedTickets = filteredTickets.filter(t => t.status === 'completed');
    
    const resolutionTimes = completedTickets
      .filter(t => t.resolvedAt)
      .map(t => {
        const created = new Date(t.createdAt);
        const resolved = new Date(t.resolvedAt!);
        return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
      });

    const averageResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length 
      : 0;

    const ticketsByPriority = ['low', 'medium', 'high', 'urgent'].map(priority => ({
      priority: priority.charAt(0).toUpperCase() + priority.slice(1),
      count: filteredTickets.filter(t => t.priority === priority).length
    }));

    return {
      totalTickets: filteredTickets.length,
      completedTickets: completedTickets.length,
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
      ticketsByPriority
    };
  };

  // Contract Performance
  const getContractPerformance = () => {
    if (!contracts || !meterReadings) return [];

    return contracts.slice(0, 8).map(contract => {
      const contractReadings = meterReadings.filter(r => r.contractId === contract.id);
      const totalCopies = contractReadings.reduce((sum, r) => 
        sum + (r.blackCopies || 0) + (r.colorCopies || 0), 0
      );
      
      const monthlyAverage = totalCopies / Math.max(contractReadings.length, 1);
      const contractValue = parseFloat(contract.monthlyValue?.toString() || '0');

      return {
        contract: contract.contractNumber,
        customer: customers?.find(c => c.id === contract.customerId)?.name || 'Unknown',
        monthlyValue: contractValue,
        totalCopies,
        monthlyAverage: Math.round(monthlyAverage),
        cpc: totalCopies > 0 ? contractValue / totalCopies : 0
      };
    });
  };

  const revenueData = getRevenueData();
  const profitabilityData = getCustomerProfitabilityData();
  const serviceMetrics = getServiceMetrics();
  const contractData = getContractPerformance();

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <MainLayout 
      title="Advanced Reporting & Analytics" 
      description="Comprehensive business intelligence and performance metrics"
    >
      <div className="space-y-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Report Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <DateRangePicker
                  onDateRangeChange={handleDateRangeChange}
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="text-sm font-medium mb-2 block">Customer</label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  More Filters
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    ${revenueData.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Active Contracts</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {contracts?.filter(c => c.status === 'active').length || 0}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Service Tickets</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {serviceMetrics.totalTickets}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Resolution Time</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {serviceMetrics.averageResolutionTime.toFixed(1)}h
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Tabs */}
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 h-auto sm:h-10">
            <TabsTrigger value="revenue" className="text-xs sm:text-sm">Revenue Analytics</TabsTrigger>
            <TabsTrigger value="profitability" className="text-xs sm:text-sm">Customer Profitability</TabsTrigger>
            <TabsTrigger value="service" className="text-xs sm:text-sm">Service Performance</TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs sm:text-sm">Contract Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue Trend</CardTitle>
                <CardDescription>Revenue performance vs targets over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} name="Actual Revenue" />
                    <Line type="monotone" dataKey="target" stroke="#82ca9d" strokeWidth={2} strokeDasharray="5 5" name="Target Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profitability" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Profitability Analysis</CardTitle>
                <CardDescription>Revenue, costs, and profit margins by customer</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={profitabilityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="customer" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                    <Bar dataKey="serviceCost" fill="#82ca9d" name="Service Cost" />
                    <Bar dataKey="profit" fill="#ffc658" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tickets by Priority</CardTitle>
                  <CardDescription>Distribution of service ticket priorities</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={serviceMetrics.ticketsByPriority}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ priority, count }) => `${priority}: ${count}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {serviceMetrics.ticketsByPriority.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Metrics</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Completion Rate</span>
                    <span className="text-lg font-bold">
                      {serviceMetrics.totalTickets > 0 
                        ? Math.round((serviceMetrics.completedTickets / serviceMetrics.totalTickets) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Tickets</span>
                    <span className="text-lg font-bold">{serviceMetrics.totalTickets}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Completed</span>
                    <span className="text-lg font-bold">{serviceMetrics.completedTickets}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Avg Resolution</span>
                    <span className="text-lg font-bold">{serviceMetrics.averageResolutionTime.toFixed(1)}h</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contracts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contract Performance</CardTitle>
                <CardDescription>Monthly value and usage analysis by contract</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Contract</th>
                        <th className="text-left p-2">Customer</th>
                        <th className="text-right p-2">Monthly Value</th>
                        <th className="text-right p-2">Total Copies</th>
                        <th className="text-right p-2">Monthly Avg</th>
                        <th className="text-right p-2">CPC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractData.map((contract) => (
                        <tr key={contract.contract} className="border-b">
                          <td className="p-2 font-medium">{contract.contract}</td>
                          <td className="p-2">{contract.customer}</td>
                          <td className="p-2 text-right">${contract.monthlyValue.toLocaleString()}</td>
                          <td className="p-2 text-right">{contract.totalCopies.toLocaleString()}</td>
                          <td className="p-2 text-right">{contract.monthlyAverage.toLocaleString()}</td>
                          <td className="p-2 text-right">${contract.cpc.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}