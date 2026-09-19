import { useMemo, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from '@/components/field/SignaturePad';
import { ACCEPTANCE_AGREEMENT, checklistBlockers } from '@/lib/acceptance';

/**
 * Customer acceptance at delivery and installation (WF-L-07).
 *
 * The only signature capability in the tree was field-service's
 * service_signatures handler, and the whole function had no caller in any of
 * the seven client trees - so "the customer signed for it" was a claim with no
 * record behind it. Nothing captured a delivery checklist either.
 *
 * Built for a tablet held at a customer's door: one column, 44px targets, and
 * the signature pad last so the checklist is answered before anyone signs.
 */
interface ChecklistRow {
  id: string;
  installation_id: string;
  item_order: number;
  category: string;
  item_name: string;
  item_description?: string | null;
  is_required?: boolean | null;
  is_completed?: boolean | null;
  passed?: boolean | null;
  notes?: string | null;
}

interface InstallationRow {
  id: string;
  installation_number?: string | null;
  customer_id?: string | null;
  equipment_id?: string | null;
  serial_number?: string | null;
  model_number?: string | null;
  customer_name?: string | null;
  installation_address?: string | null;
  status?: string | null;
}

export default function DeliveryAcceptance() {
  const params = useParams<{ installationId: string }>();
  const installationId = params.installationId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, boolean | null>>({});
  const [notes, setNotes] = useState('');

  const { data: installation } = useQuery<InstallationRow>({
    queryKey: [`/api/field-service/installations/${installationId}`],
    enabled: Boolean(installationId),
  });

  const { data: checklist = [], isLoading: checklistLoading } = useQuery<ChecklistRow[]>({
    queryKey: [`/api/field-service/installation-checklists?installation_id=${installationId}`],
    enabled: Boolean(installationId),
  });

  // An item nobody answered is NOT a pass. The three states are deliberate:
  // undefined means untouched, false means it failed, true means it passed.
  const answered = useMemo(
    () =>
      checklist.map((item) => ({
        ...item,
        passed: results[item.id] ?? item.passed ?? null,
      })),
    [checklist, results],
  );

  const blockers = useMemo(
    () =>
      checklistBlockers(
        answered.map((item) => ({
          item_name: item.item_name,
          is_required: item.is_required ?? false,
          passed: item.passed,
        })),
      ),
    [answered],
  );

  const acceptMutation = useMutation({
    mutationFn: async () => {
      // The checklist is saved BEFORE the signature, so a signature never
      // exists without the results it attests to. If the checklist write
      // fails, nothing was signed.
      const changed = answered.filter((item) => results[item.id] !== undefined);
      for (const item of changed) {
        await apiRequest(`/api/field-service/installation-checklists/${item.id}`, 'PATCH', {
          passed: item.passed,
          isCompleted: item.passed !== null,
        });
      }

      return apiRequest('/api/field-service/service-signatures', 'POST', {
        installationId,
        signatureType: 'installation',
        signerName,
        signerTitle: signerTitle || null,
        signerEmail: signerEmail || null,
        signatureDataUrl: signature,
        signatureMethod: 'drawn',
        agreementText: ACCEPTANCE_AGREEMENT,
        consentGiven: true,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      // Nothing queries service-signatures in any tree, and this navigates away
      // to /mobile-field-service on the next line, so there was no cache to
      // refresh. The installation's own queries are unmounted with the page.
      toast({
        title: 'Acceptance recorded',
        description: 'The signature and checklist are on the equipment record.',
      });
      setLocation('/mobile-field-service');
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not record acceptance',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canSubmit = signerName.trim().length > 0 && Boolean(signature) && blockers.length === 0;

  return (
    <MainLayout
      title="Customer acceptance"
      description="Confirm the delivery and capture the customer's signature"
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">
              {installation?.installation_number ?? 'Installation'}
            </CardTitle>
            <CardDescription>
              {[installation?.model_number, installation?.serial_number]
                .filter(Boolean)
                .join(' · ') || 'Unit details not recorded'}
              {installation?.installation_address ? ` · ${installation.installation_address}` : ''}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Delivery checklist</CardTitle>
            <CardDescription>
              Every required item has to be answered before the customer signs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {checklistLoading ? (
              <p className="text-sm text-muted-foreground">Loading the checklist…</p>
            ) : answered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No checklist was prepared for this installation. The signature below still records
                the acceptance.
              </p>
            ) : (
              answered.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {item.item_name}
                        {item.is_required ? (
                          <Badge variant="outline" className="ml-2">
                            required
                          </Badge>
                        ) : null}
                      </p>
                      {item.item_description && (
                        <p className="text-sm text-muted-foreground">{item.item_description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={item.passed === true ? 'default' : 'outline'}
                        className="min-h-[44px] flex-1 touch-manipulation sm:flex-initial"
                        onClick={() => setResults((r) => ({ ...r, [item.id]: true }))}
                      >
                        Pass
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={item.passed === false ? 'destructive' : 'outline'}
                        className="min-h-[44px] flex-1 touch-manipulation sm:flex-initial"
                        onClick={() => setResults((r) => ({ ...r, [item.id]: false }))}
                      >
                        Fail
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Signature</CardTitle>
            <CardDescription>{ACCEPTANCE_AGREEMENT}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="acceptance-signer-name">
                  Signer name
                </label>
                <Input
                  id="acceptance-signer-name"
                  className="min-h-[44px]"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="acceptance-signer-title">
                  Title
                </label>
                <Input
                  id="acceptance-signer-title"
                  className="min-h-[44px]"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="acceptance-signer-email">
                Email (optional)
              </label>
              <Input
                id="acceptance-signer-email"
                type="email"
                className="min-h-[44px]"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
              />
            </div>

            <SignaturePad onChange={setSignature} label="Customer signature" />

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="acceptance-notes">
                Notes
              </label>
              <Textarea
                id="acceptance-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {blockers.length > 0 && (
              <p className="text-sm text-destructive">
                Answer these required items first: {blockers.join(', ')}
              </p>
            )}

            <Button
              type="button"
              className="min-h-[48px] w-full touch-manipulation"
              disabled={!canSubmit || acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
            >
              Record acceptance
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
