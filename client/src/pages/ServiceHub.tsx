import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PhoneInTicketCreator from "@/components/service/PhoneInTicketCreator";
import TechnicianTicketWorkflow from "@/components/service/TechnicianTicketWorkflow";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  MapPin,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Activity,
  TrendingUp,
  Calendar,
  User,
  Building,
  Timer,
} from "lucide-react";

export default function ServiceHub() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showPhoneInCreator, setShowPhoneInCreator] = useState(false);
  const [showTechWorkflow, setShowTechWorkflow] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Fetch service tickets
  const {
    data: tickets = [],
    isLoading: ticketsLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/service-tickets"],
    enabled: isAuthenticated,
  });

  // Fetch phone-in tickets
  const { data: phoneInTickets = [], isLoading: phoneInLoading } = useQuery({
    queryKey: ["/api/phone-in-tickets"],
    enabled: isAuthenticated,
  });

  // Fetch service analytics
  const { data: analytics } = useQuery({
    queryKey: ["/api/service-analytics"],
    enabled: isAuthenticated,
  });

  // Convert phone-in ticket to service ticket
  const convertToServiceTicket = useMutation({
    mutationFn: async (phoneInTicketId: string) => {
      return await apiRequest(
        `/api/phone-in-tickets/${phoneInTicketId}/convert`,
        "POST"
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Phone-in ticket converted to service ticket",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-in-tickets"] });
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to convert ticket",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "new":
        return "secondary";
      case "assigned":
        return "outline";
      case "en_route":
        return "default";
      case "on_site":
        return "default";
      case "in_progress":
        return "default";
      case "completed":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "low":
        return "secondary";
      case "medium":
        return "outline";
      case "high":
        return "default";
      case "urgent":
        return "destructive";
      case "emergency":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const filteredTickets = tickets.filter((ticket: any) => {
    const matchesSearch =
      ticket.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPhoneInTickets = phoneInTickets.filter((ticket: any) => {
    const matchesSearch =
      (ticket.issue_description || ticket.description)
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (ticket.customer_name || ticket.title)
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (ticket.caller_name || ticket.callerName)
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Enhanced Service System...</p>
        </div>
      </div>
    );
  }

  if (ticketsLoading || phoneInLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Skeleton className="h-60" />
            <Skeleton className="h-60" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Enhanced Service System
            </h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">
              Comprehensive service management with phone-in tickets and guided
              technician workflows
            </p>
          </div>
          <div className="flex gap-2 flex-col sm:flex-row">
            <Button
              onClick={() => setShowPhoneInCreator(true)}
              className="flex items-center gap-2 w-full sm:w-auto"
              size="default"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">New Phone-In Ticket</span>
              <span className="sm:hidden">New Ticket</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={ticketsLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw
                className={`h-4 w-4 ${ticketsLoading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">
                    Active Tickets
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {
                      tickets.filter(
                        (t: any) =>
                          !["completed", "cancelled"].includes(t.status)
                      ).length
                    }
                  </p>
                </div>
                <Activity className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">
                    Phone-In Queue
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {phoneInTickets.length}
                  </p>
                </div>
                <Phone className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">
                    On-Site Techs
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {tickets.filter((t: any) => t.status === "on_site").length}
                  </p>
                </div>
                <MapPin className="h-6 w-6 md:h-8 md:w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">
                    Completed Today
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-gray-900">
                    {
                      tickets.filter(
                        (t: any) =>
                          t.status === "completed" &&
                          new Date(t.updatedAt).toDateString() ===
                            new Date().toDateString()
                      ).length
                    }
                  </p>
                </div>
                <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="text-xs md:text-sm py-2">
              Overview
            </TabsTrigger>
            <TabsTrigger value="phone-in" className="text-xs md:text-sm py-2">
              Phone-In Queue
            </TabsTrigger>
            <TabsTrigger
              value="active-tickets"
              className="text-xs md:text-sm py-2"
            >
              Active Tickets
            </TabsTrigger>
            <TabsTrigger
              value="technician-view"
              className="text-xs md:text-sm py-2"
            >
              Technician View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Recent Phone-In Tickets
                  </CardTitle>
                  <CardDescription>
                    Latest phone calls requiring service attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {phoneInTickets.slice(0, 5).map((ticket: any) => (
                      <div
                        key={ticket.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg space-y-2 sm:space-y-0"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm md:text-base">
                            {ticket.customer_name ||
                              ticket.title ||
                              ticket.companyName ||
                              "Unknown Company"}
                          </p>
                          <p className="text-xs md:text-sm text-gray-600">
                            {ticket.issue_description ||
                              ticket.description ||
                              ticket.issueDescription}
                          </p>
                          <p className="text-xs text-gray-500">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {ticket.created_at
                              ? new Date(ticket.created_at).toLocaleTimeString()
                              : new Date(ticket.createdAt).toLocaleTimeString()}
                            <span className="ml-2">
                              <Phone className="h-3 w-3 inline mr-1" />
                              {ticket.caller_name || ticket.callerName}
                            </span>
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge
                            variant={getPriorityBadgeVariant(ticket.priority)}
                            className="text-xs"
                          >
                            {ticket.priority}
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() =>
                              convertToServiceTicket.mutate(ticket.id)
                            }
                            disabled={convertToServiceTicket.isPending}
                            className="text-xs"
                          >
                            Convert
                          </Button>
                        </div>
                      </div>
                    ))}
                    {phoneInTickets.length === 0 && (
                      <p className="text-center text-gray-500 py-4 text-sm">
                        No phone-in tickets
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Active Service Tickets
                  </CardTitle>
                  <CardDescription>
                    Tickets currently being worked on
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tickets
                      .filter((t: any) =>
                        [
                          "assigned",
                          "en_route",
                          "on_site",
                          "in_progress",
                        ].includes(t.status)
                      )
                      .slice(0, 5)
                      .map((ticket: any) => (
                        <div
                          key={ticket.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg space-y-2 sm:space-y-0"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm md:text-base">
                              {ticket.customerName || "Unknown Customer"}
                            </p>
                            <p className="text-xs md:text-sm text-gray-600">
                              {ticket.description}
                            </p>
                            <p className="text-xs text-gray-500">
                              <User className="h-3 w-3 inline mr-1" />
                              {ticket.assignedTechnician || "Unassigned"}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Badge
                              variant={getStatusBadgeVariant(ticket.status)}
                              className="text-xs"
                            >
                              {ticket.status?.replace("_", " ")}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTicket(ticket);
                                setShowTechWorkflow(true);
                              }}
                              className="text-xs"
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    {tickets.filter((t: any) =>
                      [
                        "assigned",
                        "en_route",
                        "on_site",
                        "in_progress",
                      ].includes(t.status)
                    ).length === 0 && (
                      <p className="text-center text-gray-500 py-4 text-sm">
                        No active service tickets
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="phone-in" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Phone-In Ticket Queue</CardTitle>
                <CardDescription>
                  Manage incoming phone calls and convert them to service
                  tickets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search phone-in tickets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:max-w-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredPhoneInTickets.map((ticket: any) => (
                    <Card key={ticket.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">
                                {ticket.customer_name ||
                                  ticket.title ||
                                  "Phone-in Ticket"}
                              </h3>
                              <Badge
                                variant={getPriorityBadgeVariant(
                                  ticket.priority
                                )}
                              >
                                {ticket.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {ticket.issue_description || ticket.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {ticket.caller_name || ticket.callerName} (
                                {ticket.caller_phone || ticket.callerPhone})
                              </span>
                              <span className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {ticket.location_address ||
                                  ticket.locationAddress ||
                                  "No address provided"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {ticket.created_at
                                  ? new Date(
                                      ticket.created_at
                                    ).toLocaleTimeString()
                                  : new Date(
                                      ticket.createdAt
                                    ).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                convertToServiceTicket.mutate(ticket.id)
                              }
                              disabled={convertToServiceTicket.isPending}
                            >
                              Convert to Service Ticket
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredPhoneInTickets.length === 0 && (
                    <div className="text-center py-8">
                      <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No phone-in tickets found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active-tickets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Service Tickets</CardTitle>
                <CardDescription>
                  Monitor and manage ongoing service work
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search tickets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:max-w-sm"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="en_route">En Route</SelectItem>
                      <SelectItem value="on_site">On Site</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {filteredTickets.map((ticket: any) => (
                    <Card key={ticket.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">
                                #{ticket.id.slice(0, 8)}
                              </h3>
                              <Badge
                                variant={getStatusBadgeVariant(ticket.status)}
                              >
                                {ticket.status?.replace("_", " ")}
                              </Badge>
                              {ticket.priority && (
                                <Badge
                                  variant={getPriorityBadgeVariant(
                                    ticket.priority
                                  )}
                                >
                                  {ticket.priority}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {ticket.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {ticket.customerName || "Unknown Customer"}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {ticket.assignedTechnician || "Unassigned"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(
                                  ticket.createdAt
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTicket(ticket);
                                setShowTechWorkflow(true);
                              }}
                            >
                              Manage
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredTickets.length === 0 && (
                    <div className="text-center py-8">
                      <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No service tickets found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technician-view" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Technician Workflow Dashboard</CardTitle>
                <CardDescription>
                  Real-time view of technician activities and workflow progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Active Technicians</h3>
                    <div className="space-y-3">
                      {tickets
                        .filter((t: any) =>
                          ["en_route", "on_site", "in_progress"].includes(
                            t.status
                          )
                        )
                        .map((ticket: any) => (
                          <div
                            key={ticket.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex-1">
                              <p className="font-medium">
                                {ticket.assignedTechnician || "Unknown Tech"}
                              </p>
                              <p className="text-sm text-gray-600">
                                #{ticket.id.slice(0, 8)} - {ticket.customerName}
                              </p>
                              <Badge
                                size="sm"
                                variant={getStatusBadgeVariant(ticket.status)}
                              >
                                {ticket.status?.replace("_", " ")}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTicket(ticket);
                                setShowTechWorkflow(true);
                              }}
                            >
                              Track
                            </Button>
                          </div>
                        ))}
                      {tickets.filter((t: any) =>
                        ["en_route", "on_site", "in_progress"].includes(
                          t.status
                        )
                      ).length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                          No active technicians
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Workflow Progress</h3>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm">Initial Assessment</span>
                          <span className="text-xs text-gray-500">
                            Step 1/6
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: "16.6%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm">Diagnosis</span>
                          <span className="text-xs text-gray-500">
                            Step 2/6
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: "33.3%" }}
                          ></div>
                        </div>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm">Customer Approval</span>
                          <span className="text-xs text-gray-500">
                            Step 3/6
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: "50%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Phone-In Ticket Creator Dialog */}
        <Dialog open={showPhoneInCreator} onOpenChange={setShowPhoneInCreator}>
          <DialogContent className="w-[95vw] max-w-6xl h-[95vh] max-h-[95vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b bg-gray-50">
              <DialogTitle className="text-xl font-semibold">
                Create Phone-In Ticket
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <PhoneInTicketCreator
                isOpen={showPhoneInCreator}
                onClose={() => setShowPhoneInCreator(false)}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Technician Workflow Dialog */}
        <Dialog open={showTechWorkflow} onOpenChange={setShowTechWorkflow}>
          <DialogContent className="w-[95vw] max-w-6xl h-[95vh] max-h-[95vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b bg-gray-50">
              <DialogTitle className="text-xl font-semibold">
                Technician Workflow - Ticket #{selectedTicket?.id?.slice(0, 8)}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {selectedTicket && (
                <TechnicianTicketWorkflow
                  ticket={selectedTicket}
                  onClose={() => setShowTechWorkflow(false)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
