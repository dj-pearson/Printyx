import { describe, it, expect, vi } from 'vitest';
import { buildErrorBody, defaultCodeForStatus, sendError } from '../../utils/send-error';
import type { Request, Response } from 'express';

describe('defaultCodeForStatus (CR-023)', () => {
  it('maps common statuses to machine codes', () => {
    expect(defaultCodeForStatus(400)).toBe('BAD_REQUEST');
    expect(defaultCodeForStatus(401)).toBe('UNAUTHORIZED');
    expect(defaultCodeForStatus(403)).toBe('FORBIDDEN');
    expect(defaultCodeForStatus(404)).toBe('NOT_FOUND');
    expect(defaultCodeForStatus(409)).toBe('CONFLICT');
    expect(defaultCodeForStatus(500)).toBe('INTERNAL_ERROR');
    expect(defaultCodeForStatus(418)).toBe('REQUEST_ERROR');
  });
});

describe('buildErrorBody (CR-023)', () => {
  it('emits the canonical {message, code, requestId} shape', () => {
    expect(buildErrorBody(404, 'Task not found', undefined, undefined, 'req-1')).toEqual({
      message: 'Task not found',
      code: 'NOT_FOUND',
      requestId: 'req-1',
    });
  });

  it('honors an explicit code and includes details only when present', () => {
    expect(buildErrorBody(400, 'Invalid', 'VALIDATION_ERROR', { errors: [1] }, 'r')).toEqual({
      message: 'Invalid',
      code: 'VALIDATION_ERROR',
      details: { errors: [1] },
      requestId: 'r',
    });
  });

  it('omits the details key entirely when not provided', () => {
    const body = buildErrorBody(500, 'boom');
    expect(body).not.toHaveProperty('details');
    expect(body.requestId).toBeUndefined();
  });
});

describe('sendError (CR-023)', () => {
  it('sets the status and sends the canonical body with the request id', () => {
    const req = { requestId: 'abc-123' } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;

    sendError(req, res, 403, 'Nope', 'FORBIDDEN');

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      message: 'Nope',
      code: 'FORBIDDEN',
      requestId: 'abc-123',
    });
  });
});
