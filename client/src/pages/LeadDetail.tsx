/**
 * Lead record page (CRM-008 AC10).
 *
 * This used to be 2,305 lines, of which about 1,400 were a hand-rolled form:
 * four collapsible cards on an `isEditing` flag, every field written out twice
 * - once as a read-only span and once as an Input - plus a 30-key `editForm`
 * mirror of the record and a bulk Save.
 *
 * All of it is `propertyFields` now. The layout engine renders the sections,
 * `onFieldSave` writes one field at a time, and which sections exist is
 * per-tenant configuration rather than JSX. DealDetail has worked this way
 * since CRM-008 shipped; this is the other half of its AC10.
 *
 * THE BULK SAVE IS GONE ON PURPOSE, and not only because inline editing is what
 * AC4 asks for: `editForm` was 30 camelCase keys posted in one body, and
 * COP-M01 found that PUT /leads/:id spread the body straight into PostgREST, so
 * that button answered "Failed to update lead" in production every single time.
 * Per-field saves go through the same endpoint, now mapped and whitelisted.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityForm } from '@/components/forms/ActivityForms';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { NotesPanel } from '@/components/crm/NotesPanel';
import { ContactManager } from '@/components/ContactManager';
import { LeadProposals } from '@/components/leads/LeadProposals';
import { EnrollInSequenceDialog } from '@/components/leads/EnrollInSequenceDialog';
import { BookingLinkPicker } from '@/components/booking/BookingLinkPicker';
import { LeadQuotes } from '@/components/leads/LeadQuotes';
import { LeadDeals } from '@/components/leads/LeadDeals';
import {
  RecordPageLayout,
  RecordStageBar,
  type RecordStage,
} from '@/components/crm/RecordPageLayout';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CalendarClock,
  CheckSquare,
  FileText,
  Mail,
  PhoneCall,
  Plus,
  Send,
  StickyNote,
  UserPlus,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs';
// Lead Contact Form Component
function LeadContactForm({
  leadId,
  onSuccess,
  onCancel,
}: {
  leadId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    title: '',
    email: '',
    phone: '',
    isPrimary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.firstName || !formData.lastName) {
      console.error('Validation failed: Missing required fields');
      toast({
        title: 'Validation Error',
        description: 'First name and last name are required.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest(`/api/leads/${leadId}/contacts`, {
        method: 'POST',
        body: formData,
      });

      onSuccess();
    } catch (error) {
      // apiRequest throws an Error carrying the server's message; there is no
      // `.response` on it, so the old `error.response?.data?.message` chain was
      // always undefined and every failure read "Failed to create contact".
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error creating lead contact:', message);
      toast({
        title: 'Error',
        description: message || 'Failed to create contact. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isPrimary"
          checked={formData.isPrimary}
          onCheckedChange={(checked) => setFormData({ ...formData, isPrimary: !!checked })}
        />
        <Label htmlFor="isPrimary">Set as primary contact</Label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Contact'}
        </Button>
      </div>
    </form>
  );
}

/** Shape of GET /api/crm/record-counts (CRM-008 AC6). A null count is unknown, not zero. */
interface RecordCounts {
  recordId: string;
  counts: {
    contacts: number | null;
    deals: number | null;
    proposals: number | null;
    quotes: number | null;
  };
  scopeTier: string;
  coversWholeTenant: boolean;
}

export default function LeadDetailHubspot() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // The slug IS the uuid on this route.
  const id = slug ?? '';
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showBookingLink, setShowBookingLink] = useState(false);
  const [dialogs, setDialogs] = useState({
    note: false,
    email: false,
    call: false,
    meeting: false,
    task: false,
    addContact: false,
  });

  const { data: leadRaw, isLoading } = useQuery({
    queryKey: ['/api/leads', id],
    queryFn: async () => apiRequest(`/api/leads/${id}`),
    enabled: !!id,
  });

  /**
   * GET /leads/:id returns the RAW row - it is the one read path in that
   * function with no toCamel - so the page normalises it. The layout's
   * propertyFields name the keys this produces, and anything it names that is
   * missing comes back in the engine's `unknownFields` rather than rendering as
   * a blank row (CRM-008 rule 3).
   *
   * `??` and not `||`: a lead score of 0 and an estimated value of 0 are real
   * values, and `||` sent both to the undefined camelCase key, so a zero
   * rendered as empty.
   */
  const rawData = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
  const lead = rawData
    ? {
        ...rawData,
        companyName: rawData.company_name ?? rawData.companyName,
        primaryContactName: rawData.primary_contact_name ?? rawData.primaryContactName,
        primaryContactEmail: rawData.primary_contact_email ?? rawData.primaryContactEmail,
        primaryContactPhone: rawData.primary_contact_phone ?? rawData.primaryContactPhone,
        primaryContactTitle: rawData.primary_contact_title ?? rawData.primaryContactTitle,
        addressLine1: rawData.address_line1 ?? rawData.addressLine1,
        addressLine2: rawData.address_line2 ?? rawData.addressLine2,
        postalCode: rawData.postal_code ?? rawData.postalCode,
        recordType: rawData.record_type ?? rawData.recordType,
        leadScore: rawData.lead_score ?? rawData.leadScore,
        estimatedDealValue: rawData.estimated_deal_value ?? rawData.estimatedDealValue,
        closeDate: rawData.close_date ?? rawData.closeDate,
        ownerId: rawData.owner_id ?? rawData.ownerId,
        assignedSalesRep: rawData.assigned_sales_rep ?? rawData.assignedSalesRep,
        interestLevel: rawData.interest_level ?? rawData.interestLevel,
        customerNumber: rawData.customer_number ?? rawData.customerNumber,
        lastContactDate: rawData.last_contact_date ?? rawData.lastContactDate,
        nextFollowUpDate: rawData.next_follow_up_date ?? rawData.nextFollowUpDate,
        createdAt: rawData.created_at ?? rawData.createdAt,
        updatedAt: rawData.updated_at ?? rawData.updatedAt,
        employeeCount: rawData.employee_count ?? rawData.employeeCount,
        annualRevenue: rawData.annual_revenue ?? rawData.annualRevenue,
        creditLimit: rawData.credit_limit ?? rawData.creditLimit,
        paymentTerms: rawData.payment_terms ?? rawData.paymentTerms,
        taxId: rawData.tax_id ?? rawData.taxId,
        customerTier: rawData.customer_tier ?? rawData.customerTier,
      }
    : null;

  const breadcrumbItems = useBreadcrumbs({
    currentLabel: lead?.companyName || 'Lead Detail',
  });

  /**
   * One field at a time, which is what the layout engine hands us.
   *
   * The endpoint maps camelCase to columns and reports what it could not write
   * (COP-M01), so a field this page sends under a name the table does not carry
   * comes back in `ignoredFields` instead of vanishing.
   */
  /**
   * CRM-008 AC8 on the lead side. DealDetail has had the stage picker since the
   * story shipped and this page rendered `status` as a read-only Badge, so a
   * rep could not advance a lead from its own record - they had to find it on a
   * board.
   *
   * The vocabulary comes from GET /api/sales-pipeline/stages, which COP-E02
   * made the ONE source for it: these ids are `business_records.status` values,
   * NOT `pipeline_stages` uuids, and comparing the two silently yields -1 (that
   * story's original defect advanced every record to the first stage). Asking
   * the server rather than hardcoding the list is what keeps this page and the
   * board on the same nine words.
   */
  const { data: stageRows = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/sales-pipeline/stages'],
    queryFn: async () => {
      // The endpoint answers a bare array; tolerate the two envelope shapes the
      // other CRM reads use rather than assuming one.
      const raw = (await apiRequest('/api/sales-pipeline/stages')) as
        | unknown[]
        | { data?: unknown[]; stages?: unknown[] }
        | null;
      const list: unknown[] = Array.isArray(raw)
        ? raw
        : ((raw?.data ?? raw?.stages ?? []) as unknown[]);
      return list.filter(
        (row): row is { id: string; name: string } =>
          typeof row === 'object' &&
          row !== null &&
          typeof (row as { id?: unknown }).id === 'string',
      );
    },
    staleTime: 5 * 60_000,
  });

  /**
   * A status outside the vocabulary belongs to no stage, and leaving it out
   * would render the bar with nothing highlighted - which reads as "not
   * started" rather than "this word is not one of ours". It is appended instead
   * so the rep can see where the record actually is, the same way the board
   * lists those rows rather than dropping them.
   */
  const stages = useMemo<RecordStage[]>(() => {
    const known = stageRows.map((s) => ({ id: s.id, name: s.name }));
    const current = lead?.status;
    if (current && !known.some((s) => s.id === current)) {
      known.push({ id: current, name: current });
    }
    return known;
  }, [stageRows, lead?.status]);

  const saveField = useMutation({
    mutationFn: async (patch: Record<string, unknown>) =>
      apiRequest(`/api/leads/${id}`, 'PUT', patch),
    onSuccess: (result: { ignoredFields?: string[]; refusedFields?: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      const dropped = [...(result?.ignoredFields ?? []), ...(result?.refusedFields ?? [])];
      if (dropped.length > 0) {
        toast({
          title: 'Saved, but not everything',
          description: `The server did not store: ${dropped.join(', ')}.`,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Saved' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update this lead.',
        variant: 'destructive',
      });
    },
  });

  /**
   * AC6's counts.
   *
   * One request rather than four list fetches: Radix unmounts an inactive tab,
   * so a count lifted out of each child would only appear once a rep had
   * clicked through all four - a number that shows up after you look is worth
   * less than none. `GET /crm/record-counts` answers all four as exact
   * PostgREST head counts under the SAME ownership scope each list applies, so
   * the badge and the rows below it describe one set.
   */
  const { data: counts } = useQuery<RecordCounts>({
    queryKey: ['/api/crm/record-counts', id],
    queryFn: () => apiRequest(`/api/crm/record-counts?recordId=${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
  });

  /** Renders nothing while loading or when the count failed - never a 0. */
  const countBadge = (value: number | null | undefined) =>
    typeof value === 'number' ? (
      <span className="ml-1.5 text-xs text-muted-foreground">{value}</span>
    ) : null;

  if (isLoading) {
    // Skeletons in the shape of the page, matching DealDetail. A spinner tells
    // the rep nothing about what is coming.
    return (
      <MainLayout>
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!lead) {
    return (
      <MainLayout title="Lead Not Found" description="The requested lead could not be found">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Lead not found</h3>
          <p className="text-gray-600 mb-4">
            The lead you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button onClick={() => setLocation('/leads-management')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </div>
      </MainLayout>
    );
  }

  const openDialog = (key: keyof typeof dialogs) =>
    setDialogs((prev) => ({ ...prev, [key]: true }));
  const closeDialog = (key: keyof typeof dialogs) =>
    setDialogs((prev) => ({ ...prev, [key]: false }));

  const timelineSlot = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => openDialog('note')}>
          <Plus className="h-4 w-4 mr-1" /> Note
        </Button>
        <Button variant="outline" size="sm" onClick={() => openDialog('call')}>
          <PhoneCall className="h-4 w-4 mr-1" /> Log call
        </Button>
        <Button variant="outline" size="sm" onClick={() => openDialog('email')}>
          <Mail className="h-4 w-4 mr-1" /> Log email
        </Button>
        <Button variant="outline" size="sm" onClick={() => openDialog('meeting')}>
          <Calendar className="h-4 w-4 mr-1" /> Meeting
        </Button>
        <Button variant="outline" size="sm" onClick={() => openDialog('task')}>
          <CheckSquare className="h-4 w-4 mr-1" /> Task
        </Button>
      </div>
      <NotesPanel parentType="lead" parentId={id} />
      <ActivityTimeline businessRecordId={id} />
    </div>
  );

  const relatedSlot = (
    <Tabs defaultValue="contacts" className="w-full">
      <TabsList>
        <TabsTrigger value="contacts">Contacts{countBadge(counts?.counts.contacts)}</TabsTrigger>
        <TabsTrigger value="deals">Deals{countBadge(counts?.counts.deals)}</TabsTrigger>
        <TabsTrigger value="proposals">Proposals{countBadge(counts?.counts.proposals)}</TabsTrigger>
        <TabsTrigger value="quotes">Quotes{countBadge(counts?.counts.quotes)}</TabsTrigger>
      </TabsList>
      <TabsContent value="contacts" className="mt-4">
        {/* WF-S-03: business_records has no company_id column, so a contact's
            company_id references the lead's own id - which is this record. */}
        <ContactManager companyId={lead.id ?? ''} companyName={lead.companyName || 'Unknown'} />
      </TabsContent>
      <TabsContent value="deals" className="mt-4">
        <LeadDeals leadId={lead.id ?? ''} leadName={lead.companyName || 'Unknown Lead'} />
      </TabsContent>
      <TabsContent value="proposals" className="mt-4">
        <LeadProposals leadId={lead.id ?? ''} leadName={lead.companyName || 'Unknown Lead'} />
      </TabsContent>
      <TabsContent value="quotes" className="mt-4">
        <LeadQuotes leadId={lead.id ?? ''} leadName={lead.companyName || 'Unknown Lead'} />
      </TabsContent>
    </Tabs>
  );

  const stamp = (value: unknown) => (value ? format(new Date(String(value)), 'MMM d, yyyy') : '—');

  const glanceSlot = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">At a glance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Lead score</span>
          <Badge variant={lead.leadScore > 70 ? 'default' : 'secondary'}>
            {lead.leadScore ?? 0}/100
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Interest</span>
          <Badge variant={lead.interestLevel === 'hot' ? 'destructive' : 'secondary'}>
            {lead.interestLevel || 'not set'}
          </Badge>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Created</span>
          <span>{stamp(lead.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last contact</span>
          <span>{stamp(lead.lastContactDate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Next follow-up</span>
          <span>{stamp(lead.nextFollowUpDate)}</span>
        </div>
        <Separator />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => openDialog('addContact')}
        >
          <UserPlus className="h-4 w-4 mr-1" /> Add contact
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <Breadcrumbs items={breadcrumbItems} />

        <Button variant="ghost" size="sm" onClick={() => setLocation('/leads-management')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to leads
        </Button>

        <RecordPageLayout
          objectType="leads"
          record={lead as Record<string, unknown>}
          title={lead.companyName || 'Unnamed Lead'}
          titleField="companyName"
          subtitle={lead.industry || undefined}
          badges={
            <>
              <Badge variant={lead.status === 'qualified' ? 'default' : 'secondary'}>
                {lead.status || 'new'}
              </Badge>
              {lead.customerNumber && <Badge variant="outline">{lead.customerNumber}</Badge>}
            </>
          }
          headerContent={
            <RecordStageBar
              stages={stages}
              currentStageId={lead.status}
              onChange={(stageId) => saveField.mutate({ status: stageId })}
              disabled={saveField.isPending}
            />
          }
          quickActions={[
            {
              label: 'Create deal',
              icon: <Briefcase className="h-4 w-4" />,
              onClick: () =>
                setLocation(
                  `/crm/deals?leadId=${id}&companyName=${encodeURIComponent(lead.companyName || '')}`,
                ),
            },
            {
              label: 'Log activity',
              icon: <StickyNote className="h-4 w-4" />,
              onClick: () => openDialog('note'),
            },
            {
              label: 'Schedule demo',
              icon: <Calendar className="h-4 w-4" />,
              onClick: () =>
                setLocation(
                  `/demo-scheduling?leadId=${id}&companyName=${encodeURIComponent(lead.companyName || '')}`,
                ),
            },
            {
              label: 'Build proposal',
              icon: <FileText className="h-4 w-4" />,
              onClick: () => setLocation(`/quotes/new?leadId=${id}`),
            },
            {
              // WF-S-04: enrolment used to live only on the campaign screen.
              label: 'Enroll in sequence',
              icon: <Send className="h-4 w-4" />,
              onClick: () => setShowEnrollDialog(true),
            },
            {
              // COP-B14 AC5: the booking link was copyable only from the
              // booking-pages admin, two navigations away from the prospect
              // it is meant to be sent to.
              label: 'Booking link',
              icon: <CalendarClock className="h-4 w-4" />,
              onClick: () => setShowBookingLink(true),
            },
          ]}
          onFieldSave={async (field, value) => {
            await saveField.mutateAsync({ [field]: value === '' ? null : value });
          }}
          slots={{
            'lead-timeline': timelineSlot,
            'lead-related': relatedSlot,
            'lead-associations': glanceSlot,
          }}
        />
      </div>

      <ActivityForm
        isOpen={dialogs.call}
        onClose={() => closeDialog('call')}
        businessRecordId={id}
        activityType="call"
        recordType="lead"
        recordName={lead.companyName}
      />
      <ActivityForm
        isOpen={dialogs.email}
        onClose={() => closeDialog('email')}
        businessRecordId={id}
        activityType="email"
        recordType="lead"
        recordName={lead.companyName}
      />
      <ActivityForm
        isOpen={dialogs.meeting}
        onClose={() => closeDialog('meeting')}
        businessRecordId={id}
        activityType="meeting"
        recordType="lead"
        recordName={lead.companyName}
      />
      <ActivityForm
        isOpen={dialogs.note}
        onClose={() => closeDialog('note')}
        businessRecordId={id}
        activityType="note"
        recordType="lead"
        recordName={lead.companyName}
      />
      <ActivityForm
        isOpen={dialogs.task}
        onClose={() => closeDialog('task')}
        businessRecordId={id}
        activityType="task"
        recordType="lead"
        recordName={lead.companyName}
      />

      <Dialog open={dialogs.addContact} onOpenChange={(open) => !open && closeDialog('addContact')}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <LeadContactForm
            leadId={id}
            onSuccess={() => {
              closeDialog('addContact');
              // Contacts come back inside the lead payload; a key LONGER than
              // an existing one is not a prefix of it, so an
              // ['/api/leads', id, 'contacts'] key would match nothing.
              queryClient.invalidateQueries({ queryKey: ['/api/leads', id] });
              toast({ title: 'Success', description: 'Contact created successfully' });
            }}
            onCancel={() => closeDialog('addContact')}
          />
        </DialogContent>
      </Dialog>

      {/* WF-S-04 */}
      <EnrollInSequenceDialog
        open={showEnrollDialog}
        onOpenChange={setShowEnrollDialog}
        records={
          lead?.id
            ? [
                {
                  id: lead.id,
                  email: lead.primaryContactEmail ?? null,
                  name: lead.companyName ?? null,
                },
              ]
            : []
        }
      />

      {/* COP-B14 AC5 */}
      <BookingLinkPicker open={showBookingLink} onOpenChange={setShowBookingLink} />
    </MainLayout>
  );
}
