export type CalculationMode = 'compounded_in_arrears' | 'compounded_in_advance' | 'sora_index';

export type ObservationConvention = 'observation_shift' | 'lookback_no_shift';

export type AdvanceTenor = '1m' | '3m' | '6m';

export type DayCountBasis = 365 | 360;

export interface MasSoraRecord {
  /** YYYY-MM-DD (Value date of the overnight transaction, published at 9:00 AM next SG business day) */
  end_of_day: string;
  /** Daily SORA (% p.a., 4 decimal places) */
  sora: number;
  /** MAS SORA Index (base 100 on 2020-08-03, 8 decimal places) */
  sora_index: number;
  /** 1-Month Compounded SORA (% p.a., 4 decimal places) */
  comp_sora_1m: number;
  /** 3-Month Compounded SORA (% p.a., 4 decimal places) */
  comp_sora_3m: number;
  /** 6-Month Compounded SORA (% p.a., 4 decimal places) */
  comp_sora_6m: number;
  /** Aggregate volume in SGD millions */
  aggregate_volume_m: number;
  /** Publication date (9:00 AM SGT on next business day) */
  publication_date: string;
  /** Optional note if followed by weekend or Singapore public holiday */
  holiday_note?: string;
}

export interface LoanCalculationParams {
  principal: number;
  startDate: string;
  endDate: string;
  mode: CalculationMode;
  convention: ObservationConvention;
  lookbackDays: number;
  lockoutDays: number;
  marginPercent: number;
  dailyFloorPercent: number | null;
  dayCountBasis: DayCountBasis;
  roundingDecimals: 4 | 5 | 6;
  advanceTenor: AdvanceTenor;
  loanTenureYears: number;
}

export interface DailyAccrualRow {
  dayIndex: number;
  interestDate: string;
  observationDate: string;
  rawSoraRate: number;
  flooredSoraRate: number;
  weightingDays: number; // n_i
  dailyCompoundingFactor: number;
  cumulativeCompoundedFactor: number;
  annualizedCompoundedSoraToDate: number;
  allInRateToDate: number;
  dailyInterestSgd: number;
  cumulativeInterestSgd: number;
  isLockoutApplied: boolean;
  holidayNote?: string;
}

export interface SoraCalculationResult {
  principal: number;
  startDate: string;
  endDate: string;
  observationStartDate: string;
  observationEndDate: string;
  totalCalendarDays: number; // d
  businessDaysCount: number; // d_0
  compoundedSoraRate: number; // % p.a. rounded to roundingDecimals
  unroundedCompoundedSoraRate: number;
  soraIndexDerivedRate: number; // % p.a. derived via MAS SORA Index start/end
  startSoraIndex: number;
  endSoraIndex: number;
  marginPercent: number;
  allInRate: number; // % p.a.
  baseSoraInterestSgd: number;
  marginInterestSgd: number;
  totalInterestSgd: number;
  dailyAverageInterestSgd: number;
  monthlyEquivalentInstalmentSgd: number;
  totalTenureInterestSgd: number;
  schedule: DailyAccrualRow[];
}

export interface SavedScenario {
  id: string;
  label: string;
  facilityType: string;
  principal: number;
  startDate: string;
  endDate: string;
  mode: CalculationMode;
  lookbackDays: number;
  marginPercent: number;
  compoundedSoraRate: number;
  allInRate: number;
  totalInterestSgd: number;
  totalCalendarDays: number;
}
