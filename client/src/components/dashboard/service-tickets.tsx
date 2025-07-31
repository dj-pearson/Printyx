import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Wrench, CheckCircle } from "lucide-react";

export default function ServiceTickets() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['/api/dashboard/recent-tickets'],
  });

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium': return <Wrench className="h-4 w-4 text-yellow-600" />;
      default: return <Wrench className="h-4 w-4 text-blue-600" />;
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in-progress': return <Wrench className="h-5 w-5 text-blue-600" />;
      default: return <AlertTriangle className="h-5 w-5 text-orange-600" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Recent Service Tickets</CardTitle>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
            View all
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-48"></div>
                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-16"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ))
        ) : tickets && tickets.length > 0 ? (
          tickets.slice(0, 3).map((ticket: any) => (
            <div key={ticket.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  {getStatusIcon(ticket.status)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{ticket.title}</p>
                  <p className="text-sm text-gray-600">
                    Customer: {ticket.customerId} • Created: {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={getPriorityVariant(ticket.priority)} className="flex items-center gap-1 capitalize mb-1">
                  {getPriorityIcon(ticket.priority)}
                  {ticket.priority}
                </Badge>
                <p className="text-sm text-gray-500">{new Date(ticket.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <Wrench className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No recent service tickets</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
