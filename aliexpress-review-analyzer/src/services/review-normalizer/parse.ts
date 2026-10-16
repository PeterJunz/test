import Papa from 'papaparse';
import type { RawRow } from './normalize';

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 50_000;

export interface ParsedFile {
  format: 'csv' | 'json';
  rows: RawRow[];
  columns: string[];
  /** Non-fatal parser messages (e.g. malformed CSV lines). */
  parseWarnings: string[];
  truncated: boolean;
}

export type ImportErrorCode = 'invalid-json' | 'no-array' | 'no-header' | 'no-delimiter' | 'empty' | 'too-large' | 'bad-extension';

/** `code` + `params` let the UI translate the message; `message` is the English text. */
export class ImportError extends Error {
  readonly code: ImportErrorCode;
  readonly params: Record<string, string | number>;
  constructor(code: ImportErrorCode, message: string, params: Record<string, string | number> = {}) {
    super(message);
    this.code = code;
    this.params = params;
  }
}

const ARRAY_KEYS = ['reviews', 'data', 'items', 'results', 'records', 'feedbacks', 'evaluations', 'list', 'rows'];

/** Flattens nested objects to dotted keys; arrays are kept as values (they hold image lists). */
export function flattenRecord(obj: Record<string, unknown>, prefix = '', depth = 0, out: RawRow = {}): RawRow {
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && depth < 3) {
      flattenRecord(value as Record<string, unknown>, path, depth + 1, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

/** Finds the array of review objects inside an arbitrary JSON document. */
export function findRecordArray(doc: unknown, depth = 0): Record<string, unknown>[] | undefined {
  const isRecords = (v: unknown): v is Record<string, unknown>[] =>
    Array.isArray(v) && v.length > 0 && v.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x));
  if (Array.isArray(doc)) return isRecords(doc) ? doc : doc.length === 0 ? [] : undefined;
  if (!doc || typeof doc !== 'object' || depth > 4) return undefined;
  const obj = doc as Record<string, unknown>;
  for (const key of ARRAY_KEYS) if (isRecords(obj[key])) return obj[key] as Record<string, unknown>[];
  for (const value of Object.values(obj)) {
    const found = findRecordArray(value, depth + 1);
    if (found && found.length) return found;
  }
  return undefined;
}

function columnsOf(rows: RawRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows.slice(0, 500)) for (const k of Object.keys(row)) set.add(k);
  return [...set];
}

export function parseJsonText(text: string): ParsedFile {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new ImportError('invalid-json', `The file is not valid JSON (${(e as Error).message}).`, { detail: (e as Error).message });
  }
  const records = findRecordArray(doc);
  if (!records) throw new ImportError('no-array', 'No array of review objects was found in this JSON file.');
  const truncated = records.length > MAX_IMPORT_ROWS;
  const rows = records.slice(0, MAX_IMPORT_ROWS).map((r) => flattenRecord(r));
  return { format: 'json', rows, columns: columnsOf(rows), parseWarnings: [], truncated };
}

export function parseCsvText(text: string): ParsedFile {
  const result = Papa.parse<RawRow>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  const fields = (result.meta.fields ?? []).filter(Boolean);
  if (!fields.length) throw new ImportError('no-header', 'The CSV file has no header row.');
  if (fields.length === 1 && result.data.length > 0 && !result.meta.delimiter) {
    throw new ImportError('no-delimiter', 'Could not detect the CSV delimiter.');
  }
  const warnings = result.errors.slice(0, 20).map((e) => `Line ${e.row !== undefined ? e.row + 2 : '?'}: ${e.message}`);
  if (result.errors.length > 20) warnings.push(`…and ${result.errors.length - 20} more parser messages`);
  const truncated = result.data.length > MAX_IMPORT_ROWS;
  const rows = result.data.slice(0, MAX_IMPORT_ROWS);
  return { format: 'csv', rows, columns: fields, parseWarnings: warnings, truncated };
}

export function parseImportText(text: string, fileName: string): ParsedFile {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return parseJsonText(text);
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) return parseCsvText(text);
  const trimmed = text.trimStart();
  return trimmed.startsWith('[') || trimmed.startsWith('{') ? parseJsonText(text) : parseCsvText(text);
}

export async function parseImportFile(file: File): Promise<ParsedFile> {
  if (file.size === 0) throw new ImportError('empty', 'The file is empty.');
  if (file.size > MAX_IMPORT_BYTES) {
    const size = (file.size / 1024 / 1024).toFixed(1);
    throw new ImportError('too-large', `The file is ${size} MB; the limit is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`, { size, limit: MAX_IMPORT_BYTES / 1024 / 1024 });
  }
  if (!/\.(csv|tsv|txt|json)$/i.test(file.name)) throw new ImportError('bad-extension', 'Only .csv and .json files are supported.');
  const text = await file.text();
  return parseImportText(text, file.name);
}
