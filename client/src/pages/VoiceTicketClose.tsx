/**
 * Voice-First Field Tech Ticket Close (US-SUPER-005).
 *
 * A field tech on a phone records a spoken close note (actions, parts, labor).
 * The audio is transcribed (Whisper), Claude extracts structured fields, each
 * spoken part is fuzzy-matched to an inventory SKU, and a draft is returned. The
 * tech reviews/edits the draft (pick SKUs for unmatched parts, adjust labor,
 * toggle follow-up / signature, add a satisfaction note) and confirms — which
 * closes the ticket, deducts parts from truck inventory, and drafts invoice line
 * items (pending approval).
 *
 * Mobile-first: a large record button (MediaRecorder), a "type instead"
 * fallback, and an OFFLINE queue (IndexedDB) that drains on reconnect — the
 * server dedupes on clientDedupeKey so retries are safe. All touch targets are
 * min-h-[48px].
 *
 * STUBs / TODOs documented at the call sites:
 *   - MediaRecorder may be unavailable (no mic / unsupported) → falls back to the
 *     "type instead" textarea.
 *   - IndexedDB may be unavailable (private mode) → queue is best-effort, wrapped
 *     in try/catch; we still attempt a direct POST.
 *   - Invoice line items are drafted-only (pending_approval) until the canonical
 *     invoice flow is wired server-side.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mic, Square, CheckCircle2, CloudOff, Keyboard, Loader2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types (mirror the server draft shape)
// ---------------------------------------------------------------------------

interface ExtractedPart {
  raw: string;
  quantity: number;
}

interface Extracted {
  actions_taken: string;
  parts_used: ExtractedPart[];
  labor_minutes: number;
  follow_up_needed: boolean;
  customer_signature_collected: boolean;
  customer_satisfaction_note: string;
}

interface SkuCandidate {
  sku: string;
  name: string;
  score: number;
}

interface SkuResolution {
  raw: string;
  quantity: number;
  candidates: SkuCandidate[];
  chosenSku: string | null;
}

interface DraftInvoiceItem {
  description: string;
  quantity: number;
  unitCost: number;
  amount: number;
  status: string;
}

interface Draft {
  id: string;
  ticketId: string;
  transcript: string | null;
  transcriptSource: string;
  extracted: Extracted | null;
  extractionSource: string;
  skuResolutions: SkuResolution[] | null;
  draftInvoiceItems: DraftInvoiceItem[] | null;
  laborMinutes: number | null;
  followUpNeeded: boolean;
  status: string;
}

interface ConfirmResult {
  ticketId: string;
  status: string;
  laborMinutes: number;
  resolvedSkus: string[];
  draftInvoiceItems: DraftInvoiceItem[];
  steps: {
    ticketClosed: boolean;
    partsDeducted: number;
    partsDeductFailed: number;
    draftConfirmed: boolean;
  };
  stepWarnings?: string[];
}

// ---------------------------------------------------------------------------
// Minimal, self-contained IndexedDB offline queue (best-effort)
// ---------------------------------------------------------------------------

const IDB_NAME = 'voice-close-queue';
const IDB_STORE = 'pending';

interface QueuedItem {
  dedupeKey: string;
  ticketId: string;
  body: Record<string, unknown>;
}

function openQueueDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'dedupeKey' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function queuePut(item: QueuedItem): Promise<void> {
  try {
    const db = await openQueueDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* best-effort */
  }
}

async function queueGetAll(): Promise<QueuedItem[]> {
  try {
    const db = await openQueueDb();
    if (!db) return [];
    return await new Promise<QueuedItem[]>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve((req.result as QueuedItem[]) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function queueDelete(dedupeKey: string): Promise<void> {
  try {
    const db = await openQueueDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(dedupeKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip the data: prefix
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const TOUCH = 'min-h-[48px]';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VoiceTicketClose() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { toast } = useToast();

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typedMode, setTypedMode] = useState(false);
  const [typedTranscript, setTypedTranscript] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [resolutions, setResolutions] = useState<SkuResolution[]>([]);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [queuedOffline, setQueuedOffline] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Seed from any existing draft for this ticket.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ticketId) return;
      try {
        const existing: Draft = await apiRequest(`/api/voice-ticket-close/${ticketId}`);
        if (!cancelled && existing && existing.status === 'draft') {
          applyDraft(existing);
        }
      } catch {
        /* 404 = no draft yet; that's the normal first-visit state */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // Online/offline listeners + drain the queue on reconnect.
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void drainQueue();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  function applyDraft(d: Draft) {
    setDraft(d);
    setExtracted(
      d.extracted ?? {
        actions_taken: '',
        parts_used: [],
        labor_minutes: d.laborMinutes ?? 0,
        follow_up_needed: d.followUpNeeded ?? false,
        customer_signature_collected: false,
        customer_satisfaction_note: '',
      },
    );
    setResolutions(Array.isArray(d.skuResolutions) ? d.skuResolutions : []);
    setConfirmResult(null);
  }

  async function postTranscribe(body: Record<string, unknown>): Promise<void> {
    const dedupeKey = (body.clientDedupeKey as string) ?? `${ticketId}-${Date.now()}`;
    body.clientDedupeKey = dedupeKey;

    // Offline (or unknown) → queue and bail. Server dedupes on reconnect.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await queuePut({ dedupeKey, ticketId: ticketId!, body });
      setQueuedOffline(true);
      toast({
        title: 'Queued offline',
        description: 'Your note will sync automatically when you reconnect.',
      });
      return;
    }

    try {
      setBusy(true);
      setError(null);
      const result: Draft = await apiRequest(
        `/api/voice-ticket-close/${ticketId}/transcribe`,
        'POST',
        body,
      );
      applyDraft(result);
      await queueDelete(dedupeKey);
    } catch (err: any) {
      // Network failure mid-flight → queue for retry on reconnect.
      await queuePut({ dedupeKey, ticketId: ticketId!, body });
      setQueuedOffline(true);
      setError(err?.message ?? 'Failed to transcribe');
      toast({
        title: 'Queued for retry',
        description: 'We could not reach the server; your note is saved and will sync.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  async function drainQueue(): Promise<void> {
    const items = await queueGetAll();
    if (items.length === 0) return;
    for (const item of items) {
      if (item.ticketId !== ticketId) continue;
      try {
        const result: Draft = await apiRequest(
          `/api/voice-ticket-close/${item.ticketId}/transcribe`,
          'POST',
          item.body,
        );
        applyDraft(result);
        await queueDelete(item.dedupeKey);
        setQueuedOffline(false);
        toast({ title: 'Synced', description: 'Your queued voice note was processed.' });
      } catch {
        /* leave it queued for the next reconnect */
      }
    }
  }

  // --- Recording ------------------------------------------------------------

  async function startRecording() {
    setError(null);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setTypedMode(true);
      toast({
        title: 'Microphone unavailable',
        description: 'Recording is not supported here — type your note instead.',
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const audioBase64 = await blobToBase64(blob);
          await postTranscribe({ audioBase64 });
        } catch (err: any) {
          setError(err?.message ?? 'Failed to read audio');
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err: any) {
      setTypedMode(true);
      setError(err?.message ?? 'Could not access the microphone');
    }
  }

  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    setRecording(false);
  }

  async function submitTyped() {
    if (!typedTranscript.trim()) {
      toast({ title: 'Nothing to submit', description: 'Type your close note first.' });
      return;
    }
    await postTranscribe({ transcript: typedTranscript.trim() });
  }

  // --- Edit / persist -------------------------------------------------------

  function updateExtracted<K extends keyof Extracted>(key: K, value: Extracted[K]) {
    setExtracted((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function chooseSku(idx: number, sku: string) {
    setResolutions((prev) => prev.map((r, i) => (i === idx ? { ...r, chosenSku: sku } : r)));
  }

  function setPartQty(idx: number, qty: number) {
    setResolutions((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, quantity: Math.max(1, qty) } : r)),
    );
  }

  async function saveDraft(): Promise<boolean> {
    if (!draft || !extracted) return false;
    try {
      setBusy(true);
      const updated: Draft = await apiRequest(
        `/api/voice-ticket-close/draft/${draft.id}`,
        'PATCH',
        {
          extracted,
          skuResolutions: resolutions,
          laborMinutes: extracted.labor_minutes,
          followUpNeeded: extracted.follow_up_needed,
        },
      );
      applyDraft(updated);
      return true;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save');
      toast({ title: 'Save failed', description: err?.message, variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmClose() {
    if (!draft) return;
    const saved = await saveDraft();
    if (!saved) return;
    try {
      setBusy(true);
      const result: ConfirmResult = await apiRequest(
        `/api/voice-ticket-close/draft/${draft.id}/confirm`,
        'POST',
        {},
      );
      setConfirmResult(result);
      toast({ title: 'Ticket closed', description: 'Parts deducted and invoice drafted.' });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to confirm');
      toast({ title: 'Confirm failed', description: err?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  // --- Render ---------------------------------------------------------------

  if (!ticketId) {
    return (
      <div className="p-4">
        <p className="text-destructive">Missing ticket id.</p>
      </div>
    );
  }

  // Success state.
  if (confirmResult) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" /> Ticket closed
            </CardTitle>
            <CardDescription>
              {confirmResult.steps.ticketClosed
                ? 'The service ticket was marked completed.'
                : 'The ticket update was deferred (it will be retried).'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Labor logged: {confirmResult.laborMinutes} min</p>
            <p>
              Parts deducted from truck: {confirmResult.steps.partsDeducted}
              {confirmResult.steps.partsDeductFailed > 0
                ? ` (${confirmResult.steps.partsDeductFailed} could not be deducted)`
                : ''}
            </p>
            <p>
              Invoice line items drafted (pending approval):{' '}
              {confirmResult.draftInvoiceItems.length}
            </p>
            {confirmResult.stepWarnings?.length ? (
              <p className="text-amber-600">
                Some steps degraded: {confirmResult.stepWarnings.join('; ')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Voice Close</h1>
        {!isOnline || queuedOffline ? (
          <Badge variant="outline" className="flex items-center gap-1 text-amber-600">
            <CloudOff className="h-3.5 w-3.5" /> {isOnline ? 'queued — will sync' : 'offline'}
          </Badge>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Capture step (hidden once we have a draft) */}
      {!draft ? (
        <Card>
          <CardHeader>
            <CardTitle>Record your close note</CardTitle>
            <CardDescription>
              Say what you did, parts used, and time on site. We&apos;ll draft the close for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!typedMode ? (
              <>
                {!recording ? (
                  <Button
                    onClick={startRecording}
                    disabled={busy}
                    className={`w-full text-lg ${TOUCH}`}
                    size="lg"
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Mic className="mr-2 h-6 w-6" />
                    )}
                    Start recording
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    className={`w-full text-lg ${TOUCH}`}
                    size="lg"
                  >
                    <Square className="mr-2 h-6 w-6" /> Stop &amp; transcribe
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => setTypedMode(true)}
                  className={`w-full ${TOUCH}`}
                >
                  <Keyboard className="mr-2 h-4 w-4" /> Type instead
                </Button>
              </>
            ) : (
              <>
                <Label htmlFor="typed">Type your close note</Label>
                <Textarea
                  id="typed"
                  value={typedTranscript}
                  onChange={(e) => setTypedTranscript(e.target.value)}
                  placeholder="Replaced fuser unit, cleaned rollers, 45 minutes on site. Customer signed off."
                  className="min-h-[120px]"
                />
                <Button onClick={submitTyped} disabled={busy} className={`w-full ${TOUCH}`}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Transcribe note
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setTypedMode(false)}
                  className={`w-full ${TOUCH}`}
                >
                  <Mic className="mr-2 h-4 w-4" /> Use the mic instead
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Review step */}
      {draft && extracted ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review &amp; edit</CardTitle>
              <CardDescription className="flex flex-wrap gap-2">
                <Badge variant="secondary">transcript: {draft.transcriptSource}</Badge>
                <Badge variant="secondary">extracted: {draft.extractionSource}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="actions">Actions taken</Label>
                <Textarea
                  id="actions"
                  value={extracted.actions_taken}
                  onChange={(e) => updateExtracted('actions_taken', e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="labor">Labor (minutes)</Label>
                <Input
                  id="labor"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={extracted.labor_minutes}
                  onChange={(e) =>
                    updateExtracted('labor_minutes', Math.max(0, Number(e.target.value) || 0))
                  }
                  className={TOUCH}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="followup">Follow-up needed</Label>
                <Switch
                  id="followup"
                  checked={extracted.follow_up_needed}
                  onCheckedChange={(v) => updateExtracted('follow_up_needed', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="signature">Customer signature collected</Label>
                <Switch
                  id="signature"
                  checked={extracted.customer_signature_collected}
                  onCheckedChange={(v) => updateExtracted('customer_signature_collected', v)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="satisfaction">Customer satisfaction note</Label>
                <Textarea
                  id="satisfaction"
                  value={extracted.customer_satisfaction_note}
                  onChange={(e) => updateExtracted('customer_satisfaction_note', e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parts used</CardTitle>
              <CardDescription>
                Match each spoken part to a SKU. &quot;Needs match&quot; means we weren&apos;t sure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {resolutions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No parts were detected.</p>
              ) : (
                resolutions.map((r, idx) => (
                  <div key={`${r.raw}-${idx}`} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.raw}</span>
                      {r.chosenSku ? (
                        <Badge variant="secondary">{r.chosenSku}</Badge>
                      ) : (
                        <Badge variant="destructive">needs match</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <Label>SKU</Label>
                        <Select
                          value={r.chosenSku ?? undefined}
                          onValueChange={(v) => chooseSku(idx, v)}
                        >
                          <SelectTrigger className={TOUCH}>
                            <SelectValue placeholder="Select a SKU" />
                          </SelectTrigger>
                          <SelectContent>
                            {r.candidates.length === 0 ? (
                              <SelectItem value="__none" disabled>
                                No candidates
                              </SelectItem>
                            ) : (
                              r.candidates.map((c) => (
                                <SelectItem key={c.sku} value={c.sku}>
                                  {c.sku} — {c.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={r.quantity}
                          onChange={(e) => setPartQty(idx, Number(e.target.value) || 1)}
                          className={TOUCH}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {Array.isArray(draft.draftInvoiceItems) && draft.draftInvoiceItems.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Drafted invoice items</CardTitle>
                <CardDescription>Pending approval — created when you confirm.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {draft.draftInvoiceItems.map((it, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>
                      {it.description} ×{it.quantity}
                    </span>
                    <span className="tabular-nums">${it.amount.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-2">
            <Button
              onClick={saveDraft}
              variant="outline"
              disabled={busy}
              className={`w-full ${TOUCH}`}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button
              onClick={confirmClose}
              disabled={busy}
              className={`w-full text-lg ${TOUCH}`}
              size="lg"
            >
              {busy ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-5 w-5" />
              )}
              Confirm &amp; close ticket
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
