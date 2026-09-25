/**
 * The technician workflow's quick actions (round 215): Call Customer, Take
 * Photo and Add Notes had no handler. Pure pieces live here so they can be
 * tested with real inputs; the component does the IO.
 */

/** The base64 payload of a data: URL, which is what the attachments endpoint takes. */
export function base64FromDataUrl(dataUrl: string): string | null {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma === -1) return null;
  const payload = dataUrl.slice(comma + 1);
  return payload.length > 0 ? payload : null;
}

/**
 * A note is APPENDED to the ticket's work-order notes with a date stamp,
 * never written over them: the notes are the running record of the visit,
 * and a PATCH carrying only the new text would erase every earlier entry.
 */
export function appendWorkOrderNote(
  existing: string | null | undefined,
  note: string,
  at: Date,
): string | null {
  const text = note.trim();
  if (!text) return null;
  const entry = `[${at.toISOString().slice(0, 16).replace('T', ' ')}] ${text}`;
  const prior = (existing ?? '').trim();
  return prior ? `${prior}\n${entry}` : entry;
}

/** A dialable tel: href, or null when the stored number has no digits. */
export function telHref(phone: string | null | undefined): string | null {
  const cleaned = (phone ?? '').replace(/[^\d+]/g, '');
  return /\d/.test(cleaned) ? `tel:${cleaned}` : null;
}
