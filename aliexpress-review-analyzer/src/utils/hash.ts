/** FNV-1a 32-bit hash, rendered base36. Good enough for de-duplication keys, not for security. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Two independent hashes joined: collisions become very unlikely for review-sized datasets. */
export function stableId(parts: Array<string | number | undefined>): string {
  const s = parts.map((p) => (p === undefined ? '' : String(p))).join('␟');
  return `r_${hashString(s)}${hashString(s.split('').reverse().join(''))}`;
}

export function randomId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
