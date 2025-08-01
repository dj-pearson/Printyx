import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar,
  Edit,
  Trash2,
  Eye,
  Calculator
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { JournalEntry } from "@shared/schema";

// Form schema for journal entries
const journalEntrySchema = z.object({
  entryNumber: z.string().min(1, "Entry number is required"),
  description: z.string().min(1, "Description is required"),
  entryDate: z.string().min(1, "Entry date is required"),
  reference: z.string().optional(),
  totalDebit: z.number().min(0, "Total debit must be positive"),
  totalCredit: z.number().min(0, "Total credit must be positive"),
  status: z.string().default("draft"),
  notes: z.string().optional(),
}).refine((data) => data.totalDebit === data.totalCredit, {
  message: "Total debits must equal total credits",
  path: ["totalCredit"],
});

type JournalEntryFormData = z.infer<typeof journalEntrySchema>;

export default function JournalEntries() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["/api/journal-entries"],
  });

  const form = useForm<JournalEntryFormData>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      entryNumber: "",
      description: "",
      entryDate: new Date().toISOString().split('T')[0],
      reference: "",
      totalDebit: 0,
      totalCredit: 0,
      status: "draft",
      notes: "",
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: (data: JournalEntryFormData) => apiRequest("/api/journal-entries", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Journal entry created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create journal entry",
        variant: "destructive",
      });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<JournalEntryFormData> }) =>
      apiRequest(`/api/journal-entries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      setIsDialogOpen(false);
      setEditingEntry(null);
      form.reset();
      toast({
        title: "Success",
        description: "Journal entry updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update journal entry",
        variant: "destructive",
      });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/journal-entries/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      toast({
        title: "Success",
        description: "Journal entry deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete journal entry",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (entry?: JournalEntry) => {
    if (entry) {
      setEditingEntry(entry);
      form.reset({
        entryNumber: entry.entryNumber,
        description: entry.description,
        entryDate: entry.entryDate,
        reference: entry.reference || "",
        totalDebit: entry.totalDebit,
        totalCredit: entry.totalCredit,
        status: entry.status,
        notes: entry.notes || "",
      });
    } else {
      setEditingEntry(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: JournalEntryFormData) => {
    if (editingEntry) {
      updateEntryMutation.mutate({ id: editingEntry.id, data });
    } else {
      createEntryMutation.mutate(data);
    }
  };

  const handleDelete = (entry: JournalEntry) => {
    if (confirm(`Are you sure you want to delete journal entry ${entry.entryNumber}?`)) {
      deleteEntryMutation.mutate(entry.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "posted":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredEntries = entries.filter((entry: JournalEntry) => {
    const matchesSearch = 
      entry.entryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.reference && entry.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || entry.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Journal Entries</h1>
          <p className="text-sm text-gray-600">
            Record and manage accounting journal entries for your business
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? "Edit Journal Entry" : "New Journal Entry"}
              </DialogTitle>
              <DialogDescription>
                {editingEntry
                  ? "Update journal entry information."
                  : "Create a new accounting journal entry."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="entryNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entry Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="JE-2025-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="entryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entry Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference</FormLabel>
                        <FormControl>
                          <Input placeholder="Invoice #, Receipt #, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="posted">Posted</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of the transaction" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalDebit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Debit *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalCredit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Credit *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional notes or details..."
                          className="resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createEntryMutation.isPending || updateEntryMutation.isPending}
                  >
                    {editingEntry ? "Update" : "Create"} Entry
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filteredEntries.map((entry: JournalEntry) => (
          <Card key={entry.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {entry.entryNumber}
                      </span>
                      <Badge className={getStatusColor(entry.status)}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <p>{entry.description}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(entry.entryDate).toLocaleDateString()}
                        </span>
                        {entry.reference && (
                          <span>Ref: {entry.reference}</span>
                        )}
                        <span className="flex items-center">
                          <Calculator className="h-3 w-3 mr-1" />
                          Debit: ${entry.totalDebit.toFixed(2)} | Credit: ${entry.totalCredit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingEntry(entry)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDialog(entry)}
                    disabled={entry.status === "posted"}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(entry)}
                    className="text-red-600 hover:text-red-700"
                    disabled={entry.status === "posted"}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEntries.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No journal entries found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== "all" 
              ? "No entries match your search criteria." 
              : "Get started by creating your first journal entry."}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          )}
        </div>
      )}

      {/* View Entry Dialog */}
      <Dialog open={!!viewingEntry} onOpenChange={() => setViewingEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
            <DialogDescription>
              View complete journal entry information.
            </DialogDescription>
          </DialogHeader>
          {viewingEntry && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">Entry Information</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div><span className="text-gray-600">Entry Number:</span> {viewingEntry.entryNumber}</div>
                    <div><span className="text-gray-600">Date:</span> {new Date(viewingEntry.entryDate).toLocaleDateString()}</div>
                    <div><span className="text-gray-600">Status:</span> 
                      <Badge className={`ml-1 ${getStatusColor(viewingEntry.status)}`}>
                        {viewingEntry.status.charAt(0).toUpperCase() + viewingEntry.status.slice(1)}
                      </Badge>
                    </div>
                    {viewingEntry.reference && (
                      <div><span className="text-gray-600">Reference:</span> {viewingEntry.reference}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Amounts</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div><span className="text-gray-600">Total Debit:</span> ${viewingEntry.totalDebit.toFixed(2)}</div>
                    <div><span className="text-gray-600">Total Credit:</span> ${viewingEntry.totalCredit.toFixed(2)}</div>
                    <div><span className="text-gray-600">Balance:</span> 
                      {viewingEntry.totalDebit === viewingEntry.totalCredit ? 
                        <span className="text-green-600 ml-1">Balanced</span> : 
                        <span className="text-red-600 ml-1">Unbalanced</span>
                      }
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900">Description</h3>
                <p className="mt-1 text-sm text-gray-600">{viewingEntry.description}</p>
              </div>
              
              {viewingEntry.notes && (
                <div>
                  <h3 className="font-medium text-gray-900">Notes</h3>
                  <p className="mt-1 text-sm text-gray-600">{viewingEntry.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingEntry(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}