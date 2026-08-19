/**
 * CRMX-016: public Calendly-style booking page (/book/:slug). No auth, no app
 * shell — rendered directly by App.tsx before the auth gate. Fetches the page
 * config from the public endpoint, shows day + slot pickers, and submits a
 * booking. Slots are rendered in the visitor's local timezone.
 */
import { useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '@/lib/config';

// PROD-004: these are UNAUTHENTICATED pages, so the calls below go through
// getApiUrl rather than apiRequest. getApiUrl is what turns /api/x into the edge
// function host in production — a bare relative fetch resolves against whatever
// origin serves the static bundle, which is not the API, so every one of these
// 404'd for real visitors while working in dev. apiRequest would fix the URL too
// but also attaches a Bearer token and throws on a non-2xx, and these handlers
// are public and use res.ok to tell "not found" from "found".

interface Branding {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  welcomeMessage?: string;
}

interface PublicPage {
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  durationMinutes: number;
  dateRangeDays: number;
  minNoticeMinutes: number;
  location: string | null;
  branding: Branding;
  hostName: string;
  bookingType: string;
}

interface Slot {
  start: string;
  end: string;
}

function getSlug(): string {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('book');
  return idx !== -1 ? (parts[idx + 1] ?? '') : '';
}

const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: visitorTz,
  }).format(new Date(iso));
}

function fmtDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(y, m - 1, d));
}

function fmtFull(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: visitorTz,
  }).format(new Date(iso));
}

export default function PublicBooking() {
  const slug = getSlug();
  const [page, setPage] = useState<PublicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    startTime: string;
    hostName: string;
    manageUrl: string;
    confirmationMessage: string | null;
  } | null>(null);

  const accent = page?.branding?.primaryColor || '#111827';

  const dateOptions = useMemo(() => {
    if (!page) return [];
    const out: string[] = [];
    const today = new Date();
    for (let i = 0; i <= page.dateRangeDays; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      out.push(ymd(d));
    }
    return out;
  }, [page]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(getApiUrl(`/api/public/booking/${encodeURIComponent(slug)}`));
        if (!res.ok) {
          if (active) setNotFound(true);
          return;
        }
        const data = (await res.json()) as PublicPage;
        if (active) setPage(data);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  async function pickDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);
    setSlotsLoading(true);
    try {
      const res = await fetch(
        getApiUrl(
          `/api/public/booking/${encodeURIComponent(slug)}/availability?date=${date}&timezone=${encodeURIComponent(visitorTz)}`,
        ),
      );
      if (res.ok) {
        const data = (await res.json()) as { slots: Slot[] };
        setSlots(data.slots ?? []);
      }
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function submit() {
    if (!selectedSlot) return;
    setError(null);
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Please enter your name and a valid email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl(`/api/public/booking/${encodeURIComponent(slug)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: selectedSlot.start,
          inviteeName: form.name.trim(),
          inviteeEmail: form.email.trim(),
          inviteePhone: form.phone.trim() || undefined,
          inviteeCompany: form.company.trim() || undefined,
          inviteeNotes: form.notes.trim() || undefined,
          inviteeTimezone: visitorTz,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || 'Could not complete booking. Please try another time.');
        if (res.status === 409 && selectedDate) await pickDate(selectedDate);
        return;
      }
      setConfirmed({
        startTime: data.booking.startTime,
        hostName: data.booking.hostName,
        manageUrl: data.manageUrl,
        confirmationMessage: data.booking.confirmationMessage,
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Booking page not found</h1>
          <p className="mt-2 text-gray-500">
            This scheduling link is unavailable or has been disabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-4">
          {page.branding?.logoUrl ? (
            <img src={page.branding.logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
          ) : null}
          <div>
            <p className="text-sm text-gray-500">{page.branding?.companyName || 'Printyx'}</p>
            <h1 className="text-xl font-semibold text-gray-900">{page.title}</h1>
          </div>
        </div>

        {confirmed ? (
          <div className="p-8 text-center">
            <div
              className="mx-auto mb-4 h-14 w-14 rounded-full flex items-center justify-center text-white text-2xl"
              style={{ background: accent }}
            >
              ✓
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">You're booked!</h2>
            <p className="mt-2 text-gray-600">{fmtFull(confirmed.startTime)}</p>
            <p className="mt-1 text-gray-500">with {confirmed.hostName}</p>
            {confirmed.confirmationMessage ? (
              <p className="mt-4 text-gray-600">{confirmed.confirmationMessage}</p>
            ) : (
              <p className="mt-4 text-gray-500">A confirmation email is on its way.</p>
            )}
            <a
              href={confirmed.manageUrl}
              className="inline-block mt-6 text-sm underline text-gray-600 hover:text-gray-900"
            >
              Need to reschedule or cancel?
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Left: description + date list */}
            <div className="p-6 border-r border-gray-100">
              {page.description ? (
                <p className="text-gray-600 mb-4 whitespace-pre-wrap">{page.description}</p>
              ) : null}
              <div className="text-sm text-gray-500 space-y-1 mb-4">
                <p>⏱ {page.durationMinutes} min</p>
                {page.location ? <p>📍 {page.location}</p> : null}
                <p>🌐 Times shown in {visitorTz}</p>
              </div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Select a day</h3>
              <div className="max-h-72 overflow-y-auto pr-1 space-y-1">
                {dateOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => pickDate(d)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition ${
                      selectedDate === d
                        ? 'text-white border-transparent'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                    style={selectedDate === d ? { background: accent } : undefined}
                  >
                    {fmtDay(d)}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: slots or form */}
            <div className="p-6">
              {!selectedDate ? (
                <p className="text-gray-400 text-sm">Pick a day to see available times.</p>
              ) : selectedSlot ? (
                <div>
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="text-sm text-gray-500 hover:text-gray-800 mb-3"
                  >
                    ← Back to times
                  </button>
                  <p className="text-sm font-medium text-gray-900 mb-4">
                    {fmtFull(selectedSlot.start)}
                  </p>
                  <div className="space-y-3">
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Your name *"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Email *"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Company"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                    />
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Anything you'd like to share?"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    <button
                      onClick={submit}
                      disabled={submitting}
                      className="w-full py-2.5 rounded-lg text-white font-medium disabled:opacity-60"
                      style={{ background: accent }}
                    >
                      {submitting ? 'Scheduling…' : 'Schedule meeting'}
                    </button>
                  </div>
                </div>
              ) : slotsLoading ? (
                <p className="text-gray-400 text-sm">Loading times…</p>
              ) : slots.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  No available times on this day. Try another.
                </p>
              ) : (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">{fmtDay(selectedDate)}</h3>
                  <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                    {slots.map((s) => (
                      <button
                        key={s.start}
                        onClick={() => setSelectedSlot(s)}
                        className="px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-800 hover:border-gray-500 hover:bg-gray-50"
                      >
                        {fmtTime(s.start)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-gray-400 mt-4">Powered by Printyx</p>
    </div>
  );
}
