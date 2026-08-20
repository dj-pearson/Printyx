/**
 * CRMX-011: public hosted/embeddable web form (/f/:token). No auth, no app
 * shell. Fetches the form definition from the public endpoint, renders it, and
 * submits captures back. Rendered directly by App.tsx before the auth gate.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { getApiUrl } from '@/lib/config';

// PROD-014: these are UNAUTHENTICATED pages, so the calls below go through
// getApiUrl rather than apiRequest. getApiUrl is what turns /api/x into the edge
// function host in production — a bare relative fetch resolves against whatever
// origin serves the static bundle, which is not the API, so every one of these
// 404'd for real visitors while working in dev. apiRequest would fix the URL too
// but also attaches a Bearer token and throws on a non-2xx, and these handlers
// are public and use res.ok to tell "not found" from "found".

interface PublicField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  options: Array<{ value: string; label: string }> | null;
}

interface PublicForm {
  id: string;
  name: string;
  description: string | null;
  fields: PublicField[];
  submitButtonText: string;
  successMessage: string;
  honeypotField: string;
}

function getToken(): string {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('f');
  return idx !== -1 ? (parts[idx + 1] ?? '') : '';
}

function collectUtm(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = p.get(k);
    if (v) utm[k] = v;
  }
  return utm;
}

export default function HostedFormPage() {
  const token = getToken();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(getApiUrl(`/api/public/forms/${encodeURIComponent(token)}`));
        if (!res.ok) {
          if (active) setNotFound(true);
          return;
        }
        const data = (await res.json()) as PublicForm;
        if (active) setForm(data);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { ...values, [form.honeypotField]: honeypot };
      const utm = collectUtm();
      if (Object.keys(utm).length) body._utm = utm;

      const res = await fetch(getApiUrl(`/api/public/forms/${encodeURIComponent(token)}/submit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Please try again.');
        return;
      }
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setSubmitted(data?.message || form.successMessage);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-400" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <p className="text-slate-500">This form is not available.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-lg rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{form.name}</h1>
        {form.description && <p className="mt-1 text-sm text-slate-500">{form.description}</p>}

        {submitted ? (
          <div className="mt-6 rounded-md bg-green-50 p-4 text-sm text-green-800">{submitted}</div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {form.fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="block text-sm font-medium text-slate-700">
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={field.key}
                    required={field.required}
                    placeholder={field.placeholder ?? ''}
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    rows={4}
                  />
                ) : field.type === 'select' ? (
                  <select
                    id={field.key}
                    required={field.required}
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <input
                    id={field.key}
                    type="checkbox"
                    checked={values[field.key] === 'true'}
                    onChange={(e) =>
                      setValues({ ...values, [field.key]: String(e.target.checked) })
                    }
                    className="mt-2 h-4 w-4"
                  />
                ) : (
                  <input
                    id={field.key}
                    type={
                      field.type === 'email'
                        ? 'email'
                        : field.type === 'number'
                          ? 'number'
                          : field.type === 'phone'
                            ? 'tel'
                            : field.type === 'url'
                              ? 'url'
                              : 'text'
                    }
                    required={field.required}
                    placeholder={field.placeholder ?? ''}
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                )}
              </div>
            ))}

            {/* Honeypot — hidden from users, catches bots. */}
            <input
              type="text"
              name={form.honeypotField}
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : form.submitButtonText}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
