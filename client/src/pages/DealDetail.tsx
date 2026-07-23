import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import MainLayout from '@/components/layout/main-layout';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  User,
  Mail,
  Phone,
  Calendar,
  Percent,
  Target,
  Tag,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';

interface DealData {
  id: string;
  title: string;
  description?: string | null;
  amount?: string | null;
  companyName?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  source?: string | null;
  dealType?: string | null;
  priority?: string | null;
  expectedCloseDate?: string | null;
  productsInterested?: string | null;
  estimatedMonthlyValue?: string | null;
  notes?: string | null;
  status?: string | null;
  probability?: number | null;
  stageId?: string | null;
  stageName?: string | null;
  stageColor?: string | null;
  ownerName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

function money(value?: string | null): string | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function statusVariant(
  status?: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'won':
      return 'default';
    case 'lost':
      return 'destructive';
    case 'on_hold':
      return 'secondary';
    default:
      return 'outline';
  }
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | number | null;
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

export default function DealDetail() {
  const [, params] = useRoute('/deals/:id');
  const [, navigate] = useLocation();
  const dealId = params?.id;

  const {
    data: deal,
    isLoading,
    isError,
  } = useQuery<DealData>({
    queryKey: [`/api/deals/${dealId}`],
    enabled: !!dealId,
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6 text-center py-12 text-muted-foreground">Loading deal…</div>
      </MainLayout>
    );
  }

  if (isError || !deal) {
    return (
      <MainLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/deals')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Deals
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              This deal could not be found. It may have been deleted or you may not have access to
              it.
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const closeDate = deal.expectedCloseDate ? format(new Date(deal.expectedCloseDate), 'PP') : null;

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/deals')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Deals
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-xl break-words">{deal.title}</CardTitle>
                {deal.companyName && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> {deal.companyName}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {deal.status && <Badge variant={statusVariant(deal.status)}>{deal.status}</Badge>}
                {deal.stageName && (
                  <Badge
                    variant="outline"
                    style={
                      deal.stageColor
                        ? { borderColor: deal.stageColor, color: deal.stageColor }
                        : undefined
                    }
                  >
                    {deal.stageName}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field icon={DollarSign} label="Amount" value={money(deal.amount)} />
            <Field
              icon={DollarSign}
              label="Estimated Monthly Value"
              value={money(deal.estimatedMonthlyValue)}
            />
            <Field
              icon={Percent}
              label="Probability"
              value={deal.probability != null ? `${deal.probability}%` : null}
            />
            <Field icon={Calendar} label="Expected Close" value={closeDate} />
            <Field icon={Tag} label="Priority" value={deal.priority} />
            <Field icon={Target} label="Deal Type" value={deal.dealType} />
            <Field icon={Tag} label="Source" value={deal.source} />
            <Field icon={User} label="Owner" value={deal.ownerName} />
          </CardContent>
        </Card>

        {(deal.primaryContactName || deal.primaryContactEmail || deal.primaryContactPhone) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Primary Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={User} label="Name" value={deal.primaryContactName} />
              <Field icon={Mail} label="Email" value={deal.primaryContactEmail} />
              <Field icon={Phone} label="Phone" value={deal.primaryContactPhone} />
            </CardContent>
          </Card>
        )}

        {(deal.productsInterested || deal.description || deal.notes) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field icon={FileText} label="Products Interested" value={deal.productsInterested} />
              {deal.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{deal.description}</p>
                </div>
              )}
              {deal.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {(deal.createdAt || deal.updatedAt) && (
          <p className="text-xs text-muted-foreground">
            {deal.createdAt && <>Created {format(new Date(deal.createdAt), 'PPp')}</>}
            {deal.createdAt && deal.updatedAt && ' · '}
            {deal.updatedAt && <>Updated {format(new Date(deal.updatedAt), 'PPp')}</>}
          </p>
        )}
      </div>
    </MainLayout>
  );
}
