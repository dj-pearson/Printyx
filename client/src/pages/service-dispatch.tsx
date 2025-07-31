import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNav from "@/components/ui/mobile-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Wrench, Clock, AlertTriangle, CheckCircle } from "lucide-react";

export default function ServiceDispatch() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['/api/service-tickets'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading service dispatch...</p>
        </div>
      </div>
    );
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'low': return <Clock className="h-4 w-4 text-blue-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in-progress': return <Wrench className="h-4 w-4 text-blue-600" />;
      case 'open': return <Clock className="h-4 w-4 text-orange-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'secondary';
      case 'open': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <Header title="Service Dispatch" description="Manage service tickets and technician assignments" />
        
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search tickets..."
                className="pl-10"
              />
            </div>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>

          {ticketsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-6 bg-gray-200 rounded w-16"></div>
                        <div className="h-6 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tickets && tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((ticket: any) => (
                <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                          {getStatusIcon(ticket.status)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{ticket.title}</h3>
                            <span className="text-xs text-gray-500">#{ticket.ticketNumber}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{ticket.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Customer: {ticket.customerId}</span>
                            <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                            {ticket.assignedTechnicianId && (
                              <span>Assigned: {ticket.assignedTechnicianId}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Badge variant={getPriorityVariant(ticket.priority)} className="flex items-center gap-1 capitalize">
                          {getPriorityIcon(ticket.priority)}
                          {ticket.priority}
                        </Badge>
                        <Badge variant={getStatusVariant(ticket.status)} className="flex items-center gap-1 capitalize">
                          {getStatusIcon(ticket.status)}
                          {ticket.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        Assign Technician
                      </Button>
                      {ticket.status === 'open' && (
                        <Button size="sm">
                          Start Work
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No service tickets found</h3>
                  <p className="text-gray-600 mb-6">Create your first service ticket to get started.</p>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Ticket
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      
      <MobileNav />
    </div>
  );
}
