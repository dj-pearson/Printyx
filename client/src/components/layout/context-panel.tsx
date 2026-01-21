import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PanelRight,
  X,
  Clock,
  TrendingUp,
  AlertCircle,
  Calendar,
  FileText,
  DollarSign,
  Wrench,
  Package,
  User,
  Building2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'wouter';

export interface ContextPanelProps {
  entityType: 'customer' | 'equipment' | 'ticket' | 'invoice' | 'contract';
  entityId: string;
  entityName: string;
  onClose?: () => void;
}

interface Activity {
  id: string;
  type: 'service' | 'invoice' | 'meter' | 'note' | 'status_change' | 'equipment';
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  metadata?: Record<string, any>;
}

interface QuickStat {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'secondary' | 'outline';
}

interface RelatedRecord {
  id: string;
  type: string;
  name: string;
  status?: string;
  href?: string;
}

export function ContextPanel({ entityType, entityId, entityName, onClose }: ContextPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch context data
  const { data: contextData, isLoading } = useQuery({
    queryKey: [`/api/${entityType}/${entityId}/context`],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/${entityType}/${entityId}/context`);
      } catch (err) {
        // Fallback: construct context from individual endpoints
        return await constructContextData();
      }
    },
  });

  async function constructContextData() {
    // Fetch related data based on entity type
    const data: {
      activities: Activity[];
      stats: QuickStat[];
      actions: QuickAction[];
      relatedRecords: RelatedRecord[];
    } = {
      activities: [],
      stats: [],
      actions: [],
      relatedRecords: [],
    };

    try {
      // Fetch activities/timeline
      if (entityType === 'customer') {
        const activities = await apiRequest(`/api/customers/${entityId}/activities`);
        data.activities = activities || [];

        // Get customer stats
        const customer = await apiRequest(`/api/customers/${entityId}`);
        data.stats = [
          {
            label: 'Total Revenue',
            value: `$${customer.totalRevenue || 0}`,
            icon: <DollarSign className="h-4 w-4" />,
          },
          {
            label: 'Equipment Count',
            value: customer.equipmentCount || 0,
            icon: <Package className="h-4 w-4" />,
          },
          {
            label: 'Open Tickets',
            value: customer.openTickets || 0,
            icon: <Wrench className="h-4 w-4" />,
          },
          {
            label: 'Contract Status',
            value: customer.contractStatus || 'Active',
            icon: <FileText className="h-4 w-4" />,
          },
        ];

        // Get quick actions for customer
        data.actions = [
          {
            label: 'Create Service Request',
            icon: <Wrench className="h-4 w-4" />,
            href: `/service-hub?customerId=${entityId}`,
          },
          {
            label: 'Generate Invoice',
            icon: <DollarSign className="h-4 w-4" />,
            href: `/invoices?customerId=${entityId}`,
          },
          {
            label: 'Submit Meter Reading',
            icon: <FileText className="h-4 w-4" />,
            href: `/meter-readings?customerId=${entityId}`,
          },
        ];

        // Get related equipment
        const equipment = await apiRequest(`/api/equipment?customerId=${entityId}`);
        data.relatedRecords = equipment.map((e: any) => ({
          id: e.id,
          type: 'Equipment',
          name: e.equipmentName || e.model,
          status: e.status,
          href: `/equipment/${e.id}`,
        }));
      } else if (entityType === 'equipment') {
        // Equipment context
        const equipment = await apiRequest(`/api/equipment/${entityId}`);

        data.stats = [
          {
            label: 'Current Meter',
            value: equipment.currentMeter || 0,
            trend: 'up',
            trendValue: '+1,240 this month',
          },
          {
            label: 'Next PM',
            value: equipment.nextPM || 'Not scheduled',
            icon: <Calendar className="h-4 w-4" />,
          },
          {
            label: 'Health Score',
            value: `${equipment.healthScore || 85}%`,
            trend: equipment.healthScore > 80 ? 'up' : 'down',
          },
        ];

        data.actions = [
          {
            label: 'Create Service Request',
            icon: <Wrench className="h-4 w-4" />,
            href: `/service-hub?equipmentId=${entityId}`,
          },
          {
            label: 'Submit Meter Reading',
            icon: <FileText className="h-4 w-4" />,
            href: `/meter-readings?equipmentId=${entityId}`,
          },
          {
            label: 'View Service History',
            icon: <Clock className="h-4 w-4" />,
            href: `/service-hub?equipmentId=${entityId}&view=history`,
          },
        ];
      } else if (entityType === 'ticket') {
        // Service ticket context
        const ticket = await apiRequest(`/api/service-tickets/${entityId}`);

        data.stats = [
          {
            label: 'Status',
            value: ticket.status || 'Open',
            icon: <AlertCircle className="h-4 w-4" />,
          },
          {
            label: 'Priority',
            value: ticket.priority || 'Medium',
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: 'Assigned To',
            value: ticket.assignedTo || 'Unassigned',
            icon: <User className="h-4 w-4" />,
          },
        ];

        data.actions = [
          {
            label: 'Update Status',
            icon: <AlertCircle className="h-4 w-4" />,
            onClick: () => console.log('Update status'),
          },
          {
            label: 'Add Note',
            icon: <FileText className="h-4 w-4" />,
            onClick: () => console.log('Add note'),
          },
          {
            label: 'View Customer',
            icon: <Building2 className="h-4 w-4" />,
            href: `/customers/${ticket.customerId}`,
          },
        ];
      }
    } catch (err) {
      console.error('Error constructing context data:', err);
    }

    return data;
  }

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-16 bottom-0 z-40 flex items-start pt-4">
        <Button
          variant="outline"
          size="icon"
          className="rounded-r-none"
          onClick={() => setIsCollapsed(false)}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const activities = contextData?.activities || [];
  const stats = contextData?.stats || [];
  const actions = contextData?.actions || [];
  const relatedRecords = contextData?.relatedRecords || [];

  return (
    <div className="fixed right-0 top-16 bottom-0 w-80 bg-background border-l shadow-lg z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground capitalize">{entityType}</div>
            <div className="text-sm font-medium truncate">{entityName}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsCollapsed(true)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Quick Stats */}
          {stats.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">{stat.label}</div>
                        <div className="text-lg font-semibold">{stat.value}</div>
                        {stat.trendValue && (
                          <div
                            className={cn(
                              'text-xs flex items-center gap-1',
                              stat.trend === 'up'
                                ? 'text-green-600'
                                : stat.trend === 'down'
                                  ? 'text-red-600'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : ''}
                            {stat.trendValue}
                          </div>
                        )}
                      </div>
                      {stat.icon && <div className="text-muted-foreground">{stat.icon}</div>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {actions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {actions.map((action, idx) => (
                  <Button
                    key={idx}
                    variant={action.variant || 'outline'}
                    className="w-full justify-start"
                    size="sm"
                    asChild={!!action.href}
                    onClick={action.onClick}
                  >
                    {action.href ? (
                      <Link href={action.href}>
                        {action.icon}
                        <span className="ml-2">{action.label}</span>
                      </Link>
                    ) : (
                      <>
                        {action.icon}
                        <span className="ml-2">{action.label}</span>
                      </>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {activities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {activities.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="w-px h-full bg-border mt-1" />
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="text-sm font-medium">{activity.title}</div>
                      {activity.description && (
                        <div className="text-xs text-muted-foreground mt-1">
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
                            <span>{activity.user}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Records */}
          {relatedRecords.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Related Items</h3>
              <div className="space-y-2">
                {relatedRecords.map((record) => (
                  <Link key={record.id} href={record.href || '#'}>
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-accent cursor-pointer">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-xs text-muted-foreground">{record.type}</div>
                        <div className="text-sm truncate">{record.name}</div>
                      </div>
                      {record.status && (
                        <Badge variant="secondary" className="text-xs">
                          {record.status}
                        </Badge>
                      )}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading context...</div>
          )}

          {/* Empty State */}
          {!isLoading && activities.length === 0 && stats.length === 0 && actions.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <PanelRight className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No additional context available</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function getActivityIcon(type: Activity['type']) {
  switch (type) {
    case 'service':
      return <Wrench className="h-4 w-4" />;
    case 'invoice':
      return <DollarSign className="h-4 w-4" />;
    case 'meter':
      return <FileText className="h-4 w-4" />;
    case 'note':
      return <FileText className="h-4 w-4" />;
    case 'status_change':
      return <AlertCircle className="h-4 w-4" />;
    case 'equipment':
      return <Package className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

// Hook to use context panel
export function useContextPanel() {
  const [contextPanel, setContextPanel] = useState<{
    entityType: ContextPanelProps['entityType'];
    entityId: string;
    entityName: string;
  } | null>(null);

  const openContextPanel = (
    entityType: ContextPanelProps['entityType'],
    entityId: string,
    entityName: string,
  ) => {
    setContextPanel({ entityType, entityId, entityName });
  };

  const closeContextPanel = () => {
    setContextPanel(null);
  };

  return {
    contextPanel,
    openContextPanel,
    closeContextPanel,
  };
}
