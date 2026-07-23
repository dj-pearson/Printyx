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
  MapPin,
  FileText,
  Activity as ActivityIcon,
} from 'lucide-react';
import { format } from 'date-fns';

interface RecordActivity {
  id: string;
  activityType: string;
  subject: string;
  description?: string | null;
  direction?: string | null;
  createdAt?: string | null;
}

interface BusinessRecord {
  id: string;
  companyName?: string | null;
  recordType?: string | null;
  status?: string | null;
  accountNumber?: string | null;
  industry?: string | null;
  website?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  accountNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  activities?: RecordActivity[];
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
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

function formatAddress(r: BusinessRecord): string | null {
  const cityLine = [r.city, r.state].filter(Boolean).join(', ');
  const parts = [r.addressLine1, r.addressLine2, [cityLine, r.postalCode].filter(Boolean).join(' ')]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join('\n') : null;
}

export default function BusinessRecordDetail() {
  const [, params] = useRoute('/business-records/:id');
  const [, navigate] = useLocation();
  const recordId = params?.id;

  const {
    data: record,
    isLoading,
    isError,
  } = useQuery<BusinessRecord>({
    queryKey: [`/api/business-records/${recordId}`],
    enabled: !!recordId,
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6 text-center py-12 text-muted-foreground">Loading record…</div>
      </MainLayout>
    );
  }

  if (isError || !record) {
    return (
      <MainLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => navigate('/business-records')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Records
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              This record could not be found. It may have been deleted or you may not have access to
              it.
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const address = formatAddress(record);
  const activities = record.activities ?? [];

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/business-records')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Records
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-xl break-words flex items-center gap-2">
                  <Building2 className="h-5 w-5 shrink-0" /> {record.companyName || 'Untitled'}
                </CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                {record.recordType && <Badge variant="secondary">{record.recordType}</Badge>}
                {record.status && <Badge variant="outline">{record.status}</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field icon={Hash} label="Account Number" value={record.accountNumber} />
            <Field icon={Briefcase} label="Industry" value={record.industry} />
            <Field icon={Globe} label="Website" value={record.website} />
            <Field icon={MapPin} label="Address" value={address} />
          </CardContent>
        </Card>

        {(record.primaryContactName ||
          record.primaryContactEmail ||
          record.primaryContactPhone) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Primary Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={User} label="Name" value={record.primaryContactName} />
              <Field icon={Mail} label="Email" value={record.primaryContactEmail} />
              <Field icon={Phone} label="Phone" value={record.primaryContactPhone} />
            </CardContent>
          </Card>
        )}

        {record.accountNotes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{record.accountNotes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ActivityIcon className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {a.activityType}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">{a.subject}</p>
                      {a.description && (
                        <p className="text-xs text-muted-foreground break-words">{a.description}</p>
                      )}
                      {a.createdAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(a.createdAt), 'PPp')}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {(record.createdAt || record.updatedAt) && (
          <p className="text-xs text-muted-foreground">
            {record.createdAt && <>Created {format(new Date(record.createdAt), 'PPp')}</>}
            {record.createdAt && record.updatedAt && ' · '}
            {record.updatedAt && <>Updated {format(new Date(record.updatedAt), 'PPp')}</>}
          </p>
        )}
      </div>
    </MainLayout>
  );
}
