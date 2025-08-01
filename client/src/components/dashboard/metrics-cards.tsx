import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, FileText, AlertTriangle, Clock } from "lucide-react";

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
  });

  const metricCards = [
    {
      title: "Monthly Revenue",
      value: metrics ? `$${metrics.monthlyRevenue.toLocaleString()}` : "$0",
      change: "+12.5%",
      changeType: "positive",
      icon: DollarSign,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Active Contracts",
      value: metrics ? metrics.activeContracts.toString() : "0",
      change: "+8.2%",
      changeType: "positive",
      icon: FileText,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Open Tickets",
      value: metrics ? metrics.openTickets.toString() : "0",
      change: "-15.3%",
      changeType: "negative",
      icon: AlertTriangle,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      title: "Avg Response Time",
      value: metrics ? `${metrics.avgResponseTime}h` : "0h",
      change: "-20.1%",
      changeType: "positive",
      icon: Clock,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 sm:h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {metricCards.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{metric.title}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{metric.value}</p>
                  <div className="flex items-center mt-1 sm:mt-2">
                    <span className={`text-xs sm:text-sm font-medium ${
                      metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metric.change}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-500 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${metric.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${metric.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
