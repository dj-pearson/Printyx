import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { Badge } from '@/components/ui/badge';

/**
 * The acceptance record for a customer's installed units (WF-L-07).
 *
 * "The customer signed for it" was a claim with nothing behind it: the only
 * signature capability in the tree had no caller in any of the seven client
 * trees, and nothing captured a delivery checklist at all. This is the other
 * half of that - once a signature exists, it has to be findable from the
 * records it is about.
 */
interface AcceptanceRecord {
  installation: {
    id: string;
    installation_number?: string | null;
    serial_number?: string | null;
    model_number?: string | null;
    status?: string | null;
    completed_date?: string | null;
  };
  signatures: Array<{
    id: string;
    signature_type?: string | null;
    signer_name?: string | null;
    signer_title?: string | null;
    signature_data_url?: string | null;
    signed_at?: string | null;
  }>;
  checklist: Array<{
    id: string;
    item_name?: string | null;
    is_required?: boolean | null;
    passed?: boolean | null;
  }>;
  checklistAnswered: number;
  checklistTotal: number;
}

export function AcceptanceRecords({
  customerId,
  equipmentId,
}: {
  customerId?: string;
  equipmentId?: string;
}) {
  const query = customerId ? `customerId=${customerId}` : `equipmentId=${equipmentId}`;
  const {
    data: records = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<AcceptanceRecord[]>({
    queryKey: [`/api/field-service/acceptance?${query}`],
    enabled: Boolean(customerId || equipmentId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading acceptance records…</p>;
  }

  // CR-033: `= []` turns a FAILED request into the empty state below, which
  // says no installation has been recorded - a claim about the customer rather
  // than about the request. A signed acceptance is the evidence a machine was
  // delivered, so its absence is not a small thing to assert wrongly.
  if (isError) {
    return <InlineQueryError label="acceptance records" onRetry={refetch} />;
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No installation has been recorded for this customer yet. A signature appears here once a
          technician captures one on site.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <Card key={record.installation.id}>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base">
              {record.installation.installation_number ?? 'Installation'}
            </CardTitle>
            <CardDescription>
              {[record.installation.model_number, record.installation.serial_number]
                .filter(Boolean)
                .join(' · ') || 'Unit details not recorded'}
              {' · '}
              {record.checklistAnswered}/{record.checklistTotal} checklist item
              {record.checklistTotal === 1 ? '' : 's'} answered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {record.signatures.length === 0 ? (
              // Not "pending": nothing has been captured, and saying so beats a
              // status word that implies something is on its way.
              <p className="text-sm text-muted-foreground">No signature captured.</p>
            ) : (
              record.signatures.map((signature) => (
                <div key={signature.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{signature.signer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {signature.signer_title || 'No title recorded'}
                        {signature.signed_at
                          ? ` · ${new Date(signature.signed_at).toLocaleString()}`
                          : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{signature.signature_type}</Badge>
                  </div>
                  {signature.signature_data_url && (
                    <img
                      src={signature.signature_data_url}
                      alt={`Signature of ${signature.signer_name ?? 'the signer'}`}
                      className="mt-2 h-24 rounded border bg-white object-contain"
                    />
                  )}
                </div>
              ))
            )}

            {record.checklist.length > 0 && (
              <div className="space-y-1">
                {record.checklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{item.item_name}</span>
                    <Badge
                      variant={
                        item.passed === true
                          ? 'default'
                          : item.passed === false
                            ? 'destructive'
                            : 'secondary'
                      }
                      className="shrink-0"
                    >
                      {/* Three states, not two: an unanswered item is not a pass. */}
                      {item.passed === true
                        ? 'pass'
                        : item.passed === false
                          ? 'fail'
                          : 'unanswered'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
