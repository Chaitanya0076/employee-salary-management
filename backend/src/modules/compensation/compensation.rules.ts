/**
 * Compensation component rules shared by "create employee" (initial pay)
 * and "record a pay change" (prompt-06). See docs/data-model.md R1.
 */
export const COMPONENT_TYPES = ['BASE', 'BONUS', 'ALLOWANCE'] as const;
export type ComponentTypeName = (typeof COMPONENT_TYPES)[number];

export interface ComponentIssue {
  /** Path relative to the components array, e.g. [2, 'type']. */
  path: (string | number)[];
  message: string;
}

/** Exactly one BASE, and no component type more than once. */
export function componentIssues(
  components: readonly { type: ComponentTypeName }[],
): ComponentIssue[] {
  const issues: ComponentIssue[] = [];
  if (!components.some((c) => c.type === 'BASE')) {
    issues.push({ path: [], message: 'A BASE component is required' });
  }
  const seen = new Set<ComponentTypeName>();
  components.forEach((c, i) => {
    if (seen.has(c.type))
      issues.push({ path: [i, 'type'], message: `Duplicate ${c.type} component` });
    seen.add(c.type);
  });
  return issues;
}
