import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MainLayout from '@/components/layout/main-layout';
import {
  ArrowLeft,
  Building2,
  Globe,
  Hash,
  Briefcase,
  User,
  Mail,
  Phone,
  Printer,
  MapPin,
  FileText,
  Users,
  CalendarDays,
  DollarSign,
  Network,
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Company detail page for /companies/:id — the row-click target of CrmCompaniesPage
 * (crm-object-registry companiesConfig.detailPath), which previously 404'd.
 *
 * The two backends disagree on key casing: Express `GET /api/companies/:id`
 * (storage.getCompany, Drizzle) returns camelCase, while the `companies` edge
 * function returns raw PostgREST snake_case rows plus nested joins. Every read
 * goes through `pick()` so the page renders against either one.
 */

type Raw = Record<string, unknown>;

function pick(row: Raw | undefined, ...keys: string[]): string | null {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return null;
}

function pickBool(row: Raw | undefined, ...keys: string[]): boolean {
  if (!row) return false;
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'boolean') return v;
  }
  return false;
}

function pickList(row: Raw | undefined, ...keys: string[]): Raw[] {
  if (!row) return [];
  for (const k of keys) {
    const v = row[k];
    if (Array.isArray(v)) return v as Raw[];
  }
  return [];
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, 'PP');
}

function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, 'PPp');
}

function formatMoney(value: string | null): string | null {
  if (!value) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words whitespace-pre-wrap">{value}</p>
      </div>
    </div>
  );
}

function formatAddress(
  company: Raw | undefined,
  prefix: 'billing' | 'shipping' | 'mailing',
): string | null {
  const street = pick(company, `${prefix}Address`, `${prefix}_address`);
  const city = pick(company, `${prefix}City`, `${prefix}_city`);
  const state = pick(company, `${prefix}State`, `${prefix}_state`);
  const zip = pick(company, `${prefix}Zip`, `${prefix}_zip`);
  const cityLine = [[city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' ').trim();
  const parts = [street, cityLine].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join('\n') : null;
}

function contactName(contact: Raw): string {
  const name = [pick(contact, 'firstName', 'first_name'), pick(contact, 'lastName', 'last_name')]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || 'Unnamed contact';
}

export default function CompanyDetail() {
  const [, params] = useRoute('/companies/:id');
  const [, navigate] = useLocation();
  const companyId = params?.id;

  const {
    data: company,
    isLoading,
    isError,
  } = useQuery<Raw>({
    queryKey: [`/api/companies/${companyId}`],
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6 text-center py-12 text-muted-foreground">Loading company…</div>
      </MainLayout>
    );
  }

  if (isError || !company) {
    return (
      <MainLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate('/crm/companies')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Companies
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              This company could not be found. It may have been deleted or you may not have access
              to it.
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const name = pick(company, 'businessName', 'business_name') || 'Untitled company';
  const recordType = pick(company, 'businessRecordType', 'business_record_type');
  const site = pick(company, 'businessSite', 'business_site');
  const billing = formatAddress(company, 'billing');
  const shipping = formatAddress(company, 'shipping');
  const contacts = pickList(company, 'companyContacts', 'company_contacts');
  const createdAt = formatDateTime(pick(company, 'createdAt', 'created_at'));
  const updatedAt = formatDateTime(pick(company, 'updatedAt', 'updated_at'));
  const description = pick(company, 'description');
  const deliveryNotes = pick(
    company,
    'specialDeliveryInstructions',
    'special_delivery_instructions',
  );
  const interests = pick(company, 'productServicesInterest', 'product_services_interest');

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/companies')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Companies
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-xl break-words flex items-center gap-2">
                  <Building2 className="h-5 w-5 shrink-0" /> {name}
                </CardTitle>
                {site && <p className="text-sm text-muted-foreground mt-1">{site}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {recordType && <Badge variant="secondary">{recordType}</Badge>}
                {pick(company, 'activity') && (
                  <Badge variant="outline">{pick(company, 'activity')}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              icon={Hash}
              label="Customer Number"
              value={pick(company, 'customerNumber', 'customer_number')}
            />
            <Field icon={Briefcase} label="Industry" value={pick(company, 'industry')} />
            <Field icon={Phone} label="Phone" value={pick(company, 'phone')} />
            <Field icon={Printer} label="Fax" value={pick(company, 'fax')} />
            <Field icon={Globe} label="Website" value={pick(company, 'website')} />
            <Field
              icon={Network}
              label="Parent Business"
              value={pick(company, 'parentBusiness', 'parent_business')}
            />
            <Field icon={MapPin} label="Billing Address" value={billing} />
            {shipping && shipping !== billing && (
              <Field icon={MapPin} label="Shipping Address" value={shipping} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              icon={CalendarDays}
              label="Customer Since"
              value={formatDate(pick(company, 'customerSince', 'customer_since'))}
            />
            <Field icon={Users} label="Employees" value={pick(company, 'employees')} />
            <Field
              icon={DollarSign}
              label="Annual Revenue"
              value={formatMoney(pick(company, 'annualRevenue', 'annual_revenue'))}
            />
            <Field
              icon={MapPin}
              label="Locations"
              value={pick(company, 'numberOfLocations', 'number_of_locations')}
            />
            <Field icon={Hash} label="SIC Code" value={pick(company, 'sicCode', 'sic_code')} />
            <Field
              icon={User}
              label="Business Owner"
              value={pick(company, 'businessOwner', 'business_owner')}
            />
            <Field icon={Briefcase} label="Interests" value={interests} />
            <Field icon={FileText} label="Delivery Instructions" value={deliveryNotes} />
          </CardContent>
        </Card>

        {description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{description}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contacts recorded for this company.
              </p>
            ) : (
              <ul className="space-y-3">
                {contacts.map((c, i) => (
                  <li
                    key={pick(c, 'id') ?? String(i)}
                    className="flex flex-wrap items-start gap-x-4 gap-y-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">
                        {contactName(c)}
                        {pickBool(c, 'isPrimaryContact', 'is_primary_contact') && (
                          <Badge variant="secondary" className="ml-2">
                            Primary
                          </Badge>
                        )}
                      </p>
                      {pick(c, 'title') && (
                        <p className="text-xs text-muted-foreground break-words">
                          {pick(c, 'title')}
                          {pick(c, 'department') ? ` · ${pick(c, 'department')}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {pick(c, 'email') && (
                        <p className="flex items-center gap-1 break-all">
                          <Mail className="h-3 w-3 shrink-0" />
                          {pick(c, 'email')}
                        </p>
                      )}
                      {pick(c, 'phone') && (
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          {pick(c, 'phone')}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {(createdAt || updatedAt) && (
          <p className="text-xs text-muted-foreground">
            {createdAt && <>Created {createdAt}</>}
            {createdAt && updatedAt && ' · '}
            {updatedAt && <>Updated {updatedAt}</>}
          </p>
        )}
      </div>
    </MainLayout>
  );
}
