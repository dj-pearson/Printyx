import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, Info } from "lucide-react";

export default function Alerts() {
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['/api/dashboard/alerts'],
  });

  const alerts = [
    {
      type: 'danger',
      icon: AlertTriangle,
      title: 'Low Inventory Alert',
      message: alertsData?.lowStock?.length 
        ? `${alertsData.lowStock.length} items below reorder point`
        : 'Canon 045H Black Toner - Only 3 units left',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
    {
      type: 'warning',
      icon: Clock,
      title: 'Contract Expiring',
      message: 'MedCenter LLC contract expires in 15 days',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-800',
      iconColor: 'text-orange-600',
    },
    {
      type: 'info',
      icon: Info,
      title: 'Meter Reading Due',
      message: '5 devices need meter readings this week',
      bgColor: 'bg-primary/5',
      borderColor: 'border-primary/20',
      textColor: 'text-primary',
      iconColor: 'text-primary',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Alerts</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg animate-pulse">
              <div className="flex items-start">
                <div className="w-5 h-5 bg-gray-200 rounded mr-3 mt-0.5"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))
        ) : (
          alerts.map((alert, index) => {
            const Icon = alert.icon;
            return (
              <div
                key={index}
                className={`p-3 ${alert.bgColor} border ${alert.borderColor} rounded-lg`}
              >
                <div className="flex items-start">
                  <Icon className={`${alert.iconColor} mt-0.5 mr-3 h-4 w-4`} />
                  <div>
                    <p className={`text-sm font-medium ${alert.textColor}`}>{alert.title}</p>
                    <p className={`text-xs ${alert.iconColor} mt-1`}>{alert.message}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
