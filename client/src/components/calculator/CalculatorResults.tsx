import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Calendar,
  Target,
  ArrowRight,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CalculatorSession } from './types';

interface CalculatorResultsProps {
  session: CalculatorSession;
  onDownloadPDF: () => void;
  onBookDemo: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function CalculatorResults({ session, onDownloadPDF, onBookDemo }: CalculatorResultsProps) {
  const { results, recommendations } = session;

  // Prepare chart data
  const costBreakdownData = [
    { name: 'Supplies', value: results.breakdown.supplies },
    { name: 'Service', value: results.breakdown.service },
    { name: 'Energy', value: results.breakdown.energy },
    { name: 'Labor', value: results.breakdown.labor },
    { name: 'Downtime', value: results.breakdown.downtime },
  ];

  const savingsOpportunitiesData = [
    { name: 'Consolidation', value: results.savingsOpportunities.consolidation },
    { name: 'Equipment Upgrade', value: results.savingsOpportunities.upgradeEquipment },
    { name: 'Print Policies', value: results.savingsOpportunities.printPolicies },
    { name: 'Supply Management', value: results.savingsOpportunities.supplyManagement },
  ].filter(item => item.value > 0);

  const hiddenCostsData = [
    { name: 'Supply Waste', value: results.hiddenCosts.supplyWaste },
    { name: 'Labor Cost', value: results.hiddenCosts.laborCost },
    { name: 'Downtime', value: results.hiddenCosts.downtimeCost },
    { name: 'Energy', value: results.hiddenCosts.energyCost },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Your Print Fleet Analysis</h1>
        <p className="text-gray-600">Here's what we discovered about your print costs</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Annual Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(results.annualTCO)}</div>
            <p className="text-sm text-gray-500 mt-1">Total cost of ownership</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Cost Per Page</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${results.costPerPageBW.toFixed(3)}</div>
            <p className="text-sm text-gray-500 mt-1">Black & White (Color: ${results.costPerPageColor.toFixed(3)})</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Potential Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(results.savingsOpportunities.total)}
            </div>
            <p className="text-sm text-gray-500 mt-1">Annual savings opportunity</p>
          </CardContent>
        </Card>
      </div>

      {/* Industry Benchmark Alert */}
      {results.benchmarking.percentageAboveIndustry > 10 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>You're spending {formatPercentage(results.benchmarking.percentageAboveIndustry)} more than industry average!</strong>
            <br />
            Companies in your industry typically spend {formatCurrency(results.benchmarking.industryAverageCostPerEmployee)} per employee annually.
            You're at {formatCurrency(results.benchmarking.costPerEmployee)} per employee.
          </AlertDescription>
        </Alert>
      )}

      {/* Utilization Score */}
      {results.benchmarking.utilizationScore < 60 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Target className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Fleet Utilization: {results.benchmarking.utilizationScore}%</strong>
            <br />
            Your devices are underutilized. Consolidating your fleet could reduce costs without impacting productivity.
          </AlertDescription>
        </Alert>
      )}

      {/* Cost Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Annual Cost Breakdown</CardTitle>
          <CardDescription>Where your print budget is going</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {costBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            {costBreakdownData.map((item, index) => (
              <div key={item.name} className="text-center">
                <div
                  className="w-4 h-4 rounded-full mx-auto mb-1"
                  style={{ backgroundColor: COLORS[index] }}
                />
                <div className="text-xs font-medium">{item.name}</div>
                <div className="text-sm font-bold">{formatCurrency(item.value)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hidden Costs */}
      <Card>
        <CardHeader>
          <CardTitle>Hidden Costs Revealed</CardTitle>
          <CardDescription>Costs you might not be tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hiddenCostsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Savings Opportunities */}
      {savingsOpportunitiesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Savings Opportunities</CardTitle>
            <CardDescription>Actionable ways to reduce costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={savingsOpportunitiesData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Bar dataKey="value" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Recommended Actions</h2>

        {recommendations.map((rec, index) => (
          <Card key={index} className={rec.priority === 'high' ? 'border-orange-300' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {rec.title}
                    {rec.priority === 'high' && (
                      <Badge variant="destructive">High Priority</Badge>
                    )}
                    {rec.priority === 'medium' && (
                      <Badge variant="secondary">Medium Priority</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">{rec.description}</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Potential Savings</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(rec.savings)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-medium text-sm">Action Steps:</div>
                <ul className="space-y-1">
                  {rec.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTAs */}
      <div className="grid md:grid-cols-2 gap-4 mt-8">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Complete Report
            </CardTitle>
            <CardDescription>
              Get a comprehensive 12-page PDF with device-level analysis, implementation roadmap, and ROI calculator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onDownloadPDF} className="w-full" size="lg">
              Download PDF Report
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-gray-600 mt-2 text-center">
              Includes tracking spreadsheet & RFP template
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              See Your Real-Time Data
            </CardTitle>
            <CardDescription>
              Book a 15-minute demo to see how Printyx tracks these costs automatically with real-time monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBookDemo} className="w-full" size="lg" variant="default">
              Book Free Demo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-gray-600 mt-2 text-center">
              30-day free trial • No credit card required
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Social Proof */}
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <div className="max-w-2xl mx-auto">
          <p className="text-lg font-medium mb-2">
            "We identified $47K in annual savings in just one week using Printyx"
          </p>
          <p className="text-gray-600">
            — Sarah Johnson, IT Director at Regional Law Firm (120 employees)
          </p>
          <div className="flex justify-center gap-8 mt-6 text-sm text-gray-500">
            <div>
              <div className="font-bold text-2xl text-blue-600">892</div>
              <div>Companies Analyzed</div>
            </div>
            <div>
              <div className="font-bold text-2xl text-green-600">$18K</div>
              <div>Average Savings</div>
            </div>
            <div>
              <div className="font-bold text-2xl text-purple-600">32%</div>
              <div>Cost Reduction</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
