import React, { useMemo, useState } from 'react';
import {
  AdvanceTenor,
  CalculationMode,
  DayCountBasis,
  LoanCalculationParams,
  MasSoraRecord,
  ObservationConvention,
  SavedScenario,
} from './types/sora';
import { DEFAULT_MAS_SORA_RECORDS } from './data/masSoraData';
import { calculateSoraInterest, formatRate, formatSgd } from './utils/soraCalculator';
import { SoraRateChart } from './components/SoraRateChart';
import { LoanSensitivityPanel } from './components/LoanSensitivityPanel';
import { MasDataFeedPanel } from './components/MasDataFeedPanel';
import { BookmarkPlus, Download, Search, Trash2 } from 'lucide-react';

type ActiveSection = 'workbench' | 'ledger' | 'amortization' | 'mas_feed';

interface FacilityPreset {
  id: string;
  name: string;
  subtitle: string;
  params: Partial<LoanCalculationParams>;
}

const FACILITY_PRESETS: FacilityPreset[] = [
  {
    id: 'corp_rcf',
    name: 'Corporate Revolving Credit',
    subtitle: 'S$5,000,000 · 5D Lookback Shift · +1.25% Margin',
    params: {
      principal: 5000000,
      startDate: '2026-07-02',
      endDate: '2026-10-02',
      mode: 'compounded_in_arrears',
      convention: 'observation_shift',
      lookbackDays: 5,
      lockoutDays: 0,
      marginPercent: 1.25,
      dailyFloorPercent: 0,
      dayCountBasis: 365,
      roundingDecimals: 4,
    },
  },
  {
    id: 'sg_mortgage',
    name: 'Private / HDB Home Loan',
    subtitle: 'S$850,000 · 3M Compounded SORA in Advance · +0.70% Spread',
    params: {
      principal: 850000,
      startDate: '2026-09-02',
      endDate: '2026-10-02',
      mode: 'compounded_in_advance',
      advanceTenor: '3m',
      convention: 'observation_shift',
      lookbackDays: 2,
      lockoutDays: 0,
      marginPercent: 0.7,
      dailyFloorPercent: 0,
      dayCountBasis: 365,
      roundingDecimals: 4,
      loanTenureYears: 25,
    },
  },
  {
    id: 'sme_term',
    name: 'SME Working Capital Facility',
    subtitle: 'S$1,200,000 · 1M Compounded SORA in Advance · +1.15% Spread',
    params: {
      principal: 1200000,
      startDate: '2026-09-02',
      endDate: '2026-10-02',
      mode: 'compounded_in_advance',
      advanceTenor: '1m',
      convention: 'observation_shift',
      lookbackDays: 2,
      lockoutDays: 0,
      marginPercent: 1.15,
      dailyFloorPercent: 0,
      dayCountBasis: 365,
      roundingDecimals: 4,
      loanTenureYears: 10,
    },
  },
  {
    id: 'syndicated_index',
    name: 'Syndicated Project Loan (SORA Index)',
    subtitle: 'S$25,000,000 · MAS SORA Index Ratio · +0.95% Margin',
    params: {
      principal: 25000000,
      startDate: '2026-04-02',
      endDate: '2026-10-02',
      mode: 'sora_index',
      convention: 'observation_shift',
      lookbackDays: 5,
      lockoutDays: 0,
      marginPercent: 0.95,
      dailyFloorPercent: 0,
      dayCountBasis: 365,
      roundingDecimals: 4,
    },
  },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('workbench');
  const [masRecords, setMasRecords] = useState<MasSoraRecord[]>(DEFAULT_MAS_SORA_RECORDS);
  const [activePresetId, setActivePresetId] = useState<string>('corp_rcf');
  const [ledgerFilter, setLedgerFilter] = useState<string>('');
  const [onlyMultiDayWeights, setOnlyMultiDayWeights] = useState<boolean>(false);

  const [params, setParams] = useState<LoanCalculationParams>({
    principal: 5000000,
    startDate: '2026-07-02',
    endDate: '2026-10-02',
    mode: 'compounded_in_arrears',
    convention: 'observation_shift',
    lookbackDays: 5,
    lockoutDays: 0,
    marginPercent: 1.25,
    dailyFloorPercent: 0,
    dayCountBasis: 365,
    roundingDecimals: 4,
    advanceTenor: '3m',
    loanTenureYears: 25,
  });

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([
    {
      id: 'initial-1',
      label: 'Q3 2026 Corporate RCF Drawdown',
      facilityType: 'Compounded in Arrears (5D Shift)',
      principal: 5000000,
      startDate: '2026-07-02',
      endDate: '2026-10-02',
      mode: 'compounded_in_arrears',
      lookbackDays: 5,
      marginPercent: 1.25,
      compoundedSoraRate: 2.7241,
      allInRate: 3.9741,
      totalInterestSgd: 50084.55,
      totalCalendarDays: 92,
    },
  ]);

  const latestMasRecord = masRecords[masRecords.length - 1];

  const calculationResult = useMemo(
    () => calculateSoraInterest(params, masRecords),
    [params, masRecords]
  );

  const filteredSchedule = useMemo(() => {
    return calculationResult.schedule.filter((row) => {
      if (onlyMultiDayWeights && row.weightingDays <= 1) return false;
      if (!ledgerFilter.trim()) return true;
      const q = ledgerFilter.trim().toLowerCase();
      return (
        row.interestDate.includes(q) ||
        row.observationDate.includes(q) ||
        row.rawSoraRate.toFixed(4).includes(q) ||
        (row.holidayNote && row.holidayNote.toLowerCase().includes(q))
      );
    });
  }, [calculationResult.schedule, ledgerFilter, onlyMultiDayWeights]);

  const applyPreset = (preset: FacilityPreset) => {
    setActivePresetId(preset.id);
    setParams((prev) => ({
      ...prev,
      ...preset.params,
    }));
  };

  const handleQuickDateSpan = (months: 1 | 3 | 6) => {
    const end = latestMasRecord ? latestMasRecord.end_of_day : '2026-10-02';
    const [y, m, d] = end.split('-').map(Number);
    const startDt = new Date(Date.UTC(y, m - 1 - months, d));
    const startStr = startDt.toISOString().slice(0, 10);
    setParams((prev) => ({
      ...prev,
      startDate: startStr,
      endDate: end,
    }));
  };

  const handleSaveTranche = () => {
    const modeLabel =
      params.mode === 'compounded_in_arrears'
        ? `Compounded in Arrears (${params.lookbackDays}D)`
        : params.mode === 'sora_index'
        ? `MAS SORA Index (${params.lookbackDays}D)`
        : `${params.advanceTenor.toUpperCase()} SORA in Advance`;

    const newEntry: SavedScenario = {
      id: `tranche-${Date.now()}`,
      label: `Tranche #${savedScenarios.length + 1} (${params.startDate} to ${params.endDate})`,
      facilityType: modeLabel,
      principal: params.principal,
      startDate: params.startDate,
      endDate: params.endDate,
      mode: params.mode,
      lookbackDays: params.lookbackDays,
      marginPercent: params.marginPercent,
      compoundedSoraRate: calculationResult.compoundedSoraRate,
      allInRate: calculationResult.allInRate,
      totalInterestSgd: calculationResult.totalInterestSgd,
      totalCalendarDays: calculationResult.totalCalendarDays,
    };
    setSavedScenarios((prev) => [newEntry, ...prev]);
  };

  const handleExportPaymentNoticeCsv = () => {
    const metaRows = [
      ['SORA Calc SG — Singapore Interest Payment Calculation Notice'],
      ['Reference Standard', 'MAS Domestic Interest Rates / SC-STS SORA Convention'],
      ['Principal Amount (SGD)', params.principal.toFixed(2)],
      ['Interest Period Start', calculationResult.startDate],
      ['Interest Period End', calculationResult.endDate],
      ['Observation Period Start', calculationResult.observationStartDate],
      ['Observation Period End', calculationResult.observationEndDate],
      ['Calculation Mode', params.mode],
      ['Day Count Convention', `ACT/${params.dayCountBasis} (Fixed)`],
      ['Total Calendar Days (d)', String(calculationResult.totalCalendarDays)],
      ['Singapore Business Days (d_0)', String(calculationResult.businessDaysCount)],
      [
        'Compounded SORA Rate (% p.a.)',
        calculationResult.compoundedSoraRate.toFixed(params.roundingDecimals),
      ],
      ['Customer Margin (% p.a.)', params.marginPercent.toFixed(params.roundingDecimals)],
      ['All-In Effective Rate (% p.a.)', calculationResult.allInRate.toFixed(params.roundingDecimals)],
      ['Base SORA Interest (SGD)', calculationResult.baseSoraInterestSgd.toFixed(2)],
      ['Margin Interest (SGD)', calculationResult.marginInterestSgd.toFixed(2)],
      ['Total Interest Payment Due (SGD)', calculationResult.totalInterestSgd.toFixed(2)],
      [],
      [
        'Business_Day_No',
        'Interest_Date',
        'Observation_Date',
        'MAS_Overnight_SORA_Pct',
        'Floored_SORA_Pct',
        'Weighting_Days_ni',
        'Daily_Factor',
        'Cumulative_Compounded_Factor',
        'Annualized_Compounded_SORA_Pct',
        'All_In_Rate_Pct',
        'Daily_Interest_SGD',
        'Cumulative_Interest_SGD',
        'Holiday_or_Lockout_Note',
      ],
    ];

    const dataRows = calculationResult.schedule.map((row) => [
      String(row.dayIndex),
      row.interestDate,
      row.observationDate,
      row.rawSoraRate.toFixed(4),
      row.flooredSoraRate.toFixed(4),
      String(row.weightingDays),
      row.dailyCompoundingFactor.toFixed(8),
      row.cumulativeCompoundedFactor.toFixed(8),
      row.annualizedCompoundedSoraToDate.toFixed(params.roundingDecimals),
      row.allInRateToDate.toFixed(params.roundingDecimals),
      row.dailyInterestSgd.toFixed(2),
      row.cumulativeInterestSgd.toFixed(2),
      row.isLockoutApplied
        ? 'Lockout Frozen'
        : row.holidayNote
        ? row.holidayNote
        : 'Standard',
    ]);

    const csvContent = [...metaRows, ...dataRows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SORA_Payment_Schedule_${calculationResult.startDate}_to_${calculationResult.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOverrideSingleRate = (dateStr: string, newRate: number) => {
    setMasRecords((prev) =>
      prev.map((r) => (r.end_of_day === dateStr ? { ...r, sora: newRate } : r))
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 h-15 flex items-center justify-between gap-6">
          <a
            href="#workbench"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('workbench');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap"
          >
            SORA Calc SG
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveSection('workbench')}
              className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
                activeSection === 'workbench'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Calculator
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('ledger')}
              className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
                activeSection === 'ledger'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Daily Ledger
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('amortization')}
              className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
                activeSection === 'amortization'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Amortization
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('mas_feed')}
              className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
                activeSection === 'mas_feed'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              MAS Data Feed
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSaveTranche}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Save Tranche</span>
            </button>
            <button
              type="button"
              onClick={handleExportPaymentNoticeCsv}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Notice CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 space-y-8">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Singapore Overnight Rate Average (SORA) Interest Calculator
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Monetary Authority of Singapore (MAS) Benchmark Conventions</span>
                <span aria-hidden="true">·</span>
                <span>SC-STS Compounded in Arrears & Advance</span>
                <span aria-hidden="true">·</span>
                <span>Day Count: Actual/{params.dayCountBasis} (Fixed)</span>
              </div>
            </div>

            {latestMasRecord && (
              <div className="text-right text-xs text-slate-500">
                <span>Latest Value Date: </span>
                <strong className="font-mono tabular-nums text-slate-900">
                  {latestMasRecord.end_of_day}
                </strong>
                <span aria-hidden="true"> · </span>
                <span>Published 09:00 SGT ({latestMasRecord.publication_date})</span>
              </div>
            )}
          </div>

          {latestMasRecord && (
            <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              <div className="pt-2 sm:pt-0 sm:px-3 first:pl-0">
                <div className="text-xs text-slate-500">Daily Overnight SORA</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
                  {latestMasRecord.sora.toFixed(4)}%
                </div>
                <div className="text-[11px] text-slate-400">Volume: S${latestMasRecord.aggregate_volume_m.toLocaleString('en-SG')}M</div>
              </div>

              <div className="pt-2 sm:pt-0 sm:px-3">
                <div className="text-xs text-slate-500">MAS SORA Index</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
                  {latestMasRecord.sora_index.toFixed(8)}
                </div>
                <div className="text-[11px] text-slate-400">Base 100.00 on 2020-08-03</div>
              </div>

              <div className="pt-2 sm:pt-0 sm:px-3">
                <div className="text-xs text-slate-500">1-Month Compounded</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-teal-700">
                  {latestMasRecord.comp_sora_1m.toFixed(4)}%
                </div>
                <div className="text-[11px] text-slate-400">30-Day Backward Window</div>
              </div>

              <div className="pt-2 sm:pt-0 sm:px-3">
                <div className="text-xs text-slate-500">3-Month Compounded</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-amber-700">
                  {latestMasRecord.comp_sora_3m.toFixed(4)}%
                </div>
                <div className="text-[11px] text-slate-400">91-Day Backward Window</div>
              </div>

              <div className="pt-2 sm:pt-0 sm:px-3">
                <div className="text-xs text-slate-500">6-Month Compounded</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
                  {latestMasRecord.comp_sora_6m.toFixed(4)}%
                </div>
                <div className="text-[11px] text-slate-400">182-Day Backward Window</div>
              </div>

              <div className="pt-2 sm:pt-0 sm:px-3">
                <div className="text-xs text-slate-500">Active Period All-In Rate</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
                  {calculationResult.allInRate.toFixed(params.roundingDecimals)}%
                </div>
                <div className="text-[11px] text-slate-400">
                  SORA {calculationResult.compoundedSoraRate.toFixed(4)}% + {params.marginPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="flex md:hidden items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          {(
            [
              ['workbench', 'Calculator'],
              ['ledger', 'Daily Ledger'],
              ['amortization', 'Amortization'],
              ['mas_feed', 'MAS Data Feed'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeSection === id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeSection === 'workbench' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-slate-600">
                Singapore Facility Presets:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {FACILITY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                      activePresetId === preset.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    01. Facility & Compounding Parameters
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure loan principal, interest dates, and MAS SORA observation conventions.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    SORA Calculation Methodology
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        ['compounded_in_arrears', 'In Arrears (Daily)'],
                        ['sora_index', 'MAS SORA Index'],
                        ['compounded_in_advance', 'In Advance (1M/3M)'],
                      ] as [CalculationMode, string][]
                    ).map(([modeKey, label]) => (
                      <button
                        key={modeKey}
                        type="button"
                        onClick={() => {
                          setActivePresetId('custom');
                          setParams((prev) => ({ ...prev, mode: modeKey }));
                        }}
                        className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                          params.mode === modeKey
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {params.mode === 'compounded_in_advance' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Published MAS Compounded Benchmark Tenor
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                      {(
                        [
                          ['1m', '1-Month SORA'],
                          ['3m', '3-Month SORA'],
                          ['6m', '6-Month SORA'],
                        ] as [AdvanceTenor, string][]
                      ).map(([tKey, label]) => (
                        <button
                          key={tKey}
                          type="button"
                          onClick={() =>
                            setParams((prev) => ({ ...prev, advanceTenor: tKey }))
                          }
                          className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            params.advanceTenor === tKey
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      Principal / Drawdown Amount (SGD)
                    </label>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {formatSgd(params.principal, 0)}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                      S$
                    </span>
                    <input
                      type="number"
                      min={1000}
                      step={50000}
                      value={params.principal}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setActivePresetId('custom');
                        setParams((prev) => ({ ...prev, principal: val }));
                      }}
                      className="w-full pl-9 pr-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {[500000, 850000, 1000000, 5000000, 10000000, 25000000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setActivePresetId('custom');
                          setParams((prev) => ({ ...prev, principal: amt }));
                        }}
                        className={`px-2.5 py-1 text-[11px] font-mono tabular-nums rounded border transition-colors whitespace-nowrap ${
                          params.principal === amt
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {amt >= 1000000 ? `S$${amt / 1000000}M` : `S$${amt / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      Interest Accrual Period
                    </label>
                    <div className="flex items-center gap-1.5">
                      {([1, 3, 6] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleQuickDateSpan(m)}
                          className="px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
                        >
                          Last {m}M
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">Start Date</span>
                      <input
                        type="date"
                        min="2025-07-15"
                        max="2026-10-01"
                        value={params.startDate}
                        onChange={(e) => {
                          setActivePresetId('custom');
                          setParams((prev) => ({ ...prev, startDate: e.target.value }));
                        }}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-500 mb-1">End Date</span>
                      <input
                        type="date"
                        min={params.startDate}
                        max="2026-10-02"
                        value={params.endDate}
                        onChange={(e) => {
                          setActivePresetId('custom');
                          setParams((prev) => ({ ...prev, endDate: e.target.value }));
                        }}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Customer Margin (% p.a.)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="15"
                        value={params.marginPercent}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setParams((prev) => ({ ...prev, marginPercent: val }));
                        }}
                        className="w-full pl-3 pr-14 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400">
                        {Math.round(params.marginPercent * 100)} bps
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Daily SORA Floor (% p.a.)
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                      <button
                        type="button"
                        onClick={() =>
                          setParams((prev) => ({ ...prev, dailyFloorPercent: 0 }))
                        }
                        className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                          params.dailyFloorPercent === 0
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        0.00% Floor
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setParams((prev) => ({ ...prev, dailyFloorPercent: null }))
                        }
                        className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                          params.dailyFloorPercent === null
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Unfloored
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">
                      Observation Convention (SC-STS)
                    </span>
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                      {(
                        [
                          ['observation_shift', 'Observation Shift'],
                          ['lookback_no_shift', 'Lookback Lag'],
                        ] as [ObservationConvention, string][]
                      ).map(([cKey, label]) => (
                        <button
                          key={cKey}
                          type="button"
                          onClick={() =>
                            setParams((prev) => ({ ...prev, convention: cKey }))
                          }
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                            params.convention === cKey
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-xs font-medium text-slate-700 mb-1.5">
                        Lookback Shift (SG Biz Days)
                      </span>
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                        {[0, 2, 3, 5, 10].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() =>
                              setParams((prev) => ({ ...prev, lookbackDays: d }))
                            }
                            className={`flex-1 py-1 text-xs font-mono tabular-nums font-medium rounded transition-colors ${
                              params.lookbackDays === d
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {d}D
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-slate-700 mb-1.5">
                        Lockout Freeze (Biz Days)
                      </span>
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                        {[0, 2, 5].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() =>
                              setParams((prev) => ({ ...prev, lockoutDays: d }))
                            }
                            className={`flex-1 py-1 text-xs font-mono tabular-nums font-medium rounded transition-colors ${
                              params.lockoutDays === d
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {d === 0 ? 'None' : `${d}D`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-xs font-medium text-slate-700 mb-1.5">
                        Day Count Fraction
                      </span>
                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
                        {([365, 360] as DayCountBasis[]).map((basis) => (
                          <button
                            key={basis}
                            type="button"
                            onClick={() =>
                              setParams((prev) => ({ ...prev, dayCountBasis: basis }))
                            }
                            className={`py-1 text-xs font-mono tabular-nums font-medium rounded transition-colors whitespace-nowrap ${
                              params.dayCountBasis === basis
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ACT/{basis}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-slate-700 mb-1.5">
                        Rate Rounding Precision
                      </span>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                        {([4, 5, 6] as const).map((dec) => (
                          <button
                            key={dec}
                            type="button"
                            onClick={() =>
                              setParams((prev) => ({ ...prev, roundingDecimals: dec }))
                            }
                            className={`py-1 text-xs font-mono tabular-nums font-medium rounded transition-colors whitespace-nowrap ${
                              params.roundingDecimals === dec
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {dec} d.p.
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>02. Interest Payment Settlement Notice</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Observation Window: {calculationResult.observationStartDate} to{' '}
                          {calculationResult.observationEndDate}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-3">
                        <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight text-slate-900">
                          {formatSgd(calculationResult.totalInterestSgd)}
                        </span>
                        <span className="text-xs text-slate-500">
                          Total Interest Payable ({calculationResult.totalCalendarDays} calendar days)
                        </span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-500">All-In Effective Rate</div>
                      <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-teal-700">
                        {formatRate(calculationResult.allInRate, params.roundingDecimals)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        Daily avg: {formatSgd(calculationResult.dailyAverageInterestSgd)} / day
                      </div>
                    </div>
                  </div>

                  <div className="py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-100">
                    <div>
                      <div className="text-xs text-slate-500">Compounded SORA</div>
                      <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
                        {formatRate(calculationResult.compoundedSoraRate, params.roundingDecimals)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        Unrounded: {calculationResult.unroundedCompoundedSoraRate.toFixed(6)}%
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Base SORA Interest</div>
                      <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
                        {formatSgd(calculationResult.baseSoraInterestSgd)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {(
                          (calculationResult.baseSoraInterestSgd /
                            Math.max(1, calculationResult.totalInterestSgd)) *
                          100
                        ).toFixed(1)}
                        % of total interest
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Margin Interest (+{params.marginPercent.toFixed(2)}%)</div>
                      <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
                        {formatSgd(calculationResult.marginInterestSgd)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {Math.round(params.marginPercent * 100)} bps credit spread
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">MAS SORA Index Cross-Check</div>
                      <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900">
                        {formatRate(calculationResult.soraIndexDerivedRate, params.roundingDecimals)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        {calculationResult.startSoraIndex.toFixed(4)} → {calculationResult.endSoraIndex.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                    <div className="font-mono tabular-nums text-[11px] text-slate-700 bg-slate-50 px-3 py-2 rounded border border-slate-200/80">
                      Compounded SORA = [ ∏ (1 + SORA_i × n_i / {params.dayCountBasis}) − 1 ] × ({params.dayCountBasis} / {calculationResult.totalCalendarDays}) ={' '}
                      <strong>{calculationResult.compoundedSoraRate.toFixed(params.roundingDecimals)}%</strong>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
                      <span>d_0 = {calculationResult.businessDaysCount} SG biz days</span>
                      <span aria-hidden="true">·</span>
                      <span>d = {calculationResult.totalCalendarDays} cal days</span>
                    </div>
                  </div>
                </div>

                <SoraRateChart
                  records={masRecords}
                  observationStartDate={calculationResult.observationStartDate}
                  observationEndDate={calculationResult.observationEndDate}
                />
              </div>
            </div>

            {savedScenarios.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Saved Facility Tranches & Scenario Comparison
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Compare interest accruals across multiple drawdowns, tenors, or lookback conventions
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    Total Saved Interest:{' '}
                    <strong className="text-slate-900">
                      {formatSgd(
                        savedScenarios.reduce((acc, s) => acc + s.totalInterestSgd, 0)
                      )}
                    </strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="py-2.5 px-4">Tranche Label</th>
                        <th className="py-2.5 px-4">Convention</th>
                        <th className="py-2.5 px-4">Interest Period</th>
                        <th className="py-2.5 px-4 text-right">Principal (SGD)</th>
                        <th className="py-2.5 px-4 text-right">Days (d)</th>
                        <th className="py-2.5 px-4 text-right">Comp. SORA</th>
                        <th className="py-2.5 px-4 text-right">Margin</th>
                        <th className="py-2.5 px-4 text-right">All-In Rate</th>
                        <th className="py-2.5 px-4 text-right">Interest Payable</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {savedScenarios.map((sc) => (
                        <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-slate-900">{sc.label}</td>
                          <td className="py-2.5 px-4 text-slate-600">{sc.facilityType}</td>
                          <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                            {sc.startDate} → {sc.endDate}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                            {formatSgd(sc.principal, 0)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                            {sc.totalCalendarDays}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatRate(sc.compoundedSoraRate)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                            +{sc.marginPercent.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                            {formatRate(sc.allInRate)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatSgd(sc.totalInterestSgd)}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSavedScenarios((prev) => prev.filter((item) => item.id !== sc.id))
                              }
                              className="text-slate-400 hover:text-red-600 transition-colors p-1"
                              title="Remove saved tranche"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {(activeSection === 'workbench' || activeSection === 'ledger') && (
          <section className="bg-white border border-slate-200 rounded-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  03. Daily SORA Compounding & Accrual Ledger ({calculationResult.businessDaysCount} Singapore Business Days)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Day-by-day audit trail showing shifted MAS observation dates, weekend/holiday day weights (n_i), and compounded factors
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOnlyMultiDayWeights((v) => !v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                    onlyMultiDayWeights
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Weekends & SG Holidays Only (n_i &gt; 1)
                </button>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ledgerFilter}
                    onChange={(e) => setLedgerFilter(e.target.value)}
                    placeholder="Search date, rate, or holiday..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-900 w-56"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 text-right">Day (i)</th>
                    <th className="py-2.5 px-3">Interest Date</th>
                    <th className="py-2.5 px-3">Observation Date</th>
                    <th className="py-2.5 px-3 text-right">MAS SORA_i</th>
                    <th className="py-2.5 px-3 text-right">Weight (n_i)</th>
                    <th className="py-2.5 px-3 text-right">Daily Factor</th>
                    <th className="py-2.5 px-3 text-right">Cumulative Factor</th>
                    <th className="py-2.5 px-3 text-right">Comp. SORA to Date</th>
                    <th className="py-2.5 px-3 text-right">All-In Rate</th>
                    <th className="py-2.5 px-3 text-right">Daily Interest (S$)</th>
                    <th className="py-2.5 px-3 text-right">Accrued Balance (S$)</th>
                    <th className="py-2.5 px-3">SG Calendar Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSchedule.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-500">
                        No daily accrual rows match your current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSchedule.map((row) => (
                      <tr
                        key={row.dayIndex}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          row.holidayNote ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-400">
                          {row.dayIndex}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums font-medium text-slate-900">
                          {row.interestDate}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-600">
                          {row.observationDate}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                          {row.flooredSoraRate.toFixed(4)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {row.weightingDays}d
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                          {row.dailyCompoundingFactor.toFixed(7)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {row.cumulativeCompoundedFactor.toFixed(7)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-teal-700 font-medium">
                          {row.annualizedCompoundedSoraToDate.toFixed(params.roundingDecimals)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                          {row.allInRateToDate.toFixed(params.roundingDecimals)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatSgd(row.dailyInterestSgd)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatSgd(row.cumulativeInterestSgd)}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {row.isLockoutApplied
                            ? 'Lockout Rate Frozen'
                            : row.holidayNote
                            ? `SG Holiday: ${row.holidayNote}`
                            : row.weightingDays >= 3
                            ? 'Weekend Accrual (Fri–Sun)'
                            : 'Overnight (1d)'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === 'amortization' && (
          <LoanSensitivityPanel
            params={params}
            result={calculationResult}
            onChangeTenureYears={(years) =>
              setParams((prev) => ({ ...prev, loanTenureYears: years }))
            }
          />
        )}

        {activeSection === 'mas_feed' && (
          <MasDataFeedPanel
            records={masRecords}
            onUpdateRecords={setMasRecords}
            onResetDefaultRecords={() => setMasRecords(DEFAULT_MAS_SORA_RECORDS)}
            onOverrideSingleRate={handleOverrideSingleRate}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            SORA Calc SG · Aligned with ABS-SFEMC / SC-STS Singapore Overnight Rate Average Conventions (Actual/365 Fixed)
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('mas_feed')}
              className="hover:text-slate-900 transition-colors"
            >
              MAS CSV / JSON Importer
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleExportPaymentNoticeCsv}
              className="hover:text-slate-900 transition-colors"
            >
              Download Audit Schedule
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
