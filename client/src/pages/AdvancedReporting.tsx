/**
 * Advanced Reporting (round 208).
 *
 * Every figure is derived in client/src/lib/advanced-reporting.ts from real
 * columns over EVERY page of each list (client/src/lib/fetch-all-records.ts);
 * that module's header lists what the previous version got wrong. The page
 * itself only chooses a range and a customer, renders, and exports the rows of
 * the tab in view.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QueryStates } from '@/components/ui/query-state';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrency, formatPercent, percentOf } from '@/lib/utils';
import { exportToCSV, type ExportColumn } from '@/lib/export-utils';
import { fetchAllRecords, type PagingStyle } from '@/lib/fetch-all-records';
import {
  contractVolumes,
  revenueByCustomer,
  revenueByMonth,
  serviceMetrics,
  type ContractVolume,
  type CustomerRevenue,
  type MonthRevenue,
} from '@/lib/advanced-reporting';

type Row = Record<string, unknown>;

/** Each list and how it pages. */
export const SOURCES: Record<string, { path: string; style: PagingStyle }> = {
  customers: { path: '/api/customers', style: 'offset' },
  contracts: { path: '/api/contracts', style: 'page' },
  tickets: { path: '/api/service-tickets', style: 'offset' },
  invoices: { path: '/api/invoices', style: 'page' },
  readings: { path: '/api/meter-readings', style: 'page' },
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const dash = (v: number | null, f: (n: number) => string) => (v === null ? '—' : f(v));

export const REVENUE_COLUMNS: ExportColumn<MonthRevenue>[] = [
  { key: 'month', label: 'Month' },
  { key: 'revenue', label: 'Invoiced revenue' },
  { key: 'invoices', label: 'Invoices' },
];
export const CUSTOMER_COLUMNS: ExportColumn<CustomerRevenue>[] = [
  { key: 'customer', label: 'Customer' },
  { key: 'revenue', label: 'Invoiced revenue' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'invoices', label: 'Invoices' },
];
export const CONTRACT_COLUMNS: ExportColumn<ContractVolume>[] = [
  { key: 'contract', label: 'Contract' },
  { key: 'customer', label: 'Customer' },
  { key: 'monthlyBase', label: 'Monthly base' },
  { key: 'monthlyPages', label: 'Pages per month' },
  { key: 'basePerPage', label: 'Base per page' },
  { key: 'machines', label: 'Machines with readings' },
];

function useAllRecords(key: keyof typeof SOURCES) {
  const { path, style } = SOURCES[key];
  return useQuery({
    queryKey: [path, 'all-pages'],
    queryFn: () => fetchAllRecords<Row>(path, style),
  });
}

export default function AdvancedReporting() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [tab, setTab] = useState('revenue');

  const customersQuery = useAllRecords('customers');
  const contractsQuery = useAllRecords('contracts');
  const ticketsQuery = useAllRecords('tickets');
  const invoicesQuery = useAllRecords('invoices');
  const readingsQuery = useAllRecords('readings');
  const queries = [customersQuery, contractsQuery, ticketsQuery, invoicesQuery, readingsQuery];
  const truncated = queries.some((q) => q.data?.truncated);

  // The customer filter narrows every list that names a customer; it used to
  // be a select whose value nothing read.
  const forCustomer = (rows: Row[] | undefined) =>
    (rows ?? []).filter(
      (r) =>
        selectedCustomer === 'all' ||
        String(r.customer_id ?? r.customerId ?? '') === selectedCustomer,
    );

  const customers = customersQuery.data?.rows ?? [];
  const contracts = forCustomer(contractsQuery.data?.rows);
  const tickets = forCustomer(ticketsQuery.data?.rows);
  const invoices = forCustomer(invoicesQuery.data?.rows);
  const readings = readingsQuery.data?.rows ?? [];

  const revenue = useMemo(() => revenueByMonth(invoices, dateRange), [invoices, dateRange]);
  const byCustomer = useMemo(
    () => revenueByCustomer(invoices, customers, dateRange),
    [invoices, customers, dateRange],
  );
  const service = useMemo(() => serviceMetrics(tickets, dateRange), [tickets, dateRange]);
  const volumes = useMemo(
    () => contractVolumes(contracts, readings, customers),
    [contracts, readings, customers],
  );
  const totalRevenue = revenue.reduce((s, m) => s + m.revenue, 0);
  const activeContracts = contracts.filter(
    (c) => String(c.status ?? '').toLowerCase() === 'active',
  ).length;

  const exportTab = () => {
    const name = `advanced-report-${tab}`;
    if (tab === 'revenue') exportToCSV(revenue, REVENUE_COLUMNS, { filename: name });
    else if (tab === 'profitability') exportToCSV(byCustomer, CUSTOMER_COLUMNS, { filename: name });
    else if (tab === 'service')
      exportToCSV(
        service.byPriority,
        [
          { key: 'priority', label: 'Priority' },
          { key: 'count', label: 'Tickets' },
        ],
        { filename: name },
      );
    else exportToCSV(volumes, CONTRACT_COLUMNS, { filename: name });
  };

  return (
    <MainLayout
      title="Advanced Reporting & Analytics"
      description="Revenue, customers, service and contract volume from your own records"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Report Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <label className="flex-1">
                <span className="text-sm font-medium mb-2 block">Date Range</span>
                <DateRangePicker onChange={(range) => range && setDateRange(range)} />
              </label>
              <label className="w-full sm:w-48">
                <span className="text-sm font-medium mb-2 block">Customer</span>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={String(c.id)} value={String(c.id)}>
                        {String(c.company_name ?? c.companyName ?? c.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <Button variant="outline" size="sm" onClick={exportTab}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
            {truncated && (
              <p className="mt-3 text-sm text-amber-700">
                Some lists have more than 5,000 rows; figures below cover the first 5,000 of each.
              </p>
            )}
          </CardContent>
        </Card>

        <QueryStates
          queries={queries}
          loading={<DashboardSkeleton />}
          errorTitle="Could not load report data"
          className="py-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: 'Invoiced Revenue', value: formatCurrency(totalRevenue) },
              { label: 'Active Contracts', value: String(activeContracts) },
              { label: 'Service Tickets', value: String(service.totalTickets) },
              {
                label: 'Avg Resolution',
                value: dash(service.averageResolutionHours, (h) => `${h.toFixed(1)}h`),
              },
            ].map((card) => (
              <Card key={card.label}>
                <CardContent className="p-4 sm:p-6">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold">{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 h-auto sm:h-10">
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="profitability">Revenue by Customer</TabsTrigger>
              <TabsTrigger value="service">Service Performance</TabsTrigger>
              <TabsTrigger value="contracts">Contract Volume</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Invoiced Revenue</CardTitle>
                  <CardDescription>
                    By invoice date. No target is drawn: none is stored.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
                      <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profitability">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Customer</CardTitle>
                  <CardDescription>
                    Top ten by invoiced revenue in the range, with what is still unpaid. Cost and
                    margin are not shown: nothing records the cost of serving a customer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={byCustomer}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="customer" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), '']} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                      <Bar dataKey="unpaid" fill="#ffc658" name="Unpaid" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="service">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Tickets by Priority</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={service.byPriority}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ priority, count }) => `${priority}: ${count}`}
                          outerRadius={80}
                          dataKey="count"
                        >
                          {service.byPriority.map((entry, index) => (
                            <Cell key={entry.priority} fill={COLORS[index % COLORS.length]} />
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
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span>Completion rate</span>
                      <span className="font-bold">
                        {formatPercent(percentOf(service.completedTickets, service.totalTickets))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tickets raised</span>
                      <span className="font-bold">{service.totalTickets}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span className="font-bold">{service.completedTickets}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="contracts">
              <Card>
                <CardHeader>
                  <CardTitle>Contract Volume</CardTitle>
                  <CardDescription>
                    Pages per month from each machine&apos;s lifetime meter counters. A dash means
                    too few readings, or a counter that went backwards (a reset or a swapped
                    machine).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Contract</th>
                          <th className="text-left p-2">Customer</th>
                          <th className="text-right p-2">Monthly base</th>
                          <th className="text-right p-2">Pages / month</th>
                          <th className="text-right p-2">Base per page</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volumes.map((c) => (
                          <tr key={c.contract} className="border-b">
                            <td className="p-2 font-medium">{c.contract}</td>
                            <td className="p-2">{c.customer}</td>
                            <td className="p-2 text-right">
                              {dash(c.monthlyBase, formatCurrency)}
                            </td>
                            <td className="p-2 text-right">
                              {dash(c.monthlyPages, (n) => n.toLocaleString())}
                            </td>
                            <td className="p-2 text-right">
                              {dash(c.basePerPage, (n) => `$${n.toFixed(4)}`)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </QueryStates>
      </div>
    </MainLayout>
  );
}
