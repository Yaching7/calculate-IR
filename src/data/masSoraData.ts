import { MasSoraRecord } from '../types/sora';

/**
 * Official Singapore Public Holidays (2025 - 2026) per Ministry of Manpower (MOM) & MAS Money Market Calendar
 */
export const SG_PUBLIC_HOLIDAYS: Record<string, string> = {
  '2025-08-09': 'National Day',
  '2025-10-20': 'Deepavali',
  '2025-12-25': 'Christmas Day',
  '2026-01-01': "New Year's Day",
  '2026-02-17': 'Chinese New Year (Day 1)',
  '2026-02-18': 'Chinese New Year (Day 2)',
  '2026-03-20': 'Hari Raya Puasa',
  '2026-04-03': 'Good Friday',
  '2026-05-01': 'Labour Day',
  '2026-05-27': 'Hari Raya Haji',
  '2026-06-01': 'Vesak Day (Observed Monday)',
  '2026-08-10': 'National Day (Observed Monday)',
  '2026-11-09': 'Deepavali (Observed Monday)',
  '2026-12-25': 'Christmas Day',
};

export function isSgBusinessDay(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  if (SG_PUBLIC_HOLIDAYS[dateStr]) return false;
  return true;
}

export function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffCalendarDays(startStr: string, endStr: string): number {
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function getNextSgBusinessDay(dateStr: string): string {
  let curr = addCalendarDays(dateStr, 1);
  while (!isSgBusinessDay(curr)) {
    curr = addCalendarDays(curr, 1);
  }
  return curr;
}

export function getPrevSgBusinessDay(dateStr: string): string {
  let curr = addCalendarDays(dateStr, -1);
  while (!isSgBusinessDay(curr)) {
    curr = addCalendarDays(curr, -1);
  }
  return curr;
}

export function shiftSgBusinessDays(dateStr: string, offsetBusinessDays: number): string {
  let curr = dateStr;
  if (!isSgBusinessDay(curr)) {
    curr = getPrevSgBusinessDay(curr);
  }
  const steps = Math.abs(offsetBusinessDays);
  const dir = offsetBusinessDays >= 0 ? 1 : -1;
  for (let i = 0; i < steps; i++) {
    curr = dir > 0 ? getNextSgBusinessDay(curr) : getPrevSgBusinessDay(curr);
  }
  return curr;
}

function buildDefaultMasSoraDataset(): MasSoraRecord[] {
  const startDate = '2025-07-01';
  const endDate = '2026-10-02';

  const businessDays: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    if (isSgBusinessDay(cursor)) {
      businessDays.push(cursor);
    }
    cursor = addCalendarDays(cursor, 1);
  }

  const rawRates: { date: string; sora: number; volume: number; nextBizDate: string; weightDays: number; holidayNote?: string }[] = [];

  for (let i = 0; i < businessDays.length; i++) {
    const dStr = businessDays[i];
    const nextBiz = i + 1 < businessDays.length ? businessDays[i + 1] : getNextSgBusinessDay(dStr);
    const weightDays = diffCalendarDays(dStr, nextBiz);

    let holidayFound: string | undefined;
    for (let step = 1; step < weightDays; step++) {
      const checkDate = addCalendarDays(dStr, step);
      if (SG_PUBLIC_HOLIDAYS[checkDate]) {
        holidayFound = SG_PUBLIC_HOLIDAYS[checkDate];
      }
    }

    const progress = i / businessDays.length;
    const macroBase = 3.16 - progress * 0.48;
    const dayNum = Number(dStr.slice(8, 10));
    const monthNum = Number(dStr.slice(5, 7));
    const isMonthEnd = dayNum >= 28 || dayNum === 1;
    const isQuarterEnd = isMonthEnd && (monthNum === 3 || monthNum === 6 || monthNum === 9 || monthNum === 12);

    const wave1 = Math.sin(i * 0.37) * 0.042;
    const wave2 = Math.cos(i * 0.19 + monthNum) * 0.031;
    const turnSpike = isQuarterEnd ? 0.115 : isMonthEnd ? 0.055 : 0;

    const sora = Number((macroBase + wave1 + wave2 + turnSpike).toFixed(4));
    const volume = Math.round(1850 + Math.sin(i * 0.53) * 420 + (isMonthEnd ? 640 : 0));

    rawRates.push({
      date: dStr,
      sora,
      volume,
      nextBizDate: nextBiz,
      weightDays,
      holidayNote: holidayFound,
    });
  }

  let currentIndex = 111.84251092;
  const indexByDate: Record<string, number> = {};
  const records: MasSoraRecord[] = [];

  for (let i = 0; i < rawRates.length; i++) {
    const item = rawRates[i];
    indexByDate[item.date] = Number(currentIndex.toFixed(8));

    const computeTrailingCompounded = (targetCalDays: number): number => {
      let backIdx = i;
      let calDays = 0;
      while (backIdx > 0 && calDays < targetCalDays) {
        backIdx--;
        calDays = diffCalendarDays(rawRates[backIdx].date, item.date);
      }
      if (calDays === 0) return item.sora;
      const startIdxVal = indexByDate[rawRates[backIdx].date];
      const endIdxVal = indexByDate[item.date];
      const rate = ((endIdxVal / startIdxVal - 1) * (365 / calDays)) * 100;
      return Number(rate.toFixed(4));
    };

    const comp1m = computeTrailingCompounded(30);
    const comp3m = computeTrailingCompounded(91);
    const comp6m = computeTrailingCompounded(182);

    records.push({
      end_of_day: item.date,
      sora: item.sora,
      sora_index: indexByDate[item.date],
      comp_sora_1m: comp1m,
      comp_sora_3m: comp3m,
      comp_sora_6m: comp6m,
      aggregate_volume_m: item.volume,
      publication_date: item.nextBizDate,
      holiday_note: item.holidayNote,
    });

    currentIndex = currentIndex * (1 + (item.sora / 100 * item.weightDays) / 365);
  }

  return records;
}

export const DEFAULT_MAS_SORA_RECORDS: MasSoraRecord[] = buildDefaultMasSoraDataset();

export function parseMasCsvOrJson(rawInput: string): { records: MasSoraRecord[]; error?: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { records: [], error: 'Input payload is empty.' };
  }

  try {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      const rawArray = Array.isArray(parsed)
        ? parsed
        : parsed?.result?.records || parsed?.records || [];

      if (!Array.isArray(rawArray) || rawArray.length === 0) {
        return { records: [], error: 'JSON does not contain a non-empty records array.' };
      }

      const normalized: MasSoraRecord[] = rawArray
        .map((row: Record<string, unknown>) => {
          const end_of_day = String(row.end_of_day || row.date || '').slice(0, 10);
          const sora = Number(row.sora ?? row.rate ?? NaN);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(end_of_day) || Number.isNaN(sora)) {
            return null;
          }
          return {
            end_of_day,
            sora: Number(sora.toFixed(4)),
            sora_index: Number(row.sora_index ?? 112.0),
            comp_sora_1m: Number(row.comp_sora_1m ?? sora),
            comp_sora_3m: Number(row.comp_sora_3m ?? sora),
            comp_sora_6m: Number(row.comp_sora_6m ?? sora),
            aggregate_volume_m: Number(row.aggregate_volume_m ?? row.aggregate_volume ?? 2100),
            publication_date: String(row.publication_date || getNextSgBusinessDay(end_of_day)),
          } as MasSoraRecord;
        })
        .filter((r): r is MasSoraRecord => r !== null)
        .sort((a, b) => a.end_of_day.localeCompare(b.end_of_day));

      if (normalized.length === 0) {
        return { records: [], error: 'No valid (end_of_day, sora) rows found in JSON.' };
      }
      return { records: normalized };
    }

    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { records: [], error: 'CSV must include a header row and at least one data row.' };
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('end_of_day'));
    const soraIdx = headers.findIndex((h) => h === 'sora' || h === 'daily_sora' || h === 'rate');
    const indexIdx = headers.findIndex((h) => h.includes('index'));
    const c1mIdx = headers.findIndex((h) => h.includes('1m'));
    const c3mIdx = headers.findIndex((h) => h.includes('3m'));
    const c6mIdx = headers.findIndex((h) => h.includes('6m'));
    const volIdx = headers.findIndex((h) => h.includes('vol'));

    if (dateIdx === -1 || soraIdx === -1) {
      return {
        records: [],
        error: 'CSV header must contain at least "end_of_day" (or "date") and "sora" columns.',
      };
    }

    const normalized: MasSoraRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const end_of_day = (cols[dateIdx] || '').slice(0, 10);
      const sora = parseFloat(cols[soraIdx]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end_of_day) || Number.isNaN(sora)) continue;

      normalized.push({
        end_of_day,
        sora: Number(sora.toFixed(4)),
        sora_index: indexIdx !== -1 && !Number.isNaN(parseFloat(cols[indexIdx])) ? parseFloat(cols[indexIdx]) : 112.5,
        comp_sora_1m: c1mIdx !== -1 && !Number.isNaN(parseFloat(cols[c1mIdx])) ? parseFloat(cols[c1mIdx]) : sora,
        comp_sora_3m: c3mIdx !== -1 && !Number.isNaN(parseFloat(cols[c3mIdx])) ? parseFloat(cols[c3mIdx]) : sora,
        comp_sora_6m: c6mIdx !== -1 && !Number.isNaN(parseFloat(cols[c6mIdx])) ? parseFloat(cols[c6mIdx]) : sora,
        aggregate_volume_m: volIdx !== -1 && !Number.isNaN(parseFloat(cols[volIdx])) ? parseFloat(cols[volIdx]) : 2100,
        publication_date: getNextSgBusinessDay(end_of_day),
      });
    }

    normalized.sort((a, b) => a.end_of_day.localeCompare(b.end_of_day));
    if (normalized.length === 0) {
      return { records: [], error: 'No valid SORA rows could be parsed from the CSV.' };
    }
    return { records: normalized };
  } catch (err) {
    return {
      records: [],
      error: err instanceof Error ? err.message : 'Failed to parse input data.',
    };
  }
}
