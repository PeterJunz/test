/** Reads `a.b.0.c` style paths from parsed JSON. Never walks into prototype properties. */
export function getPath(source: unknown, path: string): unknown {
  if (!path.trim()) return source;
  let current: unknown = source;
  for (const part of path.split('.').map((p) => p.trim()).filter(Boolean)) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
