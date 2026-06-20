/**
 * Customer QBR Decks (US-SUPER-004).
 *
 * Per-customer console for auto-generated Quarterly Business Review decks.
 * Lists generated decks (quarter, status, generated/sent dates, PDF link),
 * lets the rep generate the current quarter on demand, and opens a review
 * dialog to edit per-section overrides, mark the deck reviewed, and send it.
 * Nothing auto-sends — the rep keeps the approval gate.
 */

import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Play, RefreshCw, Save, Send } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface QbrReport {
  id: string;
  customerId: string;
  companyName: string | null;
  quarter: string;
  status: string;
  content: any;
  pdfUrl: string | null;
  htmlUrl: string | null;
  generatedAt: string | null;
  sentAt: string | null;
}

interface ListResponse {
  data: QbrReport[];
  total: number;
}

/** Sections the rep can override with free text. */
const EDITABLE_SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'fleet', label: 'Fleet' },
  { key: 'usageTrend', label: 'Usage Trend' },
  { key: 'downtimeByMachine', label: 'Downtime by Machine' },
  { key: 'topIssues', label: 'Top Issues' },
  { key: 'supplyCost', label: 'Supply Cost' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'forecast', label: 'Forecast' },
];

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'sent') return 'default';
  if (status === 'reviewed') return 'secondary';
  return 'outline';
}

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString() : '—';
}

export default function CustomerQbrs() {
  const params = useParams();
  const customerId = (params as Record<string, string>).id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [detail, setDetail] = useState<QbrReport | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const listKey = `/api/qbr?customerId=${customerId}`;
  const {
    data: list,
    isLoading,
    isError,
    error,
  } = useQuery<ListResponse>({
    queryKey: [listKey],
    enabled: !!customerId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [listKey] });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest('/api/qbr/generate', { method: 'POST', body: { customerId } }),
    onSuccess: (data: any) => {
      toast({
        title: 'QBR generation complete',
        description: `${data?.generated ?? 0} deck(s) generated for ${data?.quarter ?? 'this quarter'}.`,
      });
      invalidate();
    },
    onError: (err: any) =>
      toast({
        title: 'Generation failed',
        description: err?.message || 'Failed to generate',
        variant: 'destructive',
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { status?: string; sectionOverrides?: Record<string, string> };
    }) => apiRequest(`/api/qbr/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast({ title: 'Review saved' });
      invalidate();
      setDetail(null);
    },
    onError: (err: any) =>
      toast({
        title: 'Save failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/qbr/${id}/send`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'QBR sent' });
      invalidate();
      setDetail(null);
    },
    onError: (err: any) =>
      toast({
        title: 'Send failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const openReview = (r: QbrReport) => {
    setDetail(r);
    setOverrides({ ...((r.content?.sectionOverrides as Record<string, string>) ?? {}) });
  };

  const rows = list?.data ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal-600" />
            QBR Decks
          </h1>
          <p className="text-sm text-muted-foreground">
            Auto-generated quarterly business review decks. Review and send — never auto-sent.
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || !customerId}
          className="min-h-[48px]"
        >
          {generateMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Generate this quarter
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generated decks</CardTitle>
          <CardDescription>One deck per quarter for this customer.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : isError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load: {(error as any)?.message || 'Unknown error'}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No QBR decks yet. Click "Generate this quarter" to build one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.quarter}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)} className="capitalize">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{fmtDate(r.generatedAt)}</TableCell>
                      <TableCell>{fmtDate(r.sentAt)}</TableCell>
                      <TableCell>
                        {r.pdfUrl ? (
                          <a
                            href={r.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 underline inline-flex items-center min-h-[48px]"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Download PDF
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not available</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[48px]"
                          onClick={() => openReview(r)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Review &amp; send
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

      {/* Review & send dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              QBR {detail?.quarter} — {detail?.companyName || detail?.customerId}
            </DialogTitle>
            <DialogDescription>
              Edit any section's narrative. Overrides replace the generated content in the deck.
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              {EDITABLE_SECTIONS.map((s) => (
                <div key={s.key} className="space-y-1">
                  <Label htmlFor={`override-${s.key}`} className="text-sm font-semibold">
                    {s.label}
                  </Label>
                  <Textarea
                    id={`override-${s.key}`}
                    rows={3}
                    placeholder={`Override the ${s.label} section (leave blank to keep generated content)…`}
                    value={overrides[s.key] ?? ''}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {detail && (
              <>
                <Button
                  variant="outline"
                  className="min-h-[48px]"
                  disabled={reviewMutation.isPending}
                  onClick={() => {
                    const cleaned = Object.fromEntries(
                      Object.entries(overrides).filter(([, v]) => v.trim() !== ''),
                    );
                    reviewMutation.mutate({
                      id: detail.id,
                      body: { status: 'reviewed', sectionOverrides: cleaned },
                    });
                  }}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save review
                </Button>
                <Button
                  className="min-h-[48px]"
                  disabled={sendMutation.isPending}
                  onClick={() => sendMutation.mutate(detail.id)}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
