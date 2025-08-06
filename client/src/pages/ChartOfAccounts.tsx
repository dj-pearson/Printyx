import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  Plus, 
  Search, 
  FolderTree,
  Edit,
  Trash2,
  Eye,
  ChevronRight,
  ChevronDown
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
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ChartOfAccount } from "@shared/schema";

// Form schema for chart of accounts creation/editing
const chartOfAccountSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  accountName: z.string().min(1, "Account name is required"),
  accountType: z.string().min(1, "Account type is required"),
  parentAccountId: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isSubAccount: z.boolean().default(false),
  category: z.string().optional(),
  normalBalance: z.string().min(1, "Normal balance is required"),
  taxRelevant: z.boolean().default(false),
  bankAccount: z.boolean().default(false),
});

type ChartOfAccountFormData = z.infer<typeof chartOfAccountSchema>;

export default function ChartOfAccounts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [viewingAccount, setViewingAccount] = useState<ChartOfAccount | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["/api/chart-of-accounts"],
  });

  const form = useForm<ChartOfAccountFormData>({
    resolver: zodResolver(chartOfAccountSchema),
    defaultValues: {
      accountCode: "",
      accountName: "",
      accountType: "",
      parentAccountId: "",
      description: "",
      isActive: true,
      isSubAccount: false,
      category: "",
      normalBalance: "",
      taxRelevant: false,
      bankAccount: false,
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: ChartOfAccountFormData) => apiRequest("/api/chart-of-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Account created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive",
      });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ChartOfAccountFormData> }) =>
      apiRequest(`/api/chart-of-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
      setIsDialogOpen(false);
      setEditingAccount(null);
      form.reset();
      toast({
        title: "Success",
        description: "Account updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update account",
        variant: "destructive",
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/chart-of-accounts/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (account?: ChartOfAccount) => {
    if (account) {
      setEditingAccount(account);
      form.reset({
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        parentAccountId: account.parentAccountId || "",
        description: account.description || "",
        isActive: account.isActive,
        isSubAccount: account.isSubAccount,
        category: account.category || "",
        normalBalance: account.normalBalance,
        taxRelevant: account.taxRelevant,
        bankAccount: account.bankAccount,
      });
    } else {
      setEditingAccount(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ChartOfAccountFormData) => {
    if (editingAccount) {
      updateAccountMutation.mutate({ id: editingAccount.id, data });
    } else {
      createAccountMutation.mutate(data);
    }
  };

  const handleDelete = (account: ChartOfAccount) => {
    if (confirm(`Are you sure you want to delete ${account.accountName}?`)) {
      deleteAccountMutation.mutate(account.id);
    }
  };

  const toggleExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "asset":
        return "bg-green-100 text-green-800";
      case "liability":
        return "bg-red-100 text-red-800";
      case "equity":
        return "bg-blue-100 text-blue-800";
      case "revenue":
        return "bg-yellow-100 text-yellow-800";
      case "expense":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getParentAccountName = (parentId: string) => {
    const parent = accounts.find((acc: ChartOfAccount) => acc.id === parentId);
    return parent?.accountName || "";
  };

  // Group accounts by parent-child relationships
  const groupedAccounts = accounts.reduce((acc: any, account: ChartOfAccount) => {
    if (!account.parentAccountId) {
      // Main account
      if (!acc[account.id]) {
        acc[account.id] = { account, children: [] };
      }
    } else {
      // Sub account
      if (!acc[account.parentAccountId]) {
        acc[account.parentAccountId] = { account: null, children: [] };
      }
      acc[account.parentAccountId].children.push(account);
    }
    return acc;
  }, {});

  const filteredAccounts = accounts.filter((account: ChartOfAccount) => {
    const matchesSearch = 
      account.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.description && account.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = typeFilter === "all" || account.accountType.toLowerCase() === typeFilter.toLowerCase();
    
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <MainLayout>
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
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Chart of Accounts</h1>
          <p className="text-sm text-gray-600">
            Manage your company's account structure and financial categories
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Edit Account" : "Add New Account"}
              </DialogTitle>
              <DialogDescription>
                {editingAccount
                  ? "Update account information and settings."
                  : "Create a new account for your chart of accounts."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="accountCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="1000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Cash and Cash Equivalents" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Asset">Asset</SelectItem>
                            <SelectItem value="Liability">Liability</SelectItem>
                            <SelectItem value="Equity">Equity</SelectItem>
                            <SelectItem value="Revenue">Revenue</SelectItem>
                            <SelectItem value="Expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="normalBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Normal Balance *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select normal balance" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Debit">Debit</SelectItem>
                            <SelectItem value="Credit">Credit</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parentAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select parent account" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None (Main Account)</SelectItem>
                            {accounts
                              .filter((acc: ChartOfAccount) => !acc.parentAccountId)
                              .map((account: ChartOfAccount) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.accountCode} - {account.accountName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="Current Assets, Fixed Assets, etc." {...field} />
                        </FormControl>
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional details about this account..."
                          className="resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Account Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active Account</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Enable this account for transactions
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="taxRelevant"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Tax Relevant</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Include in tax reporting
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bankAccount"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Bank Account</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              This is a bank account
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

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
                    disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
                  >
                    {editingAccount ? "Update" : "Create"} Account
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
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="asset">Asset</SelectItem>
            <SelectItem value="liability">Liability</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="revenue">Revenue</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filteredAccounts.map((account: ChartOfAccount) => (
          <Card key={account.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {account.parentAccountId && (
                      <div className="w-4 h-4 flex items-center justify-center">
                        <div className="w-2 h-px bg-gray-300"></div>
                      </div>
                    )}
                    <Calculator className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {account.accountCode} - {account.accountName}
                      </span>
                      {!account.isActive && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                      {account.bankAccount && (
                        <Badge variant="outline" className="text-xs">Bank</Badge>
                      )}
                      {account.taxRelevant && (
                        <Badge variant="outline" className="text-xs">Tax</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                      <Badge className={getAccountTypeColor(account.accountType)}>
                        {account.accountType}
                      </Badge>
                      <span>Balance: {account.normalBalance}</span>
                      {account.category && (
                        <span>Category: {account.category}</span>
                      )}
                      {account.parentAccountId && (
                        <span>Parent: {getParentAccountName(account.parentAccountId)}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingAccount(account)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDialog(account)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(account)}
                    className="text-red-600 hover:text-red-700"
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

      {filteredAccounts.length === 0 && (
        <div className="text-center py-12">
          <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || typeFilter !== "all" 
              ? "No accounts match your search criteria." 
              : "Get started by creating your first account."}
          </p>
          {!searchTerm && typeFilter === "all" && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          )}
        </div>
      )}

      {/* View Account Dialog */}
      <Dialog open={!!viewingAccount} onOpenChange={() => setViewingAccount(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Account Details</DialogTitle>
            <DialogDescription>
              View complete account information and settings.
            </DialogDescription>
          </DialogHeader>
          {viewingAccount && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">Account Information</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div><span className="text-gray-600">Account Code:</span> {viewingAccount.accountCode}</div>
                    <div><span className="text-gray-600">Account Name:</span> {viewingAccount.accountName}</div>
                    <div><span className="text-gray-600">Account Type:</span> {viewingAccount.accountType}</div>
                    <div><span className="text-gray-600">Normal Balance:</span> {viewingAccount.normalBalance}</div>
                    {viewingAccount.category && (
                      <div><span className="text-gray-600">Category:</span> {viewingAccount.category}</div>
                    )}
                    {viewingAccount.parentAccountId && (
                      <div><span className="text-gray-600">Parent Account:</span> {getParentAccountName(viewingAccount.parentAccountId)}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Settings</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <div><span className="text-gray-600">Status:</span> {viewingAccount.isActive ? "Active" : "Inactive"}</div>
                    <div><span className="text-gray-600">Tax Relevant:</span> {viewingAccount.taxRelevant ? "Yes" : "No"}</div>
                    <div><span className="text-gray-600">Bank Account:</span> {viewingAccount.bankAccount ? "Yes" : "No"}</div>
                    <div><span className="text-gray-600">Sub Account:</span> {viewingAccount.isSubAccount ? "Yes" : "No"}</div>
                  </div>
                </div>
              </div>
              
              {viewingAccount.description && (
                <div>
                  <h3 className="font-medium text-gray-900">Description</h3>
                  <p className="mt-1 text-sm text-gray-600">{viewingAccount.description}</p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setViewingAccount(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}