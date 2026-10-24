import { nearestNode, type City } from './city';
import type { Order } from './scenario';

/**
 * Order import/export. Kesarnagar is fictional, so positions are kilometres on its map sheet
 * (x east 0–12, y south 0–8) rather than latitude/longitude; each row snaps to the nearest junction.
 */

export const CSV_HEADER = ['id', 'name', 'address', 'x_km', 'y_km', 'units'] as const;

export interface CsvIssue {
  line: number;
  message: string;
}

export interface CsvResult {
  orders: Order[];
  issues: CsvIssue[];
  rows: number;
}

/** Splits one CSV line, honouring double-quoted fields with embedded commas and doubled quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const q = (s: string | number) => {
  const v = String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export function ordersToCsv(city: City, orders: Order[]): string {
  const rows = orders.map((o) =>
    [o.id, o.name, o.street, (city.x[o.node] / 1000).toFixed(3), (city.y[o.node] / 1000).toFixed(3), o.demand].map(q).join(','),
  );
  return [CSV_HEADER.join(','), ...rows].join('\n') + '\n';
}

export function parseOrdersCsv(city: City, text: string, maxUnits: number, depotNode: number, limit = 500): CsvResult {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.charCodeAt(0) === 0xfeff) lines[0] = lines[0].slice(1); // Excel's byte-order mark
  const issues: CsvIssue[] = [];
  const orders: Order[] = [];
  const used = new Set<number>([depotNode]);
  const header = splitCsvLine(lines[0] ?? '').map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const need = ['x_km', 'y_km', 'units'];
  const missing = need.filter((n) => col(n) < 0);
  if (missing.length) {
    return { orders: [], rows: 0, issues: [{ line: 1, message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` }] };
  }
  let rows = 0;
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    rows++;
    if (orders.length >= limit) {
      issues.push({ line: i + 1, message: `Only the first ${limit} orders are imported` });
      break;
    }
    const f = splitCsvLine(raw);
    const x = parseFloat(f[col('x_km')]);
    const y = parseFloat(f[col('y_km')]);
    const units = parseInt(f[col('units')], 10);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > city.width / 1000 || y > city.height / 1000) {
      issues.push({ line: i + 1, message: `Position must be inside the sheet (x 0–${city.width / 1000}, y 0–${city.height / 1000} km)` });
      continue;
    }
    if (!Number.isInteger(units) || units < 1 || units > maxUnits) {
      issues.push({ line: i + 1, message: `Units must be a whole number from 1 to ${maxUnits} (one van’s capacity)` });
      continue;
    }
    const node = nearestNode(city, x * 1000, y * 1000, used);
    if (node < 0) {
      issues.push({ line: i + 1, message: 'No free junction left near this position' });
      continue;
    }
    used.add(node);
    const id = (col('id') >= 0 && f[col('id')]) || `CSV-${1000 + orders.length}`;
    orders.push({
      id: id.slice(0, 24),
      node,
      demand: units,
      name: ((col('name') >= 0 && f[col('name')]) || `Customer ${orders.length + 1}`).slice(0, 48),
      street: ((col('address') >= 0 && f[col('address')]) || 'Imported address').slice(0, 64),
    });
  }
  return { orders, issues, rows };
}

/** Starts a client-side download of generated text. No network involved. */
export function downloadText(filename: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
