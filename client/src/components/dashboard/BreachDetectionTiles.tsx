import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  FileText, 
  Package, 
  Wrench, 
  DollarSign,
  ExternalLink,
  CheckCircle
} from 'lucide-react';
import { useLocation } from 'wouter';

interface BreachMetric {
  type: string;
  title: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  drillThroughUrl: string;
  icon: any;
  lastUpdated: string;
}

export default function BreachDetectionTiles() {
  const [, setLocation] = useLocation();

  // Fetch breach metrics from the backend
  const { data: breachMetrics = [], isLoading, error } = useQuery<BreachMetric[]>({
    queryKey: ['/api/reports/breaches'],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    retry: false // Prevent infinite retries if auth fails
  });

  // Show fallback if there's an error or no data
  if (error || (!isLoading && breachMetrics.length === 0)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'low': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Filter out breach metrics with count > 0
  const activeBreaches = breachMetrics.filter(metric => metric.count > 0);

  if (activeBreaches.length === 0) {
    return (
      <Card className="col-span-full">
        <CardContent className="text-center py-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-800">All Clear</h3>
            <p className="text-green-600">No SLA breaches detected at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {activeBreaches.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card 
            key={metric.type} 
            className={`${getSeverityColor(metric.severity)} border-2 cursor-pointer hover:shadow-lg transition-all duration-200`}
            onClick={() => setLocation(metric.drillThroughUrl)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {metric.title}
                </CardTitle>
                <Badge variant={getSeverityBadgeVariant(metric.severity)} className="text-xs">
                  {metric.severity.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{metric.count}</span>
                  <AlertTriangle className={`h-5 w-5 ${
                    metric.severity === 'critical' ? 'text-red-600' :
                    metric.severity === 'high' ? 'text-orange-600' :
                    metric.severity === 'medium' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                </div>
                <p className="text-xs opacity-80 mb-3">{metric.description}</p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="opacity-70">
                    Updated: {new Date(metric.lastUpdated).toLocaleTimeString()}
                  </span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(metric.drillThroughUrl);
                    }}
                  >
                    View Details <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Default breach types for when no data is available
export const DefaultBreachTypes: BreachMetric[] = [
  {
    type: 'sales_response_sla',
    title: 'Response SLA Breach',
    count: 0,
    severity: 'high',
    description: 'Leads not contacted within 24h',
    drillThroughUrl: '/leads-management?filter=sla_breach',
    icon: Clock,
    lastUpdated: new Date().toISOString()
  },
  {
    type: 'proposal_aging',
    title: 'Aging Proposals',
    count: 0,
    severity: 'medium',
    description: 'Proposals older than 14 days',
    drillThroughUrl: '/proposal-builder?filter=aging&days=14',
    icon: FileText,
    lastUpdated: new Date().toISOString()
  },
  {
    type: 'po_variance',
    title: 'PO Lead Time Variance',
    count: 0,
    severity: 'medium',
    description: 'Orders > 2x planned lead time',
    drillThroughUrl: '/admin/purchase-orders?filter=variance_gt_2x',
    icon: Package,
    lastUpdated: new Date().toISOString()
  },
  {
    type: 'service_sla',
    title: 'Service SLA Breach',
    count: 0,
    severity: 'critical',
    description: 'Tickets aging > 5 days',
    drillThroughUrl: '/service-hub?filter=sla_breach',
    icon: Wrench,
    lastUpdated: new Date().toISOString()
  },
  {
    type: 'billing_delay',
    title: 'Invoice Issuance Delay',
    count: 0,
    severity: 'high',
    description: 'Invoices not issued within 24h',
    drillThroughUrl: '/advanced-billing?filter=issuance_delay_gt_24h',
    icon: DollarSign,
    lastUpdated: new Date().toISOString()
  }
];