import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export default function TopCustomers() {
  const { data: customers, isLoading } = useQuery({
    queryKey: ['/api/dashboard/top-customers'],
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getInitialsBgColor = (index: number) => {
    const colors = [
      'bg-primary-100 text-primary-600',
      'bg-green-100 text-green-600',
      'bg-orange-100 text-orange-600',
      'bg-purple-100 text-purple-600',
      'bg-blue-100 text-blue-600',
    ];
    return colors[index % colors.length];
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Top Customers</CardTitle>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
            View all
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="h-4 bg-gray-200 rounded w-16"></div>
                <div className="h-3 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          ))
        ) : customers && customers.length > 0 ? (
          customers.map((customer: any, index: number) => (
            <div key={customer.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 ${getInitialsBgColor(index)} rounded-lg flex items-center justify-center`}>
                  <span className="font-semibold text-sm">
                    {getInitials(customer.name)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{customer.name}</p>
                  <p className="text-sm text-gray-600">
                    {customer.contractCount} active contract{customer.contractCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  ${customer.monthlyRevenue.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">monthly</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No customer data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
