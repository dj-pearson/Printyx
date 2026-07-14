/**
 * CRMX-016: Booking pages admin — list, create, edit, and share Calendly-style
 * public scheduling pages. Talks to the authenticated /api/booking-pages fn;
 * the public prospect surface is served by PublicBooking.tsx (/book/:slug).
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, Copy, ExternalLink, Pencil, Power } from 'lucide-react';

interface AvailabilityRule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface BookingPage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  date_range_days: number;
  slot_interval_minutes: number;
  availability_rules: AvailabilityRule[];
  booking_type: string;
  is_active: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COMMON_TZ = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'UTC',
];

interface FormState {
  title: string;
  slug: string;
  description: string;
  timezone: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeHours: number;
  dateRangeDays: number;
  slotIntervalMinutes: number;
  bookingType: string;
  isActive: boolean;
  days: Record<number, { enabled: boolean; start: string; end: string }>;
}

function defaultForm(): FormState {
  const days: FormState['days'] = {};
  for (let i = 0; i < 7; i++) {
    days[i] = { enabled: i >= 1 && i <= 5, start: '09:00', end: '17:00' };
  }
  return {
    title: '',
    slug: '',
    description: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minNoticeHours: 4,
    dateRangeDays: 30,
    slotIntervalMinutes: 30,
    bookingType: 'individual',
    isActive: true,
    days,
  };
}

function formFromPage(p: BookingPage): FormState {
  const base = defaultForm();
  for (let i = 0; i < 7; i++) base.days[i] = { enabled: false, start: '09:00', end: '17:00' };
  for (const r of p.availability_rules ?? []) {
    base.days[r.dayOfWeek] = { enabled: true, start: r.startTime, end: r.endTime };
  }
  return {
    ...base,
    title: p.title,
    slug: p.slug,
    description: p.description ?? '',
    timezone: p.timezone,
    durationMinutes: p.duration_minutes,
    bufferBeforeMinutes: p.buffer_before_minutes,
    bufferAfterMinutes: p.buffer_after_minutes,
    minNoticeHours: Math.round((p.min_notice_minutes ?? 0) / 60),
    dateRangeDays: p.date_range_days,
    slotIntervalMinutes: p.slot_interval_minutes,
    bookingType: p.booking_type,
    isActive: p.is_active,
  };
}

function toPayload(f: FormState) {
  const availabilityRules: AvailabilityRule[] = [];
  for (let i = 0; i < 7; i++) {
    const d = f.days[i];
    if (d.enabled) availabilityRules.push({ dayOfWeek: i, startTime: d.start, endTime: d.end });
  }
  return {
    title: f.title.trim(),
    slug: f.slug.trim() || undefined,
    description: f.description.trim() || null,
    timezone: f.timezone,
    durationMinutes: Number(f.durationMinutes),
    bufferBeforeMinutes: Number(f.bufferBeforeMinutes),
    bufferAfterMinutes: Number(f.bufferAfterMinutes),
    minNoticeMinutes: Number(f.minNoticeHours) * 60,
    dateRangeDays: Number(f.dateRangeDays),
    slotIntervalMinutes: Number(f.slotIntervalMinutes),
    bookingType: f.bookingType,
    isActive: f.isActive,
    availabilityRules,
  };
}

export default function BookingPages() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BookingPage | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm());

  const { data: pages = [], isLoading } = useQuery<BookingPage[]>({
    queryKey: ['/api/booking-pages'],
    queryFn: () => apiRequest('/api/booking-pages'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form);
      if (editing) return apiRequest(`/api/booking-pages/${editing.id}`, 'PUT', payload);
      return apiRequest('/api/booking-pages', 'POST', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/booking-pages'] });
      setShowDialog(false);
      setEditing(null);
      toast({ title: editing ? 'Booking page updated' : 'Booking page created' });
    },
    onError: (e: unknown) => {
      toast({
        title: 'Could not save',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (p: BookingPage) => {
      if (p.is_active) return apiRequest(`/api/booking-pages/${p.id}`, 'DELETE');
      return apiRequest(`/api/booking-pages/${p.id}`, 'PUT', { isActive: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/booking-pages'] }),
  });

  const origin = useMemo(() => window.location.origin, []);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm());
    setShowDialog(true);
  }
  function openEdit(p: BookingPage) {
    setEditing(p);
    setForm(formFromPage(p));
    setShowDialog(true);
  }
  function publicUrl(slug: string) {
    return `${origin}/book/${slug}`;
  }
  function copyLink(slug: string) {
    navigator.clipboard.writeText(publicUrl(slug));
    toast({ title: 'Link copied' });
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Booking Pages</h1>
            <p className="text-muted-foreground text-sm">
              Share a link and let prospects self-schedule against your real calendar.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New booking page
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No booking pages yet. Create one to start taking meetings.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pages.map((p) => (
              <Card key={p.id}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{p.title}</h3>
                      <Badge variant={p.is_active ? 'default' : 'secondary'}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">{p.duration_minutes} min</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{publicUrl(p.slug)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Copy link"
                      onClick={() => copyLink(p.slug)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Open"
                      onClick={() => window.open(publicUrl(p.slug), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={p.is_active ? 'Deactivate' : 'Reactivate'}
                      onClick={() => toggleMutation.mutate(p)}
                    >
                      <Power
                        className={`h-4 w-4 ${p.is_active ? 'text-green-600' : 'text-gray-400'}`}
                      />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit booking page' : 'New booking page'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Intro call"
              />
            </div>
            <div>
              <Label>Custom link (optional)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="auto-generated from title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Timezone</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 text-sm"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  {[form.timezone, ...COMMON_TZ.filter((t) => t !== form.timezone)].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Min notice (hours)</Label>
                <Input
                  type="number"
                  value={form.minNoticeHours}
                  onChange={(e) => setForm({ ...form, minNoticeHours: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Bookable window (days out)</Label>
                <Input
                  type="number"
                  value={form.dateRangeDays}
                  onChange={(e) => setForm({ ...form, dateRangeDays: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Buffer before (min)</Label>
                <Input
                  type="number"
                  value={form.bufferBeforeMinutes}
                  onChange={(e) =>
                    setForm({ ...form, bufferBeforeMinutes: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Buffer after (min)</Label>
                <Input
                  type="number"
                  value={form.bufferAfterMinutes}
                  onChange={(e) => setForm({ ...form, bufferAfterMinutes: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Weekly availability</Label>
              <div className="space-y-2">
                {DAYS.map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-28 flex items-center gap-2">
                      <Switch
                        checked={form.days[i].enabled}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            days: { ...form.days, [i]: { ...form.days[i], enabled: v } },
                          })
                        }
                      />
                      <span className="text-sm">{label}</span>
                    </div>
                    <Input
                      type="time"
                      className="w-32"
                      disabled={!form.days[i].enabled}
                      value={form.days[i].start}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          days: { ...form.days, [i]: { ...form.days[i], start: e.target.value } },
                        })
                      }
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      className="w-32"
                      disabled={!form.days[i].enabled}
                      value={form.days[i].end}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          days: { ...form.days, [i]: { ...form.days[i], end: e.target.value } },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {editing ? (
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <span className="text-sm">Active</span>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
