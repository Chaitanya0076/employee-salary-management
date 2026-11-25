import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-client';
import { applyServerErrors } from './form-errors';

describe('applyServerErrors', () => {
  const error = new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
    { path: 'body.email', message: 'Already in use' },
    { path: 'body.compensation.components.0.amount', message: 'Must be greater than 0' },
    { path: 'body', message: 'Unrecognized key: "currency"' },
  ]);

  it('sets matching field errors (renaming server paths) and returns the rest', () => {
    const setError = vi.fn();

    const rest = applyServerErrors(error, setError, ['email', 'components'], {
      'compensation.components': 'components',
    });

    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Already in use' });
    expect(setError).toHaveBeenCalledWith('components.0.amount', {
      type: 'server',
      message: 'Must be greater than 0',
    });
    expect(rest).toBe('Unrecognized key: "currency"');
  });

  it('returns the error message when nothing maps to a field', () => {
    expect(
      applyServerErrors(new ApiError(500, 'INTERNAL_ERROR', 'Internal server error'), vi.fn(), [
        'email',
      ]),
    ).toBe('Internal server error');
  });

  it('returns a generic message for non-API errors', () => {
    expect(applyServerErrors(new Error('boom'), vi.fn(), [])).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
