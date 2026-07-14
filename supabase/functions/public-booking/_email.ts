// CRMX-016 — confirmation / reschedule / cancellation emails for public bookings.
//
// Uses the shared SendGrid helper (email-marketing/_sendgrid.ts). When
// SENDGRID_API_KEY is unset the helper runs in simulation mode (no send, no
// throw), so these calls are always safe to await best-effort.

import { sendEmail } from '../email-marketing/_sendgrid.ts';

const FROM = Deno.env.get('BOOKING_FROM_EMAIL') || 'noreply@printyx.net';

export interface BookingEmailInfo {
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  hostName: string;
  title: string;
  startTime: string; // ISO (UTC)
  endTime: string; // ISO (UTC)
  location: string | null;
  brandName: string;
  manageUrl: string;
}

function fmt(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString();
  }
}

function shell(brand: string, heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:#111827;color:#fff;padding:20px 24px;font-size:16px;font-weight:600">${brand}</div>
      <div style="padding:24px">
        <h1 style="margin:0 0 16px;font-size:20px">${heading}</h1>
        ${bodyHtml}
      </div>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">Powered by Printyx</p>
  </div></body></html>`;
}

function detailRows(info: BookingEmailInfo): string {
  return `
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:6px 0;color:#6b7280;width:120px">What</td><td style="padding:6px 0;font-weight:600">${info.title}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">When</td><td style="padding:6px 0;font-weight:600">${fmt(info.startTime, info.inviteeTimezone)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Host</td><td style="padding:6px 0">${info.hostName}</td></tr>
    ${info.location ? `<tr><td style="padding:6px 0;color:#6b7280">Where</td><td style="padding:6px 0">${info.location}</td></tr>` : ''}
  </table>`;
}

function manageButtons(info: BookingEmailInfo): string {
  return `<div style="margin-top:20px">
    <a href="${info.manageUrl}" style="display:inline-block;padding:10px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">Reschedule or cancel</a>
  </div>`;
}

export async function sendConfirmation(info: BookingEmailInfo): Promise<boolean> {
  try {
    await sendEmail({
      to: info.inviteeEmail,
      from: FROM,
      fromName: info.brandName,
      subject: `Confirmed: ${info.title} with ${info.hostName}`,
      html: shell(
        info.brandName,
        `You're booked, ${info.inviteeName.split(' ')[0]}!`,
        `<p style="margin:0;color:#374151">Your meeting is confirmed. Details below.</p>${detailRows(info)}${manageButtons(info)}`,
      ),
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendReschedule(info: BookingEmailInfo): Promise<boolean> {
  try {
    await sendEmail({
      to: info.inviteeEmail,
      from: FROM,
      fromName: info.brandName,
      subject: `Updated: ${info.title} with ${info.hostName}`,
      html: shell(
        info.brandName,
        `Your meeting has been rescheduled`,
        `<p style="margin:0;color:#374151">Here are your new meeting details.</p>${detailRows(info)}${manageButtons(info)}`,
      ),
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendCancellation(info: BookingEmailInfo): Promise<boolean> {
  try {
    await sendEmail({
      to: info.inviteeEmail,
      from: FROM,
      fromName: info.brandName,
      subject: `Cancelled: ${info.title} with ${info.hostName}`,
      html: shell(
        info.brandName,
        `Your meeting has been cancelled`,
        `<p style="margin:0;color:#374151">The following meeting was cancelled. You can book a new time anytime.</p>${detailRows(info)}`,
      ),
    });
    return true;
  } catch {
    return false;
  }
}
