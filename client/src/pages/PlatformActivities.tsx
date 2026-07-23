import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MainLayout from '@/components/layout/main-layout';
import { ArrowLeft, Phone, Mail, Calendar, Briefcase, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface PlatformActivity {
  id: string;
  activity_type?: string | null;
  subject?: string | null;
  description?: string | null;
  business_record_id?: string | null;
  created_by?: string | null;
  activity_date?: string | null;
  created_at?: string | null;
}

interface ActivitiesResponse {
  activities: PlatformActivity[];
  pagination?: { totalRecords?: number };
}

function activityIcon(type?: string | null) {
  switch (type) {
    case 'call':
      return <Phone className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    case 'meeting':
      return <Calendar className="h-4 w-4" />;
    case 'demo':
      return <Briefcase className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

export default function PlatformActivities() {
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<ActivitiesResponse>({
    queryKey: ['/api/platform-activities?limit=100&sortBy=activityDate&sortOrder=desc'],
  });

  const activities = data?.activities ?? [];

  return (
    <MainLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/platform-crm')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Platform CRM
        </Button>

        <div>
          <h1 className="text-2xl font-bold">All Activities</h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide CRM activity across all tenants
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Activity Log
              {data?.pagination?.totalRecords != null && (
                <span className="text-muted-foreground font-normal">
                  {' '}
                  ({data.pagination.totalRecords})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading activities…</p>
            ) : isError ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Could not load activities.
              </p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No activities recorded yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => {
                  const when = a.activity_date || a.created_at;
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground shrink-0">
                        {activityIcon(a.activity_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {a.activity_type && (
                            <Badge variant="outline" className="capitalize">
                              {a.activity_type}
                            </Badge>
                          )}
                          <span className="text-sm font-medium break-words">
                            {a.subject || a.activity_type || 'Activity'}
                          </span>
                        </div>
                        {a.description && (
                          <p className="text-xs text-muted-foreground break-words mt-1">
                            {a.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {when ? format(new Date(when), 'PPp') : 'Unknown date'}
                          {a.created_by ? ` · by ${a.created_by}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
