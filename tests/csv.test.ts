import { describe, expect, it } from 'vitest';
import { generateCity } from '../src/sim/city';
import { defaultScenario } from '../src/sim/scenario';
import { CSV_HEADER, ordersToCsv, parseOrdersCsv, splitCsvLine } from '../src/sim/csv';

const city = generateCity();
const scenario = defaultScenario(city, 40);
const head = CSV_HEADER.join(',');

describe('splitCsvLine', () => {
  it('splits plain fields and trims them', () => {
    expect(splitCsvLine('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps commas and doubled quotes inside quoted fields', () => {
    expect(splitCsvLine('"Rao, Asha","He said ""hi""",3')).toEqual(['Rao, Asha', 'He said "hi"', '3']);
  });

  it('keeps empty fields', () => {
    expect(splitCsvLine(',,')).toEqual(['', '', '']);
  });
});

describe('parseOrdersCsv', () => {
  it('round-trips an export: same count, ids, units and junctions', () => {
    const csv = ordersToCsv(city, scenario.orders);
    const res = parseOrdersCsv(city, csv, 200, scenario.depotNode);
    expect(res.issues).toEqual([]);
    expect(res.orders.length).toBe(scenario.orders.length);
    expect(res.orders.map((o) => o.id)).toEqual(scenario.orders.map((o) => o.id));
    expect(res.orders.map((o) => o.demand)).toEqual(scenario.orders.map((o) => o.demand));
    expect(res.orders.map((o) => o.node)).toEqual(scenario.orders.map((o) => o.node));
  });

  it('accepts an Excel byte-order mark, CRLF line ends and column order changes', () => {
    const text = `${String.fromCharCode(0xfeff)}units,y_km,x_km\r\n4,2.5,3.1\r\n2,6,9\r\n`;
    const res = parseOrdersCsv(city, text, 200, scenario.depotNode);
    expect(res.issues).toEqual([]);
    expect(res.orders.map((o) => o.demand)).toEqual([4, 2]);
    expect(res.orders[0].id).toBe('CSV-1000');
  });

  it('reports missing required columns and imports nothing', () => {
    const res = parseOrdersCsv(city, 'id,name\nA,B\n', 200, scenario.depotNode);
    expect(res.orders).toEqual([]);
    expect(res.issues[0]).toEqual({ line: 1, message: 'Missing columns: x_km, y_km, units' });
  });

  it('rejects rows off the sheet or over one van’s capacity, with their line numbers', () => {
    const text = [head, 'a,,,3,3,5', 'b,,,99,3,5', 'c,,,3,3,0', 'd,,,3,3,201', 'e,,,x,3,5', 'f,,,4,4,200'].join('\n');
    const res = parseOrdersCsv(city, text, 200, scenario.depotNode);
    expect(res.orders.map((o) => o.id)).toEqual(['a', 'f']);
    expect(res.issues.map((i) => i.line)).toEqual([3, 4, 5, 6]);
  });

  it('never puts two orders, or an order and the depot, on one junction', () => {
    const rows = Array.from({ length: 30 }, (_, i) => `o${i},,,6,4,1`);
    const res = parseOrdersCsv(city, [head, ...rows].join('\n'), 200, scenario.depotNode);
    const nodes = res.orders.map((o) => o.node);
    expect(res.orders.length).toBe(30);
    expect(new Set(nodes).size).toBe(30);
    expect(nodes).not.toContain(scenario.depotNode);
  });

  it('stops at the row limit and says so', () => {
    const rows = Array.from({ length: 12 }, (_, i) => `o${i},,,${1 + (i % 10)},${1 + (i % 6)},1`);
    const res = parseOrdersCsv(city, [head, ...rows].join('\n'), 200, scenario.depotNode, 10);
    expect(res.orders.length).toBe(10);
    expect(res.issues).toEqual([{ line: 12, message: 'Only the first 10 orders are imported' }]);
  });

  it('caps long text fields', () => {
    const res = parseOrdersCsv(city, `${head}\n${'x'.repeat(40)},${'n'.repeat(80)},${'s'.repeat(90)},3,3,1`, 200, scenario.depotNode);
    expect(res.orders[0].id.length).toBe(24);
    expect(res.orders[0].name.length).toBe(48);
    expect(res.orders[0].street.length).toBe(64);
  });
});
