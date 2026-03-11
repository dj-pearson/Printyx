import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  FileText,
  DollarSign,
  Target,
  PartyPopper,
} from 'lucide-react';
import { Link } from 'wouter';

type PriorityEntityType = 'task' | 'lead' | 'quote' | 'invoice';

type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

interface PriorityItem {
  id: string;
  entityType: PriorityEntityType;
  title: string;
  ageText: string;
  urgency: UrgencyLevel;
  link: string;
}

const ENTITY_ICON_MAP: Record<PriorityEntityType, { icon: React.ElementType; className: string }> =
  {
    task: { icon: CheckCircle2, className: 'text-blue-600' },
    lead: { icon: Users, className: 'text-green-600' },
    quote: { icon: FileText, className: 'text-orange-600' },
    invoice: { icon: DollarSign, className: 'text-purple-600' },
  };

const URGENCY_CONFIG: Record<
  UrgencyLevel,
  { variant: 'destructive' | 'default' | 'secondary' | 'outline'; label: string }
> = {
  critical: { variant: 'destructive', label: 'Critical' },
  high: { variant: 'destructive', label: 'High' },
  medium: { variant: 'default', label: 'Medium' },
  low: { variant: 'secondary', label: 'Low' },
};

function getUrgencySort(urgency: UrgencyLevel): number {
  switch (urgency) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    default:
      return 4;
  }
}

/**
 * Today's Priorities Widget
 *
 * Displays up to 10 priority items including overdue tasks, leads needing follow-up,
 * expiring quotes, and overdue invoices. Items are sorted by urgency (most overdue first).
 */
export function TodaysPriorities() {
  const {
    data: priorities,
    isLoading,
    isError,
  } = useQuery<PriorityItem[]>({
    queryKey: ['/api/dashboard/priorities'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/priorities', {
        credentials: 'include',
      });
      if (!response.ok) {
        return [] as PriorityItem[];
      }
      return (await response.json()) as PriorityItem[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const sortedPriorities = React.useMemo(() => {
    if (!priorities) return [];
    return [...priorities]
      .sort((a, b) => getUrgencySort(a.urgency) - getUrgencySort(b.urgency))
      .slice(0, 10);
  }, [priorities]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          Today's Priorities
        </CardTitle>
        {sortedPriorities.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {sortedPriorities.length} item{sortedPriorities.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
            <p className="text-sm text-gray-600">
              Could not load priorities. Please try again later.
            </p>
          </div>
        ) : sortedPriorities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PartyPopper className="h-10 w-10 text-green-500 mb-2" />
            <p className="text-sm font-medium text-gray-900">All caught up!</p>
            <p className="text-sm text-gray-500 mt-1">No urgent items today.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPriorities.map((item) => {
              const entityConfig = ENTITY_ICON_MAP[item.entityType];
              const urgencyConfig = URGENCY_CONFIG[item.urgency];
              const IconComponent = entityConfig.icon;

              return (
                <Link key={item.id} href={item.link}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto py-2.5 px-3 hover:bg-gray-50 group"
                  >
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors">
                        <IconComponent className={`h-4 w-4 ${entityConfig.className}`} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.ageText}
                        </p>
                      </div>
                      <Badge variant={urgencyConfig.variant} className="flex-shrink-0 text-xs">
                        {urgencyConfig.label}
                      </Badge>
                    </div>
                  </Button>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TodaysPriorities;
