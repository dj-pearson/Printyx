/**
 * CRMX-016: public booking manage page (/book/manage/:token). No auth, no app
 * shell. Lets an invitee reschedule or cancel using the opaque manage token
 * from their confirmation email.
 */
import { useEffect, useMemo, useState } from 'react';

interface ManageBooking {
  id: string;
  title: string;
  slug: string;
  status: string;
  startTime: string;
  endTime: string;
  inviteeName: string;
  inviteeTimezone: string;
  durationMinutes: number;
  timezone: string;
  location: string | null;
  branding: { companyName?: string; primaryColor?: string };
  hostName: string;
}

interface Slot {
  start: string;
  end: string;
}

const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

function getToken(): string {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('manage');
  return idx !== -1 ? (parts[idx + 1] ?? '') : '';
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function fmtFull(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: visitorTz,
  }).format(new Date(iso));
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

export default function BookingManage() {
  const token = getToken();
  const [booking, setBooking] = useState<ManageBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const accent = booking?.branding?.primaryColor || '#111827';

  const dateOptions = useMemo(() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 0; i <= 30; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      out.push(ymd(d));
    }
    return out;
  }, []);

  async function load() {
    try {
      const res = await fetch(`/api/public/booking/manage/${encodeURIComponent(token)}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      setBooking((await res.json()) as ManageBooking);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function pickDate(date: string) {
    if (!booking) return;
    setSelectedDate(date);
    setSlots([]);
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/public/booking/${encodeURIComponent(booking.slug)}/availability?date=${date}&timezone=${encodeURIComponent(visitorTz)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { slots: Slot[] };
        setSlots(data.slots ?? []);
      }
    } finally {
      setSlotsLoading(false);
    }
  }

  async function doReschedule(start: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/public/booking/manage/${encodeURIComponent(token)}/reschedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || 'Could not reschedule. Try another time.');
        return;
      }
      setMode('view');
      await load();
      setMessage('Your meeting has been rescheduled.');
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/booking/manage/${encodeURIComponent(token)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await load();
        setMessage('Your meeting has been cancelled.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" />
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Booking not found</h1>
          <p className="mt-2 text-gray-500">This link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const cancelled = booking.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <p className="text-sm text-gray-500">{booking.branding?.companyName || 'Printyx'}</p>
          <h1 className="text-xl font-semibold text-gray-900">{booking.title}</h1>
        </div>

        <div className="p-6">
          {message ? (
            <div className="mb-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">
              {message}
            </div>
          ) : null}

          <div className="mb-6">
            <p className="text-gray-600">
              {cancelled ? 'This meeting was cancelled.' : 'Scheduled for'}
            </p>
            <p
              className={`text-lg font-medium ${cancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}
            >
              {fmtFull(booking.startTime)}
            </p>
            <p className="text-gray-500 text-sm mt-1">with {booking.hostName}</p>
            {booking.location ? (
              <p className="text-gray-500 text-sm">📍 {booking.location}</p>
            ) : null}
          </div>

          {cancelled ? (
            <a
              href={`/book/${booking.slug}`}
              className="text-sm underline text-gray-600 hover:text-gray-900"
            >
              Book a new time
            </a>
          ) : mode === 'view' ? (
            <div className="flex gap-3">
              <button
                onClick={() => setMode('reschedule')}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ background: accent }}
              >
                Reschedule
              </button>
              <button
                onClick={doCancel}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel meeting
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setMode('view')}
                className="text-sm text-gray-500 hover:text-gray-800 mb-3"
              >
                ← Back
              </button>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Pick a new day</h3>
                  <div className="max-h-64 overflow-y-auto pr-1 space-y-1">
                    {dateOptions.map((d) => (
                      <button
                        key={d}
                        onClick={() => pickDate(d)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${
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
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Times</h3>
                  {!selectedDate ? (
                    <p className="text-gray-400 text-sm">Select a day.</p>
                  ) : slotsLoading ? (
                    <p className="text-gray-400 text-sm">Loading…</p>
                  ) : slots.length === 0 ? (
                    <p className="text-gray-400 text-sm">No times available.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {slots.map((s) => (
                        <button
                          key={s.start}
                          onClick={() => doReschedule(s.start)}
                          disabled={busy}
                          className="px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-800 hover:border-gray-500 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {fmtTime(s.start)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-4">Powered by Printyx</p>
    </div>
  );
}
