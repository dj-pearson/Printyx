/**
 * Customer Self-Service Portal — Uber-style service requests (US-SUPER-011).
 *
 * The customer describes "what's wrong" in plain English; we classify it (POST
 * /api/portal-service/classify), spin up an internal ticket, and show an
 * Uber-style status timeline plus a post-resolution star rating. Reuses the
 * existing customer-portal endpoints (equipment-health, service-requests) and
 * tolerates missing customer context gracefully (empty states, never crashes).
 *
 * STUBs/TODOs:
 *   - Photo upload is a STUB: we keep the filename only (no storage upload yet).
 *   - Per-location RBAC is a documented stub — we render whatever location field
 *     the data provides; full per-location scoping is deferred.
 *   - GPS/map live tech tracking (gps-tracking-schema) is deferred; the timeline
 *     is a status-derived stepper, not a live map.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  MapPin,
  Paperclip,
  Printer,
  Send,
  Sparkles,
  Star,
  Wrench,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Locally-typed API shapes
// ---------------------------------------------------------------------------

interface EquipmentHealthItem {
  id?: string;
  equipmentId?: string;
  serialNumber?: string | null;
  model?: string | null;
  modelNumber?: string | null;
  manufacturer?: string | null;
  status?: string | null;
  healthStatus?: string | null;
  lastServiceDate?: string | null;
  location?: string | null;
  equipmentLocation?: string | null;
  meterReading?: number | null;
  currentMeter?: number | null;
}

interface ServiceRequest {
  id: string;
  requestNumber?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  equipmentModel?: string | null;
  equipmentLocation?: string | null;
  customerRating?: number | null;
  submittedAt?: string | null;
  createdAt?: string | null;
}

interface RecommendedPart {
  partNumber: string;
  name: string;
  reason: string;
}

interface Playbook {
  key: string;
  title: string;
  steps: string[];
}

interface Classification {
  category: string;
  suggestedPriority: string;
  recommendedParts: RecommendedPart[];
  playbook: Playbook;
  confidence: number;
  source: 'ai' | 'fallback';
}

interface TimelineStep {
  key: string;
  label: string;
  status: 'done' | 'current' | 'pending';
  at: string | null;
}

interface TimelineResponse {
  steps: TimelineStep[];
  history: Array<{
    id: string;
    newStatus: string;
    customerVisibleNotes?: string | null;
    createdAt?: string | null;
  }>;
  currentStatus: string | null;
  cancelled: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstWords(text: string, max = 8): string {
  const words = text.trim().split(/\s+/).slice(0, max).join(' ');
  return words || 'Service request';
}

function priorityVariant(p?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch ((p ?? '').toLowerCase()) {
    case 'urgent':
    case 'emergency':
    case 'high':
      return 'destructive';
    case 'normal':
    case 'medium':
      return 'default';
    default:
      return 'secondary';
  }
}

function eqLabel(e: EquipmentHealthItem): string {
  return e.serialNumber || e.model || e.modelNumber || e.equipmentId || e.id || 'Device';
}

function eqId(e: EquipmentHealthItem): string {
  return e.equipmentId || e.id || '';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CustomerPortalService() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [problemText, setProblemText] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [photoName, setPhotoName] = useState<string>('');
  const [result, setResult] = useState<Classification | null>(null);
  const [detailRequest, setDetailRequest] = useState<ServiceRequest | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');

  // Fleet (tolerate failure).
  const {
    data: fleetResp,
    isLoading: fleetLoading,
    isError: fleetError,
  } = useQuery<any>({
    queryKey: ['/api/customer-portal/equipment-health'],
    retry: false,
  });
  const fleet: EquipmentHealthItem[] = Array.isArray(fleetResp)
    ? fleetResp
    : Array.isArray(fleetResp?.data)
      ? fleetResp.data
      : [];

  // My requests (tolerate failure).
  const {
    data: requestsResp,
    isLoading: requestsLoading,
    isError: requestsError,
  } = useQuery<any>({
    queryKey: ['/api/customer-portal/service-requests'],
    retry: false,
  });
  const requests: ServiceRequest[] = Array.isArray(requestsResp)
    ? requestsResp
    : Array.isArray(requestsResp?.data)
      ? requestsResp.data
      : [];

  // Timeline for the open request.
  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineResponse>({
    queryKey: [`/api/portal-service/timeline/${detailRequest?.id}`],
    enabled: !!detailRequest?.id,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      // 1) Create the portal request via the existing endpoint.
      const created: any = await apiRequest('/api/customer-portal/service-requests', {
        method: 'POST',
        body: {
          title: firstWords(problemText),
          description: problemText,
          type: 'repair',
          ...(selectedEquipment ? { equipmentId: selectedEquipment } : {}),
        },
      });
      const requestId: string | undefined = created?.data?.id ?? created?.id;
      // 2) Classify (+ best-effort dispatch).
      const classifyResp: any = await apiRequest('/api/portal-service/classify', {
        method: 'POST',
        body: {
          ...(requestId ? { requestId } : {}),
          text: problemText,
          ...(selectedEquipment ? { equipmentId: selectedEquipment } : {}),
        },
      });
      return classifyResp?.classification as Classification;
    },
    onSuccess: (classification) => {
      setResult(classification ?? null);
      setProblemText('');
      setSelectedEquipment('');
      setPhotoName('');
      queryClient.invalidateQueries({ queryKey: ['/api/customer-portal/service-requests'] });
      toast({
        title: 'Request submitted',
        description: 'We classified your issue and dispatched.',
      });
    },
    onError: (err: any) => {
      // Classification may still be useful even if request creation failed; try classify-only.
      apiRequest('/api/portal-service/classify', {
        method: 'POST',
        body: {
          text: problemText,
          ...(selectedEquipment ? { equipmentId: selectedEquipment } : {}),
        },
      })
        .then((resp: any) => {
          setResult(resp?.classification ?? null);
          toast({
            title: 'Classified (not saved)',
            description: 'We could not save the request, but here is our analysis.',
          });
        })
        .catch(() =>
          toast({
            title: 'Submission failed',
            description: err?.message || 'Failed to submit request',
            variant: 'destructive',
          }),
        );
    },
  });

  const rateMutation = useMutation({
    mutationFn: (body: { requestId: string; rating: number; feedback?: string }) =>
      apiRequest('/api/portal-service/rate', { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Thanks for the feedback!' });
      setRatingValue(0);
      setRatingFeedback('');
      setDetailRequest(null);
      queryClient.invalidateQueries({ queryKey: ['/api/customer-portal/service-requests'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Rating failed',
        description: err?.message || 'Failed to submit rating',
        variant: 'destructive',
      }),
  });

  const isResolved = (s?: string) => s === 'completed';

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="h-6 w-6 text-blue-500" />
          Service Portal
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us what's wrong in plain English — we'll dispatch the right tech with the right
          parts.
        </p>
      </div>

      {/* Fleet view */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Your fleet
          </CardTitle>
          <CardDescription>Status, last service, and meter for your machines.</CardDescription>
        </CardHeader>
        <CardContent>
          {fleetLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading fleet…</p>
          ) : fleetError || fleet.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No fleet data.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fleet.map((e, i) => (
                <div key={eqId(e) || i} className="rounded-md border p-3 space-y-1">
                  <div className="font-medium flex items-center justify-between">
                    <span className="truncate">{eqLabel(e)}</span>
                    {(e.status || e.healthStatus) && (
                      <Badge variant="outline" className="ml-2 capitalize">
                        {e.healthStatus || e.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.model || e.modelNumber || '—'}
                    {(e.location || e.equipmentLocation) && (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <MapPin className="h-3 w-3" />
                        {e.location || e.equipmentLocation}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last service:{' '}
                    {e.lastServiceDate ? new Date(e.lastServiceDate).toLocaleDateString() : '—'}
                  </div>
                  {(e.meterReading != null || e.currentMeter != null) && (
                    <div className="text-xs text-muted-foreground">
                      Meter: {(e.meterReading ?? e.currentMeter ?? 0).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request service form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Request service
          </CardTitle>
          <CardDescription>Describe the problem — no jargon needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="e.g. The big printer in accounting is making a grinding noise and won't print"
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            className="min-h-[96px]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-sm font-medium">Machine (optional)</span>
              <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Select a machine" />
                </SelectTrigger>
                <SelectContent>
                  {fleet
                    .filter((e) => eqId(e))
                    .map((e, i) => (
                      <SelectItem key={eqId(e) || i} value={eqId(e)}>
                        {eqLabel(e)}
                      </SelectItem>
                    ))}
                  {fleet.filter((e) => eqId(e)).length === 0 && (
                    <SelectItem value="__none" disabled>
                      No machines available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">Photo (optional)</span>
              <label className="flex items-center gap-2 border rounded-md px-3 min-h-[48px] cursor-pointer text-sm text-muted-foreground">
                <Paperclip className="h-4 w-4" />
                <span className="truncate">{photoName || 'Attach a photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? '')}
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Upload is a stub — only the filename is kept for now.
              </p>
            </div>
          </div>
          <Button
            className="min-h-[48px]"
            disabled={!problemText.trim() || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit & classify
          </Button>

          {/* Classification result */}
          {result && (
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {result.category.replace(/_/g, ' ')}
                </Badge>
                <Badge variant={priorityVariant(result.suggestedPriority)} className="capitalize">
                  {result.suggestedPriority} priority
                </Badge>
                <Badge variant="outline">
                  {result.source === 'ai' ? 'AI' : 'rule-based'} ·{' '}
                  {Math.round((result.confidence ?? 0) * 100)}% confidence
                </Badge>
              </div>
              {result.recommendedParts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Recommended parts</h4>
                  <ul className="text-sm space-y-1">
                    {result.recommendedParts.map((p, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Wrench className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                        <span>
                          <span className="font-medium">{p.name}</span>
                          {p.partNumber ? ` (${p.partNumber})` : ''} — {p.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.playbook?.steps?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">{result.playbook.title}</h4>
                  <ol className="text-sm list-decimal list-inside space-y-1">
                    {result.playbook.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My requests</CardTitle>
          <CardDescription>Track status and rate completed work.</CardDescription>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading requests…</p>
          ) : requestsError ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No requests available.</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No service requests yet. Submit one above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.title || r.requestNumber || r.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {(r.status || 'submitted').replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant(r.priority)} className="capitalize">
                          {r.priority || 'normal'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.submittedAt || r.createdAt
                          ? new Date((r.submittedAt || r.createdAt) as string).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[40px]"
                          onClick={() => {
                            setDetailRequest(r);
                            setRatingValue(r.customerRating ?? 0);
                          }}
                        >
                          Track
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog: Uber-style timeline + rating */}
      <Dialog open={!!detailRequest} onOpenChange={(open) => !open && setDetailRequest(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailRequest?.title || detailRequest?.requestNumber || 'Service request'}
            </DialogTitle>
            <DialogDescription>Live status of your service request.</DialogDescription>
          </DialogHeader>

          {timelineLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading timeline…</p>
          ) : timeline ? (
            <div className="space-y-4">
              {timeline.cancelled && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  This request was cancelled.
                </div>
              )}
              {/* Vertical stepper */}
              <ol className="space-y-3">
                {timeline.steps.map((step) => (
                  <li key={step.key} className="flex items-start gap-3">
                    {step.status === 'done' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
                    ) : step.status === 'current' ? (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 mt-0.5" />
                    )}
                    <div>
                      <div
                        className={
                          step.status === 'pending'
                            ? 'text-sm text-muted-foreground'
                            : 'text-sm font-medium'
                        }
                      >
                        {step.label}
                      </div>
                      {step.at && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(step.at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {/* Rating widget when resolved */}
              {isResolved(timeline.currentStatus ?? detailRequest?.status) && (
                <div className="border-t pt-4 space-y-2">
                  <h4 className="text-sm font-semibold">How did we do?</h4>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} star${n > 1 ? 's' : ''}`}
                        onClick={() => setRatingValue(n)}
                        className="p-1"
                      >
                        <Star
                          className={
                            n <= ratingValue
                              ? 'h-6 w-6 fill-amber-400 text-amber-400'
                              : 'h-6 w-6 text-muted-foreground/40'
                          }
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Optional feedback…"
                    value={ratingFeedback}
                    onChange={(e) => setRatingFeedback(e.target.value)}
                    className="min-h-[72px]"
                  />
                  <Button
                    className="min-h-[48px]"
                    disabled={ratingValue < 1 || rateMutation.isPending || !detailRequest}
                    onClick={() =>
                      detailRequest &&
                      rateMutation.mutate({
                        requestId: detailRequest.id,
                        rating: ratingValue,
                        feedback: ratingFeedback || undefined,
                      })
                    }
                  >
                    {rateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Star className="h-4 w-4 mr-2" />
                    )}
                    Submit rating
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Timeline unavailable.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
