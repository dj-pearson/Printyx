import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MainLayout from '@/components/layout/main-layout';
import {
  Brain,
  Users,
  UserPlus,
  AlertTriangle,
  Wrench,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  TrendingDown,
  Gauge,
} from 'lucide-react';
import { format } from 'date-fns';

// CRMX-001: This dashboard previously rendered fabricated ("mock") AI/ML
// metrics. It now shows ONLY real, tenant-scoped data. Capabilities without a
// backing data pipeline are shown as an explicit "Preview" state rather than
// fake numbers. The API (`/api/ai-analytics/dashboard`) returns an
// `availability` map describing which sections are live.

interface ChurnCustomer {
  customerId: string;
  companyName: string;
  score: number;
  band: string;
  churnProbability: number;
  contractValue: number;
  reasons: string[];
}

interface MaintenanceAlert {
  machineId: string;
  confidence: number;
  predictedFailureDate: string | null;
  contractValue: number;
  status: string;
  suggestedParts: string[];
}

interface AiAnalyticsResponse {
  generatedAt: string;
  availability: Record<string, boolean>;
  overview: {
    customersCount: number;
    leadsCount: number;
    atRiskCustomers: number;
    equipmentMonitored: number;
  };
  churn: {
    available: boolean;
    totalAnalyzed: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    customers: ChurnCustomer[];
  };
  predictiveMaintenance: {
    available: boolean;
    equipmentMonitored: number;
    predictedFailures: number;
    accuracyRate: number | null;
    alerts: MaintenanceAlert[];
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const bandBadge = (band: string) => {
  switch (band) {
    case 'at_risk':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'watch':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-green-100 text-green-800 border-green-200';
  }
};

const bandLabel = (band: string) =>
  band === 'at_risk' ? 'At risk' : band === 'watch' ? 'Watch' : 'Healthy';

function PreviewNotice({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-10 text-center">
        <Sparkles className="h-8 w-8 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="mt-2">
          <Badge variant="secondary">Preview — not yet available</Badge>
        </div>
        <p className="text-sm text-gray-500 mt-3 max-w-md mx-auto">{description}</p>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${accent}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIAnalyticsDashboard() {
  const { data, isLoading, isError, refetch } = useQuery<AiAnalyticsResponse>({
    queryKey: ['/api/ai-analytics/dashboard'],
    refetchInterval: 300000, // 5 minutes
  });

  return (
    <MainLayout
      title="AI-Powered Analytics & Intelligence"
      description="Real machine-learning signals from your tenant data. Sections without a live data pipeline are clearly marked as preview."
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Live
          </Badge>
          <span>backed by real data</span>
          <span className="mx-1">·</span>
          <Badge variant="secondary">Preview</Badge>
          <span>capability not yet active</span>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading AI analytics…</p>
          </div>
        </div>
      )}

      {isError && !isLoading && (
        <Card>
          <CardContent className="p-10 text-center text-gray-600">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            Could not load AI analytics. Please try again.
          </CardContent>
        </Card>
      )}

      {data && !isLoading && (
        <>
          {/* Real overview counts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <KpiCard
              label="Customers"
              value={data.overview.customersCount.toLocaleString()}
              icon={Users}
              accent="bg-blue-100 text-blue-600"
            />
            <KpiCard
              label="Leads"
              value={data.overview.leadsCount.toLocaleString()}
              icon={UserPlus}
              accent="bg-purple-100 text-purple-600"
            />
            <KpiCard
              label="At-Risk Customers"
              value={data.overview.atRiskCustomers.toLocaleString()}
              icon={ShieldAlert}
              accent="bg-red-100 text-red-600"
            />
            <KpiCard
              label="Equipment Monitored"
              value={data.overview.equipmentMonitored.toLocaleString()}
              icon={Wrench}
              accent="bg-emerald-100 text-emerald-600"
            />
          </div>

          <Tabs defaultValue="churn" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="churn">
                Churn Risk
                {data.churn.available && (
                  <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">Live</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="maintenance">
                Predictive Maintenance
                {data.predictiveMaintenance.available && (
                  <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">Live</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="forecasting">Sales Forecasting</TabsTrigger>
              <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              <TabsTrigger value="models">Model Performance</TabsTrigger>
            </TabsList>

            {/* ---- Churn (LIVE) ---- */}
            <TabsContent value="churn" className="space-y-4">
              {!data.churn.available ? (
                <Card>
                  <CardContent className="p-10 text-center text-gray-600">
                    <Brain className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900">No churn scores yet</h3>
                    <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                      Run churn scoring to populate risk analysis. Scores are computed from real
                      service, billing, meter, and contract signals.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <KpiCard
                      label="Customers Analyzed"
                      value={data.churn.totalAnalyzed.toLocaleString()}
                      icon={Users}
                      accent="bg-blue-100 text-blue-600"
                    />
                    <KpiCard
                      label="High Risk"
                      value={data.churn.highRisk.toLocaleString()}
                      icon={ShieldAlert}
                      accent="bg-red-100 text-red-600"
                    />
                    <KpiCard
                      label="Watch"
                      value={data.churn.mediumRisk.toLocaleString()}
                      icon={AlertTriangle}
                      accent="bg-amber-100 text-amber-600"
                    />
                    <KpiCard
                      label="Healthy"
                      value={data.churn.lowRisk.toLocaleString()}
                      icon={TrendingDown}
                      accent="bg-green-100 text-green-600"
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Highest-priority accounts (risk × contract value)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.churn.customers.length === 0 && (
                        <p className="text-sm text-gray-500">No scored accounts.</p>
                      )}
                      {data.churn.customers.map((c) => (
                        <div
                          key={c.customerId}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-lg"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{c.companyName}</span>
                              <Badge variant="outline" className={bandBadge(c.band)}>
                                {bandLabel(c.band)}
                              </Badge>
                            </div>
                            {c.reasons.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {c.reasons.slice(0, 3).map((r, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {r}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Risk</div>
                              <div className="font-semibold">
                                {formatPercent(c.churnProbability)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Contract</div>
                              <div className="font-semibold">{formatCurrency(c.contractValue)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ---- Predictive maintenance (LIVE) ---- */}
            <TabsContent value="maintenance" className="space-y-4">
              {!data.predictiveMaintenance.available ? (
                <Card>
                  <CardContent className="p-10 text-center text-gray-600">
                    <Wrench className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900">No failure predictions yet</h3>
                    <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                      Predictive maintenance activates once the failure-prediction agent has scored
                      your fleet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiCard
                      label="Equipment Monitored"
                      value={data.predictiveMaintenance.equipmentMonitored.toLocaleString()}
                      icon={Wrench}
                      accent="bg-emerald-100 text-emerald-600"
                    />
                    <KpiCard
                      label="Open Predicted Failures"
                      value={data.predictiveMaintenance.predictedFailures.toLocaleString()}
                      icon={AlertTriangle}
                      accent="bg-amber-100 text-amber-600"
                    />
                    <KpiCard
                      label="Model Accuracy"
                      value={
                        data.predictiveMaintenance.accuracyRate === null
                          ? 'Not enough data'
                          : `${data.predictiveMaintenance.accuracyRate}%`
                      }
                      icon={Gauge}
                      accent="bg-blue-100 text-blue-600"
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Open failure alerts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.predictiveMaintenance.alerts.length === 0 && (
                        <p className="text-sm text-gray-500">No open alerts.</p>
                      )}
                      {data.predictiveMaintenance.alerts.map((a, i) => (
                        <div
                          key={`${a.machineId}-${i}`}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-lg"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">Machine {a.machineId}</span>
                              <Badge variant="outline">{a.status}</Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {a.predictedFailureDate
                                ? `Predicted window from ${format(new Date(a.predictedFailureDate), 'MMM dd, yyyy')}`
                                : 'No predicted window'}
                              {a.suggestedParts.length > 0 &&
                                ` · Parts: ${a.suggestedParts.slice(0, 3).join(', ')}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Confidence</div>
                              <div className="font-semibold">{formatPercent(a.confidence)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Contract</div>
                              <div className="font-semibold">{formatCurrency(a.contractValue)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ---- Preview-only capabilities (no fabricated data) ---- */}
            <TabsContent value="forecasting">
              <PreviewNotice
                title="AI Sales Forecasting"
                description="Probability-weighted revenue forecasting with confidence intervals is on the roadmap. Live pipeline forecasting is available today on the Sales Pipeline Forecasting page."
              />
            </TabsContent>
            <TabsContent value="sentiment">
              <PreviewNotice
                title="Customer Sentiment (NLP)"
                description="Sentiment analysis requires inbound email/conversation ingestion, which isn't connected yet. No sentiment scores are shown until that pipeline lands."
              />
            </TabsContent>
            <TabsContent value="recommendations">
              <PreviewNotice
                title="Personalized Recommendations"
                description="A per-customer product recommendation engine is not yet built. Lead scoring and the deal-desk copilot provide real AI guidance today."
              />
            </TabsContent>
            <TabsContent value="models">
              <PreviewNotice
                title="Model Performance Registry"
                description="A model registry with accuracy/precision/recall tracking will appear here once models are formally deployed and versioned."
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </MainLayout>
  );
}
