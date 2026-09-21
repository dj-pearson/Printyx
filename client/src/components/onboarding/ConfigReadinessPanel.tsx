/**
 * "Will meters and scanning actually work when I leave?" (WF-L-11.)
 *
 * A technician finishing the network functional check has no way to find out
 * today. Meter scraping needs an `oid_mappings` row for the manufacturer and
 * model; scan-to-email needs an address book on the customer. Both live on
 * admin pages - /oid-management and /service/address-books - and nothing sends
 * anybody to either, so the gap is discovered a month later when the meter
 * billing is short or the scan button goes nowhere.
 *
 * READ-ONLY. This panel reports and links; it never creates a mapping or a
 * book, because deciding which OID bundle a model should poll with is an
 * admin's call and the catalogue is shared across every dealer on the
 * deployment.
 *
 * WHAT IT REFUSES TO CLAIM matters more than what it shows:
 *
 *   - A device with no manufacturer or model typed in is UNKNOWN, not missing.
 *     "Not set up" over a blank model field sends somebody to fix nothing.
 *   - A read that failed renders an error, never an empty state - the whole
 *     reason CR-033 exists.
 *   - With no customer selected the address-book half says so rather than
 *     reporting zero books, because zero is a measurement.
 *   - Scan-to-email is DERIVED (an MFP, a scanner, a scan feature, an SMTP
 *     name) because no field on this checklist asks. The derivation is printed
 *     so nobody reads it as a stored fact.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertTriangle, CheckCircle2, ExternalLink, HelpCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { apiRequest } from '@/lib/queryClient';
import type { DeviceCoverage, DeviceRef, ScanRequirement } from '@shared/onboarding-readiness';

interface ReadinessResponse {
  oid: {
    devices: DeviceCoverage[];
    covered: number;
    uncovered: number;
    unknown: number;
    catalogueEmpty: boolean;
  } | null;
  oidCatalogueIsShared: boolean;
  addressBook: {
    scan: ScanRequirement;
    customerId: string | null;
    bookCount: number | null;
    books: Array<{ id: string; name: string; source_vendor?: string | null }>;
  };
  degraded: string[];
  unbacked: string[];
}

export interface ConfigReadinessPanelProps {
  customerId: string | null;
  devices: DeviceRef[];
}

const BASIS_COPY: Record<DeviceCoverage['basis'], { label: string; tone: string }> = {
  'model-series': { label: 'Meters supported', tone: 'text-green-700' },
  'manufacturer-default': { label: 'Generic mapping', tone: 'text-amber-700' },
  none: { label: 'No OID mapping', tone: 'text-red-700' },
  unknown: { label: 'Model not entered', tone: 'text-gray-600' },
};

function BasisIcon({ basis }: { basis: DeviceCoverage['basis'] }) {
  if (basis === 'model-series') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (basis === 'manufacturer-default') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  if (basis === 'unknown') return <HelpCircle className="h-4 w-4 text-gray-400" />;
  return <AlertTriangle className="h-4 w-4 text-red-600" />;
}

export function ConfigReadinessPanel({ customerId, devices }: ConfigReadinessPanelProps) {
  // Only the fields the endpoint reads travel in the URL. Serials, addresses and
  // contacts stay out of a query string that ends up in access logs.
  const payload = devices.map((d) => ({
    manufacturer: d.manufacturer ?? null,
    model: d.model ?? null,
    equipmentType: d.equipmentType ?? null,
    features: d.features ?? [],
    smtpName: d.smtpName ?? null,
  }));
  const search = new URLSearchParams();
  if (customerId) search.set('customerId', customerId);
  search.set('devices', JSON.stringify(payload));
  const path = `/api/onboarding/config-readiness?${search.toString()}`;

  const { data, isLoading, isError, refetch } = useQuery<ReadinessResponse>({
    queryKey: [path],
    queryFn: () => apiRequest(path),
    // The wizard re-renders on every keystroke in the equipment step; the
    // answer only changes when a manufacturer or model does, and the key
    // already carries that.
    staleTime: 30_000,
  });

  const oidDegraded = data?.degraded?.includes('oid_mappings') ?? false;
  const booksDegraded = data?.degraded?.includes('address_books') ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Configuration readiness
        </CardTitle>
        <CardDescription>
          Whether meter scraping and scan-to-email are set up for this install. Read-only - fix
          either on the page it links to.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking...
          </p>
        ) : isError ? (
          <InlineQueryError label="the configuration readiness checks" onRetry={() => refetch()} />
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Meter scraping (SNMP OID mapping)</h4>
                <Link
                  href="/oid-management"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 underline underline-offset-2"
                >
                  Manage OID mappings
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {oidDegraded || !data?.oid ? (
                <InlineQueryError label="the OID mapping catalogue" onRetry={() => refetch()} />
              ) : devices.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Add equipment on the previous step and its meter support is checked here.
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {data.oid.devices.map((device, index) => (
                      <li
                        key={`${device.manufacturer ?? ''}-${device.model ?? ''}-${index}`}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="mt-0.5">
                          <BasisIcon basis={device.basis} />
                        </span>
                        <span className="flex-1">
                          <span className="font-medium">
                            {device.model || device.manufacturer || 'Unnamed device'}
                          </span>
                          <span className={`ml-2 ${BASIS_COPY[device.basis].tone}`}>
                            {BASIS_COPY[device.basis].label}
                          </span>
                          {device.mappingName ? (
                            <span className="block text-xs text-gray-600">
                              Polls with {device.mappingName}
                              {device.matchedSeries ? ` (matched "${device.matchedSeries}")` : ''}
                            </span>
                          ) : null}
                          {device.basis === 'none' ? (
                            <span className="block text-xs text-gray-600">
                              Nothing in the catalogue covers this manufacturer and model, so no
                              meters will be collected.
                            </span>
                          ) : null}
                          {device.basis === 'unknown' ? (
                            <span className="block text-xs text-gray-600">
                              Enter a manufacturer and model on the equipment step to check this.
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {data.oid.catalogueEmpty ? (
                    <p className="text-sm text-red-700">
                      The OID mapping catalogue is empty - no device on this deployment can be
                      meter-scraped until it is populated.
                    </p>
                  ) : null}
                  <p className="text-xs text-gray-500">
                    OID mappings are shared across every dealer on this deployment, so adding or
                    changing one changes what everyone polls with.
                  </p>
                </>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Scan-to-email (address book)</h4>
                <Link
                  href="/service/address-books"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 underline underline-offset-2"
                >
                  Manage address books
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              {!data?.addressBook.scan.required ? (
                <p className="text-sm text-gray-600">
                  Not applicable. {data?.addressBook.scan.reason}
                </p>
              ) : booksDegraded ? (
                <InlineQueryError label="this customer's address books" onRetry={() => refetch()} />
              ) : data.addressBook.bookCount === null ? (
                <p className="flex items-start gap-2 text-sm text-gray-600">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  Select a customer on the first step to check whether an address book exists.
                </p>
              ) : data.addressBook.bookCount === 0 ? (
                <p className="flex items-start gap-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  No address book is associated with this customer, so scan-to-email will not work
                  on {data.addressBook.scan.devices.join(', ')}.
                </p>
              ) : (
                <div className="space-y-1 text-sm">
                  <p className="flex items-start gap-2 text-green-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    {data.addressBook.bookCount} address book
                    {data.addressBook.bookCount === 1 ? '' : 's'} on this customer.
                  </p>
                  <ul className="ml-6 list-disc text-gray-600">
                    {data.addressBook.books.map((book) => (
                      <li key={book.id}>
                        {book.name}
                        {book.source_vendor ? (
                          <Badge variant="outline" className="ml-2">
                            {book.source_vendor}
                          </Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data?.addressBook.scan.required ? (
                <p className="text-xs text-gray-500">{data.addressBook.scan.reason}</p>
              ) : null}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ConfigReadinessPanel;
