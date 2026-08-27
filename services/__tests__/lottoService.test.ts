import { describe, it, expect } from 'vitest';
import { parseCSV } from '../lottoService';

describe('parseCSV', () => {
  it('解析含 p1/p2 的新 11 列行与旧 9 列行(缺省 prize=0)', () => {
    const csv = [
      'id,date,f1,f2,f3,f4,f5,b1,b2,p1,p2',
      '26098,2026-08-29,3,11,15,22,31,5,9,6840926,84016',
      '26097,2026-08-26,3,10,12,20,25,1,9',
    ].join('\n');
    const rows = parseCSV(csv);
    expect(rows.length).toBe(2);
    expect(rows[0].prize1).toBe(6840926);
    expect(rows[0].prize2).toBe(84016);
    expect(rows[1].prize1 ?? 0).toBe(0);
    expect(rows[1].prize2 ?? 0).toBe(0);
    // 旧字段不受影响
    expect(rows[0].front).toEqual([3, 11, 15, 22, 31]);
    expect(rows[0].back).toEqual([5, 9]);
  });
});
