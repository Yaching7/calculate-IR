import React, { useMemo } from 'react';
import { LoanCalculationParams, SoraCalculationResult } from '../types/sora';
import { formatRate, formatSgd } from '../utils/soraCalculator';
import { Download } from 'lucide-react';

interface LoanSensitivityPanelProps {
  params: LoanCalculationParams;
  result: SoraCalculationResult;
  onChangeTenureYears: (years: number) => void;
}

const SHOCK_BPS = [-50, -25, 0, 25, 50, 100, 150];

export const LoanSensitivityPanel: React.FC<LoanSensitivityPanelProps> = ({
  params,
  result,
  onChangeTenureYears,
}) => {
  const sensitivityRows = useMemo(() => {
    return SHOCK_BPS.map((bps) => {
      const deltaPercent = bps / 100;
      const shockedSora = Math.max(0, result.compoundedSoraRate + deltaPercent);
      const shockedAllIn = shockedSora + params.marginPercent;

      const periodInterestSgd =
        params.principal *
        (shockedAllIn / 100) *
        (result.totalCalendarDays / params.dayCountBasis);

      const periodDeltaSgd = periodInterestSgd - result.totalInterestSgd;

      const totalMonths = Math.max(1, params.loanTenureYears * 12);
      const monthlyRate = shockedAllIn / 100 / 12;
      const monthlyInstalmentSgd =
        monthlyRate > 0
          ? (params.principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
            (Math.pow(1 + monthlyRate, totalMonths) - 1)
          : params.principal / totalMonths;

      const monthlyDeltaSgd = monthlyInstalmentSgd - result.monthlyEquivalentInstalmentSgd;

      return {
        bps,
        shockedSora,
        shockedAllIn,
        periodInterestSgd,
        periodDeltaSgd,
        monthlyInstalmentSgd,
        monthlyDeltaSgd,
      };
    });
  }, [params, result]);

  const annualSchedule = useMemo(() => {
    const years = Math.max(1, Math.min(35, params.loanTenureYears));
    const totalMonths = years * 12;
    const monthlyRate = result.allInRate / 100 / 12;
    const monthlyPayment = result.monthlyEquivalentInstalmentSgd;

    let balance = params.principal;
    const rows: {
      year: number;
      openingBalance: number;
      principalPaid: number;
      interestPaid: number;
      totalPayment: number;
      closingBalance: number;
    }[] = [];

    for (let y = 1; y <= years; y++) {
      const openingBalance = balance;
      let yearPrincipal = 0;
      let yearInterest = 0;

      for (let m = 1; m <= 12; m++) {
        const monthIdx = (y - 1) * 12 + m;
        if (monthIdx > totalMonths || balance <= 0) break;
        const interestForMonth = balance * monthlyRate;
        const principalForMonth = Math.min(balance, Math.max(0, monthlyPayment - interestForMonth));
        yearInterest += interestForMonth;
        yearPrincipal += principalForMonth;
        balance = Math.max(0, balance - principalForMonth);
      }

      rows.push({
        year: y,
        openingBalance,
        principalPaid: yearPrincipal,
        interestPaid: yearInterest,
        totalPayment: yearPrincipal + yearInterest,
        closingBalance: balance,
      });
    }

    return rows;
  }, [params.principal, params.loanTenureYears, result.allInRate, result.monthlyEquivalentInstalmentSgd]);

  const handleExportAmortizationCsv = () => {
    const header =
      'Year,Opening_Balance_SGD,Annual_Principal_SGD,Annual_SORA_Interest_SGD,Total_Annual_Payment_SGD,Closing_Balance_SGD';
    const lines = annualSchedule.map(
      (r) =>
        `${r.year},${r.openingBalance.toFixed(2)},${r.principalPaid.toFixed(
          2
        )},${r.interestPaid.toFixed(2)},${r.totalPayment.toFixed(2)},${r.closingBalance.toFixed(2)}`
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SORA_Amortization_${params.loanTenureYears}Y_${params.principal}SGD.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              SORA Interest Rate Sensitivity & Stress-Test Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulates parallel shifts in MAS Overnight SORA on current period interest ({result.totalCalendarDays} days) and {params.loanTenureYears}-year amortizing monthly instalments
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>Principal: {formatSgd(params.principal, 0)}</span>
            <span aria-hidden="true">·</span>
            <span>Spread: +{params.marginPercent.toFixed(2)}%</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="py-2.5 px-4">Rate Shock Scenario</th>
                <th className="py-2.5 px-4 text-right">Shocked SORA</th>
                <th className="py-2.5 px-4 text-right">All-In Effective Rate</th>
                <th className="py-2.5 px-4 text-right">
                  {result.totalCalendarDays}-Day Interest Payment
                </th>
                <th className="py-2.5 px-4 text-right">Period Variance</th>
                <th className="py-2.5 px-4 text-right">
                  Monthly Instalment ({params.loanTenureYears}Y)
                </th>
                <th className="py-2.5 px-4 text-right">Monthly Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sensitivityRows.map((row) => {
                const isBase = row.bps === 0;
                return (
                  <tr
                    key={row.bps}
                    className={
                      isBase ? 'bg-slate-900/4 font-semibold' : 'hover:bg-slate-50/80 transition-colors'
                    }
                  >
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-900">
                      {isBase
                        ? '0 bps (Current MAS Base)'
                        : row.bps > 0
                        ? `+${row.bps} bps (+${(row.bps / 100).toFixed(2)}%)`
                        : `${row.bps} bps (${(row.bps / 100).toFixed(2)}%)`}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatRate(row.shockedSora, params.roundingDecimals)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatRate(row.shockedAllIn, params.roundingDecimals)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatSgd(row.periodInterestSgd)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                        row.periodDeltaSgd > 0.005
                          ? 'text-amber-700'
                          : row.periodDeltaSgd < -0.005
                          ? 'text-teal-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {isBase
                        ? 'Baseline'
                        : `${row.periodDeltaSgd > 0 ? '+' : ''}${formatSgd(row.periodDeltaSgd)}`}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatSgd(row.monthlyInstalmentSgd)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                        row.monthlyDeltaSgd > 0.005
                          ? 'text-amber-700'
                          : row.monthlyDeltaSgd < -0.005
                          ? 'text-teal-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {isBase
                        ? 'Baseline'
                        : `${row.monthlyDeltaSgd > 0 ? '+' : ''}${formatSgd(row.monthlyDeltaSgd)}/mo`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Amortizing Facility & Mortgage Repayment Schedule
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculated at effective All-In SORA rate of {formatRate(result.allInRate, params.roundingDecimals)} · Monthly instalment: {formatSgd(result.monthlyEquivalentInstalmentSgd)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {[5, 10, 15, 20, 25, 30].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => onChangeTenureYears(yr)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    params.loanTenureYears === yr
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {yr}Y
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportAmortizationCsv}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Schedule</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="py-2.5 px-4">Tenure Year</th>
                <th className="py-2.5 px-4 text-right">Opening Principal</th>
                <th className="py-2.5 px-4 text-right">Annual Principal Paid</th>
                <th className="py-2.5 px-4 text-right">Annual SORA + Margin Interest</th>
                <th className="py-2.5 px-4 text-right">Total Annual Outflow</th>
                <th className="py-2.5 px-4 text-right">Closing Principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {annualSchedule.map((row) => (
                <tr key={row.year} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-mono tabular-nums font-medium text-slate-900">
                    Year {row.year}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                    {formatSgd(row.openingBalance)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-teal-700 font-medium">
                    {formatSgd(row.principalPaid)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                    {formatSgd(row.interestPaid)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 font-medium">
                    {formatSgd(row.totalPayment)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {formatSgd(row.closingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
