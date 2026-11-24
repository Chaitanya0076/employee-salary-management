import { describe, expect, it } from 'vitest';
import { componentIssues } from '../../src/modules/compensation/compensation.rules.js';
import { ComponentsInput } from '../../src/modules/compensation/compensation.schema.js';

describe('componentIssues', () => {
  it('accepts exactly one BASE with optional other types', () => {
    expect(componentIssues([{ type: 'BASE' }])).toEqual([]);
    expect(componentIssues([{ type: 'BONUS' }, { type: 'BASE' }, { type: 'ALLOWANCE' }])).toEqual(
      [],
    );
  });

  it('requires a BASE component', () => {
    expect(componentIssues([{ type: 'BONUS' }])).toEqual([
      { path: [], message: 'A BASE component is required' },
    ]);
  });

  it('flags every repeated type at its position', () => {
    expect(
      componentIssues([{ type: 'BASE' }, { type: 'BONUS' }, { type: 'BASE' }, { type: 'BONUS' }]),
    ).toEqual([
      { path: [2, 'type'], message: 'Duplicate BASE component' },
      { path: [3, 'type'], message: 'Duplicate BONUS component' },
    ]);
  });
});

describe('ComponentsInput', () => {
  it('normalises numeric amounts to strings', () => {
    expect(ComponentsInput.parse([{ type: 'BASE', amount: 85000.5 }])).toEqual([
      { type: 'BASE', amount: '85000.5' },
    ]);
  });

  it.each([
    ['zero', 0],
    ['negative', '-1'],
    ['three decimals', '1.005'],
    ['exponent notation', 1e21],
    ['more than 12 integer digits', '1234567890123'],
    ['text', 'abc'],
  ])('rejects a %s amount', (_label, amount) => {
    expect(ComponentsInput.safeParse([{ type: 'BASE', amount }]).success).toBe(false);
  });

  it('rejects an empty list and unknown component types', () => {
    expect(ComponentsInput.safeParse([]).success).toBe(false);
    expect(ComponentsInput.safeParse([{ type: 'EQUITY', amount: 1 }]).success).toBe(false);
  });
});
