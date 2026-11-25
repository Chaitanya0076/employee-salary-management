import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_PARAMS, parseListParams, toApiQuery, toSearchParams } from './list-params';

const parse = (query: string) => parseListParams(new URLSearchParams(query));

describe('parseListParams', () => {
  it('returns defaults for an empty query', () => {
    expect(parse('')).toEqual(DEFAULT_LIST_PARAMS);
  });

  it('reads every supported parameter', () => {
    expect(
      parse(
        'q=smith&country=gb&department=2&level=L3&status=INACTIVE&sort=totalUsd:desc&pageSize=50&page=3',
      ),
    ).toEqual({
      q: 'smith',
      country: 'GB',
      department: '2',
      level: 'L3',
      status: 'INACTIVE',
      sort: 'totalUsd',
      direction: 'desc',
      pageSize: 50,
      page: 3,
    });
  });

  it('ignores invalid values instead of failing', () => {
    expect(
      parse('country=GBR&department=x&level=L9&status=gone&sort=salary:up&pageSize=33&page=-1'),
    ).toEqual(DEFAULT_LIST_PARAMS);
  });
});

describe('toSearchParams', () => {
  it('omits defaults so URLs stay short', () => {
    expect(toSearchParams(DEFAULT_LIST_PARAMS).toString()).toBe('');
  });

  it('round-trips through the URL', () => {
    const params = {
      ...DEFAULT_LIST_PARAMS,
      q: 'ann',
      country: 'IN',
      sort: 'hireDate' as const,
      direction: 'desc' as const,
      page: 4,
    };
    expect(parseListParams(toSearchParams(params))).toEqual(params);
  });
});

describe('toApiQuery', () => {
  it('maps to API parameters and can drop paging for the export', () => {
    const params = { ...DEFAULT_LIST_PARAMS, q: ' smith ', department: '2', page: 2 };
    expect(toApiQuery(params)).toEqual({
      q: 'smith',
      country: undefined,
      department: '2',
      level: undefined,
      status: undefined,
      sort: 'name:asc',
      page: 2,
      pageSize: 25,
    });
    expect(toApiQuery(params, { paging: false })).not.toHaveProperty('page');
  });
});
