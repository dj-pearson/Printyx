import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  Building2,
  Target,
  Clock,
  Star,
  MessageSquare,
  Filter,
  Download,
  Upload,
  User,
  Crown,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { format } from "date-fns";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile?: string;
  title: string;
  department: string;
  salutation?: string;
  companyId: string;
  companyName: string;
  isPrimaryContact: boolean;
  leadStatus: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  ownerId: string;
  ownerName?: string;
  favoriteContentType?: string;
  preferredChannels?: string[];
  reportsTo?: string;
  contactRoles?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ContactManagerProps {
  companyId: string;
  companyName: string;
  className?: string;
}

const statusColors = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-green-100 text-green-800",
  unqualified: "bg-red-100 text-red-800",
  customer: "bg-purple-100 text-purple-800",
};

export function ContactManager({
  companyId,
  companyName,
  className,
}: ContactManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch contacts for this company
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: [`/api/companies/${companyId}/contacts`],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/contacts`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch contacts");
      return response.json();
    },
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contactData: Partial<Contact>) => {
      const response = await fetch(`/api/companies/${companyId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactData),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create contact");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/companies/${companyId}/contacts`],
      });
      setIsCreateContactOpen(false);
      toast({ title: "Success", description: "Contact created successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Contact> & { id: string }) => {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update contact");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/companies/${companyId}/contacts`],
      });
      setEditingContact(null);
      toast({ title: "Success", description: "Contact updated successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete contact");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/companies/${companyId}/contacts`],
      });
      toast({ title: "Success", description: "Contact deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Filter contacts based on search and status
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || contact.leadStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map((contact) => contact.id));
    }
  };

  const formatDate = (date: string) => {
    if (!date) return "Never";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleBulkAction = (action: string) => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select contacts to perform bulk actions",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Bulk Action",
      description: `${action} applied to ${selectedContacts.length} contacts`,
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 text-gray-600" />
          <div>
            <h3 className="text-lg font-semibold">Company Contacts</h3>
            <p className="text-sm text-gray-600">
              {filteredContacts.length} contacts at {companyName}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog
            open={isCreateContactOpen}
            onOpenChange={setIsCreateContactOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <ContactForm
                onSubmit={(data) => createContactMutation.mutate(data)}
                isLoading={createContactMutation.isPending}
                companyId={companyId}
                companyName={companyName}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search contacts by name, email, or title..."
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
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="unqualified">Unqualified</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded">
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="rounded-r-none"
                >
                  Table
                </Button>
                <Button
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="rounded-l-none"
                >
                  Cards
                </Button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedContacts.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {selectedContacts.length} contact
                {selectedContacts.length === 1 ? "" : "s"} selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("update_status")}
                >
                  Update Status
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("assign_owner")}
                >
                  Assign Owner
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("export")}
                >
                  Export
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === "table" ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedContacts.length === filteredContacts.length &&
                          filteredContacts.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="min-w-[200px]">Contact</TableHead>
                    <TableHead className="min-w-[150px]">Title</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[150px]">Phone</TableHead>
                    <TableHead className="min-w-[200px]">Email</TableHead>
                    <TableHead className="min-w-[120px]">
                      Last Contact
                    </TableHead>
                    <TableHead className="min-w-[120px]">
                      Next Follow-up
                    </TableHead>
                    <TableHead className="min-w-[100px]">Owner</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() =>
                            toggleContactSelection(contact.id)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(contact.firstName, contact.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">
                                {contact.salutation && `${contact.salutation} `}
                                {contact.firstName} {contact.lastName}
                              </span>
                              {contact.isPrimaryContact && (
                                <Crown className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {contact.department}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{contact.title}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[
                              contact.leadStatus as keyof typeof statusColors
                            ] || "bg-gray-100"
                          }
                        >
                          {contact.leadStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {contact.phone && (
                            <div className="flex items-center space-x-2">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{contact.phone}</span>
                            </div>
                          )}
                          {contact.mobile && (
                            <div className="flex items-center space-x-2">
                              <Phone className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{contact.mobile}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span className="text-sm">{contact.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatDate(contact.lastContactDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatDate(contact.nextFollowUpDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {contact.ownerName || "Unassigned"}
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
                            <DropdownMenuItem
                              onClick={() => setEditingContact(contact)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Contact
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Phone className="mr-2 h-4 w-4" />
                              Call
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Calendar className="mr-2 h-4 w-4" />
                              Schedule Meeting
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() =>
                                deleteContactMutation.mutate(contact.id)
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <Card
              key={contact.id}
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {getInitials(contact.firstName, contact.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center space-x-2">
                        <CardTitle className="text-base">
                          {contact.salutation && `${contact.salutation} `}
                          {contact.firstName} {contact.lastName}
                        </CardTitle>
                        {contact.isPrimaryContact && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{contact.title}</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={selectedContacts.includes(contact.id)}
                    onCheckedChange={() => toggleContactSelection(contact.id)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{contact.department}</span>
                  </div>
                  {contact.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{contact.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <Badge
                      className={
                        statusColors[
                          contact.leadStatus as keyof typeof statusColors
                        ] || "bg-gray-100"
                      }
                    >
                      {contact.leadStatus}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditingContact(contact)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Phone className="mr-2 h-4 w-4" />
                          Call
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" />
                          Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No contacts state */}
      {filteredContacts.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No contacts found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? "No contacts match your search criteria."
                : "Start building your contact database by adding your first contact."}
            </p>
            <Button onClick={() => setIsCreateContactOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add First Contact
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Contact Dialog */}
      {editingContact && (
        <Dialog
          open={!!editingContact}
          onOpenChange={() => setEditingContact(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
            </DialogHeader>
            <ContactForm
              initialData={editingContact}
              onSubmit={(data) =>
                updateContactMutation.mutate({ ...data, id: editingContact.id })
              }
              isLoading={updateContactMutation.isPending}
              companyId={companyId}
              companyName={companyName}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Contact Form Component
function ContactForm({
  initialData,
  onSubmit,
  isLoading,
  companyId,
  companyName,
}: {
  initialData?: Contact;
  onSubmit: (data: Partial<Contact>) => void;
  isLoading: boolean;
  companyId: string;
  companyName: string;
}) {
  const [formData, setFormData] = useState({
    salutation: initialData?.salutation || "",
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    title: initialData?.title || "",
    department: initialData?.department || "",
    phone: initialData?.phone || "",
    mobile: initialData?.mobile || "",
    email: initialData?.email || "",
    leadStatus: initialData?.leadStatus || "new",
    isPrimaryContact: initialData?.isPrimaryContact || false,
    companyId: companyId,
    companyName: companyName,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 max-h-[60vh] overflow-y-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salutation">Salutation</Label>
          <Select
            value={formData.salutation}
            onValueChange={(value) =>
              setFormData({ ...formData, salutation: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mr.">Mr.</SelectItem>
              <SelectItem value="Ms.">Ms.</SelectItem>
              <SelectItem value="Mrs.">Mrs.</SelectItem>
              <SelectItem value="Dr.">Dr.</SelectItem>
              <SelectItem value="Prof.">Prof.</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Select
            value={formData.department}
            onValueChange={(value) =>
              setFormData({ ...formData, department: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Executive">Executive</SelectItem>
              <SelectItem value="IT">IT</SelectItem>
              <SelectItem value="Operations">Operations</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="HR">Human Resources</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Purchasing">Purchasing</SelectItem>
              <SelectItem value="Administration">Administration</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            type="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            value={formData.mobile}
            onChange={(e) =>
              setFormData({ ...formData, mobile: e.target.value })
            }
            type="tel"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="leadStatus">Status</Label>
          <Select
            value={formData.leadStatus}
            onValueChange={(value) =>
              setFormData({ ...formData, leadStatus: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="unqualified">Unqualified</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isPrimaryContact"
          checked={formData.isPrimaryContact}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, isPrimaryContact: !!checked })
          }
        />
        <Label htmlFor="isPrimaryContact">Set as primary contact</Label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? "Saving..."
            : initialData
            ? "Update Contact"
            : "Create Contact"}
        </Button>
      </div>
    </form>
  );
}
