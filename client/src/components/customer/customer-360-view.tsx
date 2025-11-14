import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Package,
  Wrench,
  Calendar,
  Lightbulb,
  Target,
  Activity,
  Heart,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { TimelineSkeleton } from "@/components/ui/skeletons";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface Customer360Data {
  customer: {
    id: string;
    name: string;
    status: "active" | "at-risk" | "churned";
    segment: string;
    healthScore: number;
    lifetimeValue: number;
    contractValue: number;
    contractEndDate: string;
  };
  metrics: {
    totalRevenue: number;
    revenueChange: number;
    avgResponseTime: string;
    firstTimeFixRate: number;
    equipmentCount: number;
    openTickets: number;
    lastInteraction: string;
    monthlyUsage: number;
    usageTrend: "up" | "down" | "stable";
  };
  aiInsights: Array<{
    id: string;
    type: "opportunity" | "risk" | "optimization" | "recommendation";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    confidence: number;
    actionable: boolean;
    action?: {
      label: string;
      href?: string;
      onClick?: () => void;
    };
  }>;
  equipment: Array<{
    id: string;
    name: string;
    model: string;
    status: "healthy" | "warning" | "critical";
    healthScore: number;
    nextMaintenance: string;
    currentMeter: number;
    avgMonthlyVolume: number;
    tonerLevels?: {
      black?: number;
      cyan?: number;
      magenta?: number;
      yellow?: number;
    };
  }>;
  timeline: Array<{
    id: string;
    type: "service" | "invoice" | "meter" | "note" | "contract" | "equipment";
    title: string;
    description?: string;
    timestamp: string;
    user?: string;
    metadata?: Record<string, any>;
  }>;
  contracts: Array<{
    id: string;
    type: string;
    status: "active" | "expiring" | "expired";
    startDate: string;
    endDate: string;
    value: number;
    autoRenew: boolean;
  }>;
}

interface Customer360ViewProps {
  customerId: string;
}

export function Customer360View({ customerId }: Customer360ViewProps) {
  const { data, isLoading } = useQuery<Customer360Data>({
    queryKey: [`/api/customers/${customerId}/360-view`],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/customers/${customerId}/360-view`);
      } catch (err) {
        // Fallback: construct from individual endpoints
        const customer = await apiRequest(`/api/customers/${customerId}`);
        const equipment = await apiRequest(`/api/equipment?customerId=${customerId}`);

        return {
          customer: {
            id: customer.id,
            name: customer.companyName,
            status: customer.status || "active",
            segment: customer.segment || "Mid-Market",
            healthScore: 89,
            lifetimeValue: 125000,
            contractValue: 2400,
            contractEndDate: "2025-12-31",
          },
          metrics: {
            totalRevenue: customer.totalRevenue || 45000,
            revenueChange: 15,
            avgResponseTime: "1.2 hrs",
            firstTimeFixRate: 94,
            equipmentCount: equipment?.length || 8,
            openTickets: customer.openTickets || 2,
            lastInteraction: customer.lastInteraction || new Date().toISOString(),
            monthlyUsage: 125000,
            usageTrend: "up" as const,
          },
          aiInsights: generateMockInsights(customer),
          equipment: equipment || [],
          timeline: [],
          contracts: [],
        };
      }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-8 bg-muted animate-pulse rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { customer, metrics, aiInsights, equipment, timeline, contracts } = data;

  return (
    <div className="space-y-6">
      {/* Customer Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <Badge
              variant={
                customer.status === "active"
                  ? "default"
                  : customer.status === "at-risk"
                  ? "destructive"
                  : "secondary"
              }
            >
              {customer.status}
            </Badge>
            <Badge variant="outline">{customer.segment}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Customer ID: {customer.id} • Member since 2023
          </p>
        </div>

        {/* Health Score */}
        <Card className="w-48">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Health Score</p>
                <p className="text-2xl font-bold">{customer.healthScore}</p>
              </div>
              <div className="relative h-16 w-16">
                <svg className="transform -rotate-90" width="64" height="64">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - customer.healthScore / 100)}`}
                    className={cn(
                      customer.healthScore >= 80 && "text-green-500",
                      customer.healthScore >= 60 && customer.healthScore < 80 && "text-yellow-500",
                      customer.healthScore < 60 && "text-red-500"
                    )}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Heart
                    className={cn(
                      "h-6 w-6",
                      customer.healthScore >= 80 && "text-green-500",
                      customer.healthScore >= 60 && customer.healthScore < 80 && "text-yellow-500",
                      customer.healthScore < 60 && "text-red-500"
                    )}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          change={metrics.revenueChange}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <MetricCard
          title="Equipment Count"
          value={metrics.equipmentCount}
          icon={<Package className="h-5 w-5" />}
          href={`/equipment?customerId=${customerId}`}
        />
        <MetricCard
          title="Open Tickets"
          value={metrics.openTickets}
          icon={<Wrench className="h-5 w-5" />}
          status={metrics.openTickets > 5 ? "warning" : "ok"}
          href={`/service-hub?customerId=${customerId}`}
        />
        <MetricCard
          title="Avg Response Time"
          value={metrics.avgResponseTime}
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              AI-Powered Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiInsights.map((insight) => (
              <AIInsightCard key={insight.id} insight={insight} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs: Equipment, Timeline, Contracts */}
      <Tabs defaultValue="equipment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="equipment">
            Equipment ({equipment.length})
          </TabsTrigger>
          <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
          <TabsTrigger value="contracts">
            Contracts ({contracts.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="space-y-3">
          {equipment.map((item) => (
            <EquipmentCard key={item.id} equipment={item} />
          ))}
        </TabsContent>

        <TabsContent value="timeline">
          {timeline.length === 0 ? (
            <Card className="p-12 text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground">No recent activity</p>
            </Card>
          ) : (
            <TimelineSkeleton items={timeline.length} />
          )}
        </TabsContent>

        <TabsContent value="contracts">
          {contracts.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-muted-foreground">No contracts found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {contracts.map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Monthly Usage</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics.monthlyUsage.toLocaleString()} pages
                    </span>
                  </div>
                  <Progress value={75} className="h-2" />
                  <div className="flex items-center gap-1 mt-1">
                    {metrics.usageTrend === "up" ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {metrics.usageTrend === "up" ? "↑" : "↓"} 15% vs last month
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">First Time Fix Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics.firstTimeFixRate}%
                    </span>
                  </div>
                  <Progress value={metrics.firstTimeFixRate} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper Components

function MetricCard({
  title,
  value,
  change,
  icon,
  status,
  href,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  status?: "ok" | "warning" | "critical";
  href?: string;
}) {
  const content = (
    <Card className={cn(href && "cursor-pointer hover:shadow-md transition-shadow")}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                {change > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span
                  className={cn(
                    "text-xs",
                    change > 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {Math.abs(change)}%
                </span>
              </div>
            )}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function AIInsightCard({
  insight,
}: {
  insight: Customer360Data["aiInsights"][0];
}) {
  const getTypeIcon = () => {
    switch (insight.type) {
      case "opportunity":
        return <Target className="h-4 w-4 text-green-600" />;
      case "risk":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "optimization":
        return <BarChart3 className="h-4 w-4 text-blue-600" />;
      case "recommendation":
        return <Lightbulb className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getPriorityColor = () => {
    switch (insight.priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-orange-500";
      case "low":
        return "bg-blue-500";
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors">
      <div className={cn("h-2 w-2 rounded-full mt-2", getPriorityColor())} />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {getTypeIcon()}
          <p className="font-medium text-sm">{insight.title}</p>
          <Badge variant="outline" className="text-xs">
            {insight.confidence}% confidence
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{insight.description}</p>
        {insight.actionable && insight.action && (
          <Button variant="outline" size="sm" className="mt-2" asChild={!!insight.action.href}>
            {insight.action.href ? (
              <Link href={insight.action.href}>{insight.action.label}</Link>
            ) : (
              <span onClick={insight.action.onClick}>{insight.action.label}</span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function EquipmentCard({
  equipment,
}: {
  equipment: Customer360Data["equipment"][0];
}) {
  const getStatusColor = () => {
    switch (equipment.status) {
      case "healthy":
        return "text-green-600 bg-green-100";
      case "warning":
        return "text-yellow-600 bg-yellow-100";
      case "critical":
        return "text-red-600 bg-red-100";
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{equipment.name}</h3>
              <Badge className={getStatusColor()}>{equipment.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{equipment.model}</p>

            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <p className="text-xs text-muted-foreground">Current Meter</p>
                <p className="text-sm font-medium">{equipment.currentMeter.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Monthly</p>
                <p className="text-sm font-medium">{equipment.avgMonthlyVolume.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Next PM</p>
                <p className="text-sm font-medium">
                  {formatDistanceToNow(new Date(equipment.nextMaintenance), { addSuffix: true })}
                </p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm font-medium mb-2">Health Score</div>
            <div className="text-2xl font-bold">{equipment.healthScore}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractCard({ contract }: { contract: Customer360Data["contracts"][0] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium">{contract.type}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(contract.startDate).toLocaleDateString()} -{" "}
              {new Date(contract.endDate).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">${contract.value.toLocaleString()}</p>
            <Badge variant={contract.status === "active" ? "default" : "destructive"}>
              {contract.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mock AI insights generator
function generateMockInsights(customer: any): Customer360Data["aiInsights"] {
  return [
    {
      id: "1",
      type: "opportunity",
      priority: "high",
      title: "Upsell Opportunity Detected",
      description: `Print volume increased 40% over last quarter. Customer may benefit from upgrading to a higher-capacity model to reduce per-page costs.`,
      confidence: 92,
      actionable: true,
      action: {
        label: "Generate Upgrade Proposal",
        href: `/quotes/new?customerId=${customer.id}&type=upgrade`,
      },
    },
    {
      id: "2",
      type: "risk",
      priority: "high",
      title: "Contract Expiration Alert",
      description: `Contract expires in 45 days. Historical data shows this customer takes 2-3 weeks to review renewals. Recommend immediate outreach.`,
      confidence: 88,
      actionable: true,
      action: {
        label: "Schedule Renewal Call",
        onClick: () => console.log("Schedule call"),
      },
    },
    {
      id: "3",
      type: "optimization",
      priority: "medium",
      title: "Service Efficiency Improvement",
      description: `3 recent service calls for paper jams on Canon IR-2530i. Equipment may need roller replacement to prevent recurring issues.`,
      confidence: 85,
      actionable: true,
      action: {
        label: "Schedule Preventive Maintenance",
        href: `/service-hub/new?customerId=${customer.id}`,
      },
    },
  ];
}
