import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './session';

describe('safeRedirectPath', () => {
  it.each([
    ['/employees?country=GB', '/employees?country=GB'],
    ['/', '/'],
    [undefined, '/'],
    [42, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['employees', '/'],
    ['/login', '/'],
  ])('maps %j to %j', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
