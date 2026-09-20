/**
 * CrmContactsPage - Unified Contacts CRM page using CrmIndexShell.
 * Table-only view (no board) for contacts.
 * Part of CRM-010: Apply unified CRM pattern to all object types.
 */
import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { CrmIndexShell, type CrmViewRenderProps } from '@/components/crm/CrmIndexShell';
import { CrmDataTable } from '@/components/crm/CrmDataTable';
import type { BulkAction } from '@/components/ui/bulk-operations-toolbar';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// COP-M01: two corrections against the real company_contacts columns
// (shared/schema.ts:1255). The job-title field was named jobTitle, which no
// column is called - neither backend mapped it, so every contact created here
// silently lost its title. And company_id is NOT NULL, while the form left the
// company optional and offered no way to pick one, so the insert could only ever
// fail. Company is now required and chosen from the tenant's companies.
const createContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  companyId: z.string().min(1, 'Company is required'),
});

type CreateContactForm = z.infer<typeof createContactSchema>;

interface CompanyOption {
  id: string;
  companyName?: string | null;
  businessName?: string | null;
  business_name?: string | null;
}

/**
 * The two backends label the company differently - Express/Drizzle returns
 * businessName, the companies edge function spreads the raw row and adds
 * companyName - so read whichever is present rather than picking one and
 * rendering blank against the other.
 */
function companyLabel(company: CompanyOption): string {
  return company.companyName || company.businessName || company.business_name || 'Unnamed company';
}

export default function CrmContactsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const form = useForm<CreateContactForm>({
    resolver: zodResolver(createContactSchema),
    defaultValues: { firstName: '', lastName: '', companyId: '' },
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery<CompanyOption[]>({
    queryKey: ['/api/companies', { limit: 200, forContactPicker: true }],
    queryFn: async () => {
      const result: any = await apiRequest('/api/companies?limit=200&sortBy=name&sortOrder=asc');
      return Array.isArray(result) ? result : (result?.data ?? []);
    },
    enabled: showCreateDialog,
    staleTime: 60_000,
  });

  const createContactMutation = useMutation({
    mutationFn: (data: CreateContactForm) => apiRequest('/api/company-contacts', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-contacts'] });
      setShowCreateDialog(false);
      form.reset();
      toast({ title: 'Contact created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create contact', variant: 'destructive' });
    },
  });

  /**
   * COP-M01: the legacy Contacts page offered four bulk actions and THREE OF
   * THEM WERE PLACEBOS - "Send Email", "Edit Properties" and "Assign Owner"
   * each raised a toast saying what they would do and did nothing. Only Delete
   * was real, so only Delete is carried over; porting the other three would
   * move three controls that report success and change nothing onto the
   * canonical page.
   */
  const deleteContactMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/company-contacts/${id}`, 'DELETE'),
  });

  const bulkActions = useMemo<BulkAction[]>(
    () => [
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        variant: 'destructive',
        requiresConfirmation: true,
        confirmationTitle: 'Delete contacts',
        confirmationDescription: 'This removes the selected contacts. It cannot be undone.',
        onClick: async (ids: string[]) => {
          // Settled, not raced: one failure must not hide the rest, and the
          // count reported has to be what actually went.
          const results = await Promise.allSettled(
            ids.map((id) => deleteContactMutation.mutateAsync(id)),
          );
          const failed = results.filter((r) => r.status === 'rejected').length;
          await queryClient.invalidateQueries({ queryKey: ['/api/company-contacts'] });
          toast(
            failed === 0
              ? { title: `Deleted ${ids.length} contact${ids.length === 1 ? '' : 's'}` }
              : {
                  title: `Deleted ${ids.length - failed} of ${ids.length}`,
                  description: `${failed} could not be deleted.`,
                  variant: 'destructive',
                },
          );
        },
      },
    ],
    [deleteContactMutation, queryClient, toast],
  );

  const renderTable = useCallback(
    (props: CrmViewRenderProps) => (
      <CrmDataTable
        objectType="contacts"
        search={props.search}
        activeFilters={props.activeFilters}
        sortConfig={props.sortConfig}
        isFiltered={props.isFiltered}
        onClearFilters={props.onClearFilters}
        onCreateNew={props.onCreateNew}
        columnConfig={props.columnConfig}
        onColumnConfigChange={props.onColumnConfigChange}
        columnsPersist={props.columnsPersist}
      />
    ),
    [],
  );

  return (
    <MainLayout>
      <CrmIndexShell
        objectType="contacts"
        renderTable={renderTable}
        bulkActions={bulkActions}
        onCreateNew={() => setShowCreateDialog(true)}
      />

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Create New Contact</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => createContactMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              companiesLoading ? 'Loading companies...' : 'Select a company'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {companyLabel(company)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createContactMutation.isPending}>
                  {createContactMutation.isPending ? 'Creating...' : 'Create Contact'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
