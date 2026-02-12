import { ApiError } from '@/lib/api';

describe('ApiError', () => {
  it('creates error with status and message', () => {
    const error = new ApiError(401, 'Unauthorized');
    expect(error.status).toBe(401);
    expect(error.message).toBe('401: Unauthorized');
    expect(error.name).toBe('ApiError');
  });

  it('is instanceof Error', () => {
    const error = new ApiError(500, 'Server Error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('has correct status codes', () => {
    expect(new ApiError(404, 'Not Found').status).toBe(404);
    expect(new ApiError(403, 'Forbidden').status).toBe(403);
    expect(new ApiError(422, 'Validation').status).toBe(422);
  });
});
