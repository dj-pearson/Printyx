import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Wrench,
  Plus,
  Search,
  Calendar,
  Clock,
  User,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Settings,
  MoreHorizontal,
  Eye,
  Phone,
  MessageSquare,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

interface ServiceCall {
  id: string;
  serviceCallNumber: string;
  callDate: string;
  callTime: string;
  callType: string;
  priorityLevel: string;
  callStatus: string;
  problemDescription: string;
  resolutionDescription: string;
  assignedTechnicianId: string;
  technicianName?: string;
  equipmentId?: string;
  equipmentDescription?: string;
  timeOnSiteMinutes?: number;
  travelTimeMinutes?: number;
  completedDate?: string;
  customerId: string;
}

interface ServiceTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedTechnicianId?: string;
  technicianName?: string;
  scheduledDate?: string;
  estimatedDuration?: number;
  equipmentId?: string;
  equipmentDescription?: string;
  resolutionNotes?: string;
  laborHours?: number;
  partsUsed?: string[];
  createdAt: string;
  resolvedAt?: string;
}

interface CustomerServiceHistoryProps {
  customerId: string;
  customerName: string;
}

const priorityColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const statusColors = {
  open: "bg-blue-100 text-blue-800",
  assigned: "bg-yellow-100 text-yellow-800",
  dispatched: "bg-orange-100 text-orange-800",
  "in-progress": "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const callTypeColors = {
  warranty: "bg-green-100 text-green-800",
  contract: "bg-blue-100 text-blue-800",
  billable: "bg-orange-100 text-orange-800",
  internal: "bg-gray-100 text-gray-800",
};

export function CustomerServiceHistory({
  customerId,
  customerName,
}: CustomerServiceHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("tickets");

  // Fetch service tickets
  const { data: serviceTickets = [], isLoading: loadingTickets } = useQuery<
    ServiceTicket[]
  >({
    queryKey: [`/api/customers/${customerId}/service-tickets`],
    queryFn: async () => {
      const response = await fetch(
        `/api/customers/${customerId}/service-tickets`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch service tickets");
      return response.json();
    },
  });

  // Fetch service calls
  const { data: serviceCalls = [], isLoading: loadingCalls } = useQuery<
    ServiceCall[]
  >({
    queryKey: [`/api/customers/${customerId}/service-calls`],
    queryFn: async () => {
      const response = await fetch(
        `/api/customers/${customerId}/service-calls`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch service calls");
      return response.json();
    },
  });

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  const formatDateTime = (date: string) => {
    return format(new Date(date), "MMM dd, yyyy h:mm a");
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Filter service tickets
  const filteredTickets = serviceTickets.filter((ticket) => {
    const matchesSearch =
      ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.technicianName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Filter service calls
  const filteredCalls = serviceCalls.filter((call) => {
    const matchesSearch =
      call.serviceCallNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.problemDescription
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      call.technicianName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || call.callStatus === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || call.priorityLevel === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Calculate statistics
  const ticketStats = {
    total: serviceTickets.length,
    open: serviceTickets.filter((t) => t.status === "open").length,
    inProgress: serviceTickets.filter((t) => t.status === "in-progress").length,
    completed: serviceTickets.filter((t) => t.status === "completed").length,
    avgResolutionTime:
      serviceTickets
        .filter((t) => t.resolvedAt && t.createdAt)
        .reduce((acc, t) => {
          const diff =
            new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime();
          return acc + diff / (1000 * 60 * 60); // Convert to hours
        }, 0) / serviceTickets.filter((t) => t.resolvedAt).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Service Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Wrench className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{ticketStats.total}</p>
                <p className="text-sm text-gray-600">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {ticketStats.open + ticketStats.inProgress}
                </p>
                <p className="text-sm text-gray-600">Active Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{ticketStats.completed}</p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {Math.round(ticketStats.avgResolutionTime)}h
                </p>
                <p className="text-sm text-gray-600">Avg Resolution</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by ticket number, description, or technician..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Ticket
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Service Ticket</DialogTitle>
                  </DialogHeader>
                  <div className="p-4">
                    <p className="text-gray-600">
                      Service ticket creation form would go here...
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service History Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tickets">Service Tickets</TabsTrigger>
          <TabsTrigger value="calls">Service Calls</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="min-w-[120px]">Ticket #</TableHead>
                      <TableHead className="min-w-[200px]">Title</TableHead>
                      <TableHead className="min-w-[100px]">Priority</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[150px]">
                        Technician
                      </TableHead>
                      <TableHead className="min-w-[120px]">Created</TableHead>
                      <TableHead className="min-w-[120px]">Scheduled</TableHead>
                      <TableHead className="min-w-[100px]">Duration</TableHead>
                      <TableHead className="min-w-[150px]">Equipment</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTickets ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center p-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTickets.map((ticket) => (
                        <TableRow key={ticket.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="font-medium text-blue-600">
                              {ticket.ticketNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{ticket.title}</div>
                              <div className="text-sm text-gray-500 truncate max-w-[200px]">
                                {ticket.description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                priorityColors[
                                  ticket.priority as keyof typeof priorityColors
                                ]
                              }
                            >
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                statusColors[
                                  ticket.status as keyof typeof statusColors
                                ]
                              }
                            >
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {ticket.technicianName?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {ticket.technicianName || "Unassigned"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(ticket.createdAt)}</TableCell>
                          <TableCell>
                            {ticket.scheduledDate
                              ? formatDate(ticket.scheduledDate)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {ticket.estimatedDuration
                              ? formatDuration(ticket.estimatedDuration)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {ticket.equipmentDescription || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Settings className="mr-2 h-4 w-4" />
                                  Edit Ticket
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Phone className="mr-2 h-4 w-4" />
                                  Call Customer
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  Add Note
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="min-w-[120px]">Call #</TableHead>
                      <TableHead className="min-w-[100px]">Date</TableHead>
                      <TableHead className="min-w-[80px]">Type</TableHead>
                      <TableHead className="min-w-[100px]">Priority</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[200px]">Problem</TableHead>
                      <TableHead className="min-w-[150px]">
                        Technician
                      </TableHead>
                      <TableHead className="min-w-[100px]">
                        Time On Site
                      </TableHead>
                      <TableHead className="min-w-[120px]">Completed</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCalls ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center p-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCalls.map((call) => (
                        <TableRow key={call.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="font-medium text-blue-600">
                              {call.serviceCallNumber}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(call.callDate)}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                callTypeColors[
                                  call.callType as keyof typeof callTypeColors
                                ]
                              }
                            >
                              {call.callType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                priorityColors[
                                  call.priorityLevel as keyof typeof priorityColors
                                ]
                              }
                            >
                              {call.priorityLevel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                statusColors[
                                  call.callStatus as keyof typeof statusColors
                                ]
                              }
                            >
                              {call.callStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm truncate max-w-[200px]">
                              {call.problemDescription}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {call.technicianName?.charAt(0) || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {call.technicianName || "Unassigned"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {call.timeOnSiteMinutes
                              ? formatDuration(call.timeOnSiteMinutes)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {call.completedDate
                              ? formatDate(call.completedDate)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Wrench className="mr-2 h-4 w-4" />
                                  View Resolution
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* No data state */}
      {((activeTab === "tickets" && filteredTickets.length === 0) ||
        (activeTab === "calls" && filteredCalls.length === 0)) &&
        !loadingTickets &&
        !loadingCalls && (
          <Card>
            <CardContent className="p-12 text-center">
              <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No{" "}
                {activeTab === "tickets" ? "service tickets" : "service calls"}{" "}
                found
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm
                  ? `No ${
                      activeTab === "tickets" ? "tickets" : "calls"
                    } match your search criteria.`
                  : `No ${
                      activeTab === "tickets"
                        ? "service tickets"
                        : "service calls"
                    } have been created for this customer yet.`}
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create First{" "}
                {activeTab === "tickets" ? "Ticket" : "Service Call"}
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
