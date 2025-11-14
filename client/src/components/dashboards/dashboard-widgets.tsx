import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Users,
  Wrench,
  DollarSign,
  Package,
  Calendar,
  Clock,
  Target,
  CheckCircle,
  MapPin,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// STAT CARD WIDGET
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  href?: string;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  href,
  trend,
  loading,
}: StatCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  const content = (
    <Card className={cn(href && "cursor-pointer hover:shadow-md transition-shadow")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-8 w-8 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {(change !== undefined || changeLabel) && (
              <div className="flex items-center gap-1 mt-1">
                {change !== undefined && (
                  <span
                    className={cn(
                      "text-xs font-medium flex items-center",
                      isPositive && "text-green-600",
                      isNegative && "text-red-600",
                      !isPositive && !isNegative && "text-muted-foreground"
                    )}
                  >
                    {isPositive && <ArrowUpRight className="h-3 w-3" />}
                    {isNegative && <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(change)}%
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {changeLabel || "vs last period"}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// PRIORITY LIST WIDGET
// ============================================================================

interface PriorityItem {
  id: string;
  title: string;
  subtitle?: string;
  priority: "critical" | "high" | "medium" | "low";
  href?: string;
  action?: () => void;
}

interface PriorityListProps {
  title: string;
  items: PriorityItem[];
  emptyMessage?: string;
  viewAllHref?: string;
  loading?: boolean;
}

export function PriorityList({
  title,
  items,
  emptyMessage = "No items",
  viewAllHref,
  loading,
}: PriorityListProps) {
  const getPriorityColor = (priority: PriorityItem["priority"]) => {
    switch (priority) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-blue-500";
      case "low":
        return "bg-gray-400";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {viewAllHref && items.length > 0 && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={viewAllHref}>View All</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const ItemContent = (
                <div className="flex items-start gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full mt-2",
                      getPriorityColor(item.priority)
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              );

              if (item.href) {
                return (
                  <Link key={item.id} href={item.href}>
                    {ItemContent}
                  </Link>
                );
              }

              if (item.action) {
                return (
                  <div key={item.id} onClick={item.action}>
                    {ItemContent}
                  </div>
                );
              }

              return <div key={item.id}>{ItemContent}</div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ACTIVITY FEED WIDGET
// ============================================================================

interface Activity {
  id: string;
  type: "service" | "invoice" | "customer" | "equipment" | "note";
  title: string;
  description?: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
  href?: string;
}

interface ActivityFeedProps {
  title: string;
  activities: Activity[];
  maxItems?: number;
  loading?: boolean;
}

export function ActivityFeed({
  title,
  activities,
  maxItems = 5,
  loading,
}: ActivityFeedProps) {
  const getActivityIcon = (type: Activity["type"]) => {
    switch (type) {
      case "service":
        return <Wrench className="h-4 w-4" />;
      case "invoice":
        return <DollarSign className="h-4 w-4" />;
      case "customer":
        return <Users className="h-4 w-4" />;
      case "equipment":
        return <Package className="h-4 w-4" />;
      case "note":
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, maxItems).map((activity) => (
              <Link key={activity.id} href={activity.href || "#"}>
                <div className="flex items-start gap-3 hover:bg-accent p-2 rounded-md cursor-pointer transition-colors">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{activity.title}</div>
                    {activity.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {activity.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(activity.timestamp), {
                        addSuffix: true,
                      })}
                      {activity.user && (
                        <>
                          <span>•</span>
                          <span>{activity.user.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TEAM STATUS WIDGET (for Service Managers)
// ============================================================================

interface Technician {
  id: string;
  name: string;
  avatar?: string;
  status: "on-site" | "en-route" | "available" | "off-duty";
  currentJob?: {
    id: string;
    customer: string;
    location: string;
  };
  jobsToday: number;
  href?: string;
}

interface TeamStatusProps {
  title: string;
  technicians: Technician[];
  loading?: boolean;
}

export function TeamStatus({ title, technicians, loading }: TeamStatusProps) {
  const getStatusColor = (status: Technician["status"]) => {
    switch (status) {
      case "on-site":
        return "bg-green-500";
      case "en-route":
        return "bg-blue-500";
      case "available":
        return "bg-yellow-500";
      case "off-duty":
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: Technician["status"]) => {
    switch (status) {
      case "on-site":
        return "On-site";
      case "en-route":
        return "En route";
      case "available":
        return "Available";
      case "off-duty":
        return "Off duty";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {technicians.map((tech) => (
              <div
                key={tech.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={tech.avatar} alt={tech.name} />
                    <AvatarFallback>
                      {tech.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                      getStatusColor(tech.status)
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{tech.name}</div>
                  {tech.currentJob ? (
                    <div className="text-xs text-muted-foreground truncate">
                      {getStatusLabel(tech.status)} at {tech.currentJob.customer}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      {getStatusLabel(tech.status)} - {tech.jobsToday} jobs today
                    </div>
                  )}
                </div>
                {tech.href && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={tech.href}>Track</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PIPELINE WIDGET (for Sales Reps)
// ============================================================================

interface PipelineStage {
  name: string;
  value: number;
  count: number;
  deals: Array<{
    id: string;
    company: string;
    value: number;
    probability: number;
  }>;
}

interface PipelineWidgetProps {
  title: string;
  stages: PipelineStage[];
  loading?: boolean;
}

export function PipelineWidget({ title, stages, loading }: PipelineWidgetProps) {
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <div className="text-2xl font-bold">${total.toLocaleString()}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-8 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {stages.map((stage, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-muted-foreground">
                    ${stage.value.toLocaleString()} ({stage.count})
                  </span>
                </div>
                <Progress
                  value={(stage.value / total) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// QUICK ACTION BUTTONS WIDGET
// ============================================================================

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "secondary" | "outline";
}

interface QuickActionsProps {
  title: string;
  actions: QuickAction[];
}

export function QuickActions({ title, actions }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action, idx) => (
            <Button
              key={idx}
              variant={action.variant || "outline"}
              className="h-auto py-4 flex flex-col gap-2"
              asChild={!!action.href}
              onClick={action.onClick}
            >
              {action.href ? (
                <Link href={action.href}>
                  <div className="h-8 w-8">{action.icon}</div>
                  <span className="text-xs">{action.label}</span>
                </Link>
              ) : (
                <>
                  <div className="h-8 w-8">{action.icon}</div>
                  <span className="text-xs">{action.label}</span>
                </>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
