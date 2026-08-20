import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MainLayout from '@/components/layout/main-layout';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  Cake,
  Clock,
  Mail,
  MapPin,
  Phone,
  Printer,
  Smartphone,
  Star,
  Tag,
  User,
  UserCog,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { getCrmObjectConfig } from '@/lib/crm-object-registry';
import {
  formatRecordAddress,
  pick,
  pickBool,
  pickJsonArray,
  type RawRecord as Raw,
} from '@/lib/crm/record-fields';

/**
 * Contact detail page for /crm/contacts/:id — the row-click target of
 * CrmContactsPage (crm-object-registry contactsConfig.detailPath).
 *
 * COP-M01: this route did not exist, so every row click on the contacts table
 * landed on NotFound. Neither backend had a single-contact GET either — Express
 * served a list-by-company on the same path and the edge function answered 405 —
 * so this page arrives with GET /api/company-contacts/:id on both.
 *
 * Every field below is a real company_contacts column (shared/schema.ts:1255).
 * Reads go through pick() because the edge function's write paths return raw
 * snake_case rows even though its read path maps to camelCase.
 */

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

function Field({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  href?: string;
}) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} className="text-sm font-medium text-blue-600 hover:underline break-words">
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium break-words whitespace-pre-wrap">{value}</p>
        )}
      </div>
    </div>
  );
}

/** Label a lead_status from the registry so the wording matches the table. */
function statusLabel(status: string | null): { label: string; className: string } | null {
  if (!status) return null;
  const config = getCrmObjectConfig('contacts').statusConfigs.find((s) => s.value === status);
  return {
    label: config?.label ?? status,
    className: config?.className ?? 'bg-gray-100 text-gray-800',
  };
}

export default function ContactDetail() {
  const [, params] = useRoute('/crm/contacts/:id');
  const [, navigate] = useLocation();
  const contactId = params?.id;

  const {
    data: contact,
    isLoading,
    isError,
  } = useQuery<Raw>({
    queryKey: [`/api/company-contacts/${contactId}`],
    enabled: !!contactId,
  });

  const companyId = pick(contact, 'companyId', 'company_id');
  const { data: company } = useQuery<Raw>({
    queryKey: [`/api/companies/${companyId}`],
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6 text-center py-12 text-muted-foreground">Loading contact...</div>
      </MainLayout>
    );
  }

  if (isError || !contact) {
    return (
      <MainLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate('/crm/contacts')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Contacts
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              This contact could not be found. It may have been deleted or you may not have access
              to it.
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const first = pick(contact, 'firstName', 'first_name');
  const last = pick(contact, 'lastName', 'last_name');
  const salutation = pick(contact, 'salutation');
  const name = [salutation, first, last].filter(Boolean).join(' ').trim() || 'Unnamed contact';
  const title = pick(contact, 'title');
  const department = pick(contact, 'department');
  const email = pick(contact, 'email');
  const phone = pick(contact, 'phone');
  const mobile = pick(contact, 'mobile');
  const otherPhone = pick(contact, 'otherPhone', 'other_phone');
  const homePhone = pick(contact, 'homePhone', 'home_phone');
  const fax = pick(contact, 'fax');
  const assistant = pick(contact, 'assistant');
  const assistantPhone = pick(contact, 'assistantPhone', 'assistant_phone');
  const reportsTo = pick(contact, 'reportsTo', 'reports_to');
  const ownerId = pick(contact, 'ownerId', 'owner_id');
  const favoriteContentType = pick(contact, 'favoriteContentType', 'favorite_content_type');
  const isPrimary = pickBool(contact, 'isPrimaryContact', 'is_primary_contact');
  const status = statusLabel(pick(contact, 'leadStatus', 'lead_status'));
  const roles = pickJsonArray(contact, 'contactRoles', 'contact_roles');
  const channels = pickJsonArray(contact, 'preferredChannels', 'preferred_channels');
  const mailing = formatRecordAddress(contact, 'mailing');
  const other = formatRecordAddress(contact, 'other');
  const birthdate = formatDate(pick(contact, 'birthdate'));
  const lastContact = formatDate(pick(contact, 'lastContactDate', 'last_contact_date'));
  const nextFollowUp = formatDate(pick(contact, 'nextFollowUpDate', 'next_follow_up_date'));
  const createdAt = formatDateTime(pick(contact, 'createdAt', 'created_at'));
  const updatedAt = formatDateTime(pick(contact, 'updatedAt', 'updated_at'));
  const companyName = pick(company, 'businessName', 'business_name', 'companyName');

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/contacts')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Contacts
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-xl break-words">{name}</CardTitle>
                {(title || department) && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {[title, department].filter(Boolean).join(' - ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {isPrimary && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    <Star className="h-3 w-3 mr-1" /> Primary
                  </Badge>
                )}
                {status && (
                  <Badge variant="secondary" className={status.className}>
                    {status.label}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              icon={Mail}
              label="Email"
              value={email}
              href={email ? `mailto:${email}` : undefined}
            />
            <Field
              icon={Phone}
              label="Phone"
              value={phone}
              href={phone ? `tel:${phone}` : undefined}
            />
            <Field
              icon={Smartphone}
              label="Mobile"
              value={mobile}
              href={mobile ? `tel:${mobile}` : undefined}
            />
            <Field icon={Phone} label="Other phone" value={otherPhone} />
            <Field icon={Phone} label="Home phone" value={homePhone} />
            <Field icon={Printer} label="Fax" value={fax} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relationships</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {companyId && (
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Company</p>
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-600 hover:underline break-words text-left"
                    onClick={() => navigate(`/companies/${companyId}`)}
                  >
                    {companyName ?? 'View company'}
                  </button>
                </div>
              </div>
            )}
            <Field icon={Users} label="Reports to" value={reportsTo} />
            <Field icon={User} label="Owner" value={ownerId} />
            <Field icon={UserCog} label="Assistant" value={assistant} />
            <Field icon={Phone} label="Assistant phone" value={assistantPhone} />
            <Field icon={Briefcase} label="Roles" value={roles.length ? roles.join(', ') : null} />
            <Field
              icon={Tag}
              label="Preferred channels"
              value={channels.length ? channels.join(', ') : null}
            />
            <Field icon={Tag} label="Favorite content" value={favoriteContentType} />
          </CardContent>
        </Card>

        {(mailing || other || birthdate) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field icon={MapPin} label="Mailing address" value={mailing} />
              <Field icon={MapPin} label="Other address" value={other} />
              <Field icon={Cake} label="Birthdate" value={birthdate} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field icon={Clock} label="Last contacted" value={lastContact} />
            <Field icon={CalendarDays} label="Next follow-up" value={nextFollowUp} />
            <Field icon={CalendarDays} label="Created" value={createdAt} />
            <Field icon={Clock} label="Updated" value={updatedAt} />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
