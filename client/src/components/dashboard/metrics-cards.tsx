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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricCards.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value}</p>
                  <div className="flex items-center mt-2">
                    <i className={`fas fa-arrow-${metric.changeType === 'positive' ? 'up' : 'down'} text-${metric.changeType === 'positive' ? 'green' : 'red'}-600 text-sm mr-1`}></i>
                    <span className={`text-sm font-medium text-${metric.changeType === 'positive' ? 'green' : 'red'}-600`}>
                      {metric.change}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`h-6 w-6 ${metric.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
