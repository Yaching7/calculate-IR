import {
  DailyAccrualRow,
  LoanCalculationParams,
  MasSoraRecord,
  SoraCalculationResult,
} from '../types/sora';
import {
  addCalendarDays,
  diffCalendarDays,
  isSgBusinessDay,
  SG_PUBLIC_HOLIDAYS,
  shiftSgBusinessDays,
} from '../data/masSoraData';

export function findMasRecordOnOrBefore(
  dateStr: string,
  recordsMap: Map<string, MasSoraRecord>,
  sortedRecords: MasSoraRecord[]
): MasSoraRecord {
  const exact = recordsMap.get(dateStr);
  if (exact) return exact;

  for (let i = sortedRecords.length - 1; i >= 0; i--) {
    if (sortedRecords[i].end_of_day <= dateStr) {
      return sortedRecords[i];
    }
  }
  return sortedRecords[0];
}

export function calculateSoraInterest(
  params: LoanCalculationParams,
  records: MasSoraRecord[]
): SoraCalculationResult {
  const sortedRecords = [...records].sort((a, b) => a.end_of_day.localeCompare(b.end_of_day));
  const recordsMap = new Map<string, MasSoraRecord>();
  for (const r of sortedRecords) {
    recordsMap.set(r.end_of_day, r);
  }

  const startStr = params.startDate <= params.endDate ? params.startDate : params.endDate;
  const endStr = params.endDate >= params.startDate ? params.endDate : addCalendarDays(startStr, 30);

  const totalInterestCalendarDays = Math.max(1, diffCalendarDays(startStr, endStr));

  const interestBizDays: string[] = [];
  let cursor = startStr;
  while (cursor < endStr) {
    if (isSgBusinessDay(cursor)) {
      interestBizDays.push(cursor);
    }
    cursor = addCalendarDays(cursor, 1);
  }

  if (interestBizDays.length === 0) {
    interestBizDays.push(shiftSgBusinessDays(startStr, 0));
  }

  const obsStartDate = shiftSgBusinessDays(startStr, -params.lookbackDays);
  const obsEndDate = shiftSgBusinessDays(endStr, -params.lookbackDays);
  const totalObsCalendarDays = Math.max(1, diffCalendarDays(obsStartDate, obsEndDate));

  const schedule: DailyAccrualRow[] = [];
  let cumulativeFactor = 1.0;
  let cumulativeCalendarDays = 0;
  let previousCumulativeInterestSgd = 0;

  const d0 = interestBizDays.length;
  const lockoutStartIdx = params.lockoutDays > 0 ? Math.max(0, d0 - params.lockoutDays) : d0;

  const resetRecord = findMasRecordOnOrBefore(obsStartDate, recordsMap, sortedRecords);
  const advancePublishedRate =
    params.advanceTenor === '1m'
      ? resetRecord.comp_sora_1m
      : params.advanceTenor === '3m'
      ? resetRecord.comp_sora_3m
      : resetRecord.comp_sora_6m;

  for (let i = 0; i < d0; i++) {
    const intDate = interestBizDays[i];
    const nextIntDate = i + 1 < d0 ? interestBizDays[i + 1] : endStr;
    const interestWeightDays = Math.max(1, diffCalendarDays(intDate, nextIntDate));

    const isLockoutApplied = i >= lockoutStartIdx;
    const effectiveBizIndex = isLockoutApplied ? Math.max(0, lockoutStartIdx - 1) : i;
    const lookupAnchorDate = interestBizDays[effectiveBizIndex];

    const obsDate = shiftSgBusinessDays(lookupAnchorDate, -params.lookbackDays);
    const nextObsDate =
      i + 1 < d0
        ? shiftSgBusinessDays(interestBizDays[i + 1], -params.lookbackDays)
        : obsEndDate;
    const obsWeightDays = Math.max(1, diffCalendarDays(obsDate, nextObsDate));

    const weightingDays =
      params.convention === 'observation_shift' ? obsWeightDays : interestWeightDays;

    const masRec = findMasRecordOnOrBefore(obsDate, recordsMap, sortedRecords);
    const rawSoraRate =
      params.mode === 'compounded_in_advance' ? advancePublishedRate : masRec.sora;

    const flooredSoraRate =
      params.dailyFloorPercent !== null
        ? Math.max(rawSoraRate, params.dailyFloorPercent)
        : rawSoraRate;

    let holidayNote: string | undefined;
    for (let step = 0; step < interestWeightDays; step++) {
      const checkDate = addCalendarDays(intDate, step);
      if (SG_PUBLIC_HOLIDAYS[checkDate]) {
        holidayNote = SG_PUBLIC_HOLIDAYS[checkDate];
      }
    }

    let dailyCompoundingFactor = 1.0;
    if (params.mode === 'compounded_in_advance') {
      dailyCompoundingFactor = 1 + (flooredSoraRate / 100 * weightingDays) / params.dayCountBasis;
      cumulativeCalendarDays += weightingDays;
      cumulativeFactor =
        1 + (flooredSoraRate / 100 * cumulativeCalendarDays) / params.dayCountBasis;
    } else {
      dailyCompoundingFactor = 1 + (flooredSoraRate / 100 * weightingDays) / params.dayCountBasis;
      cumulativeFactor = cumulativeFactor * dailyCompoundingFactor;
      cumulativeCalendarDays += weightingDays;
    }

    const annualizedCompoundedSoraToDate = Number(
      (((cumulativeFactor - 1) * (params.dayCountBasis / cumulativeCalendarDays)) * 100).toFixed(
        params.roundingDecimals
      )
    );

    const allInRateToDate = Number(
      (annualizedCompoundedSoraToDate + params.marginPercent).toFixed(params.roundingDecimals)
    );

    const cumulativeInterestSgd =
      params.principal *
      (allInRateToDate / 100) *
      (cumulativeCalendarDays / params.dayCountBasis);

    const dailyInterestSgd = Math.max(0, cumulativeInterestSgd - previousCumulativeInterestSgd);
    previousCumulativeInterestSgd = cumulativeInterestSgd;

    schedule.push({
      dayIndex: i + 1,
      interestDate: intDate,
      observationDate: obsDate,
      rawSoraRate,
      flooredSoraRate,
      weightingDays,
      dailyCompoundingFactor,
      cumulativeCompoundedFactor: cumulativeFactor,
      annualizedCompoundedSoraToDate,
      allInRateToDate,
      dailyInterestSgd,
      cumulativeInterestSgd,
      isLockoutApplied,
      holidayNote,
    });
  }

  const startIdxRec = findMasRecordOnOrBefore(obsStartDate, recordsMap, sortedRecords);
  const endIdxRec = findMasRecordOnOrBefore(obsEndDate, recordsMap, sortedRecords);
  const startSoraIndex = startIdxRec.sora_index;
  const endSoraIndex = endIdxRec.sora_index;

  const soraIndexDerivedRateUnrounded =
    endSoraIndex > startSoraIndex
      ? ((endSoraIndex / startSoraIndex - 1) * (params.dayCountBasis / totalObsCalendarDays)) * 100
      : startIdxRec.sora;

  const soraIndexDerivedRate = Number(
    soraIndexDerivedRateUnrounded.toFixed(params.roundingDecimals)
  );

  const denominatorDays =
    params.convention === 'observation_shift'
      ? Math.max(1, cumulativeCalendarDays)
      : totalInterestCalendarDays;

  const unroundedCompoundedSoraRate =
    params.mode === 'compounded_in_advance'
      ? advancePublishedRate
      : params.mode === 'sora_index'
      ? soraIndexDerivedRateUnrounded
      : ((cumulativeFactor - 1) * (params.dayCountBasis / denominatorDays)) * 100;

  const compoundedSoraRate = Number(
    unroundedCompoundedSoraRate.toFixed(params.roundingDecimals)
  );

  const allInRate = Number(
    (compoundedSoraRate + params.marginPercent).toFixed(params.roundingDecimals)
  );

  const effectiveDayCount =
    params.mode === 'sora_index' ? totalObsCalendarDays : denominatorDays;

  const baseSoraInterestSgd =
    params.principal * (compoundedSoraRate / 100) * (effectiveDayCount / params.dayCountBasis);

  const marginInterestSgd =
    params.principal * (params.marginPercent / 100) * (effectiveDayCount / params.dayCountBasis);

  const totalInterestSgd = baseSoraInterestSgd + marginInterestSgd;
  const dailyAverageInterestSgd = totalInterestSgd / effectiveDayCount;

  const totalMonths = Math.max(1, params.loanTenureYears * 12);
  const monthlyRate = allInRate / 100 / 12;
  const monthlyEquivalentInstalmentSgd =
    monthlyRate > 0
      ? (params.principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
        (Math.pow(1 + monthlyRate, totalMonths) - 1)
      : params.principal / totalMonths;

  const totalTenureInterestSgd = Math.max(
    0,
    monthlyEquivalentInstalmentSgd * totalMonths - params.principal
  );

  return {
    principal: params.principal,
    startDate: startStr,
    endDate: endStr,
    observationStartDate: obsStartDate,
    observationEndDate: obsEndDate,
    totalCalendarDays: effectiveDayCount,
    businessDaysCount: d0,
    compoundedSoraRate,
    unroundedCompoundedSoraRate,
    soraIndexDerivedRate,
    startSoraIndex,
    endSoraIndex,
    marginPercent: params.marginPercent,
    allInRate,
    baseSoraInterestSgd,
    marginInterestSgd,
    totalInterestSgd,
    dailyAverageInterestSgd,
    monthlyEquivalentInstalmentSgd,
    totalTenureInterestSgd,
    schedule,
  };
}

export function formatSgd(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatRate(rate: number, decimals = 4): string {
  return `${rate.toFixed(decimals)}%`;
}
