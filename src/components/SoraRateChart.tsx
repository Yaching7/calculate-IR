import React, { useMemo, useState } from 'react';
import { MasSoraRecord } from '../types/sora';

interface SoraRateChartProps {
  records: MasSoraRecord[];
  observationStartDate: string;
  observationEndDate: string;
  onSelectDateRange?: (start: string, end: string) => void;
}

export const SoraRateChart: React.FC<SoraRateChartProps> = ({
  records,
  observationStartDate,
  observationEndDate,
}) => {
  const [timeframeDays, setTimeframeDays] = useState<90 | 180 | 365>(180);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [show1M, setShow1M] = useState(true);
  const [show3M, setShow3M] = useState(true);

  const visibleRecords = useMemo(() => {
    const count = Math.min(records.length, Math.round((timeframeDays * 5) / 7));
    return records.slice(records.length - count);
  }, [records, timeframeDays]);

  const { minRate, maxRate } = useMemo(() => {
    if (visibleRecords.length === 0) return { minRate: 2.0, maxRate: 3.5 };
    let min = Infinity;
    let max = -Infinity;
    for (const r of visibleRecords) {
      min = Math.min(min, r.sora, r.comp_sora_1m, r.comp_sora_3m);
      max = Math.max(max, r.sora, r.comp_sora_1m, r.comp_sora_3m);
    }
    const pad = Math.max(0.05, (max - min) * 0.15);
    return {
      minRate: Number((min - pad).toFixed(2)),
      maxRate: Number((max + pad).toFixed(2)),
    };
  }, [visibleRecords]);

  const width = 820;
  const height = 220;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const getX = (idx: number) => {
    if (visibleRecords.length <= 1) return padLeft;
    return padLeft + (idx / (visibleRecords.length - 1)) * plotW;
  };

  const getY = (rate: number) => {
    const ratio = (rate - minRate) / Math.max(0.0001, maxRate - minRate);
    return padTop + plotH - ratio * plotH;
  };

  const buildPath = (extractor: (r: MasSoraRecord) => number) => {
    if (visibleRecords.length === 0) return '';
    return visibleRecords
      .map((r, idx) => `${idx === 0 ? 'M' : 'L'}${getX(idx).toFixed(1)},${getY(extractor(r)).toFixed(1)}`)
      .join(' ');
  };

  const soraPath = useMemo(() => buildPath((r) => r.sora), [visibleRecords, minRate, maxRate]);
  const comp1mPath = useMemo(() => buildPath((r) => r.comp_sora_1m), [visibleRecords, minRate, maxRate]);
  const comp3mPath = useMemo(() => buildPath((r) => r.comp_sora_3m), [visibleRecords, minRate, maxRate]);

  const obsBounds = useMemo(() => {
    if (visibleRecords.length === 0) return null;
    let startIdx = visibleRecords.findIndex((r) => r.end_of_day >= observationStartDate);
    let endIdx = -1;
    for (let i = visibleRecords.length - 1; i >= 0; i--) {
      if (visibleRecords[i].end_of_day <= observationEndDate) {
        endIdx = i;
        break;
      }
    }
    if (startIdx === -1 && observationStartDate < visibleRecords[0].end_of_day) {
      startIdx = 0;
    }
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
    const x1 = getX(startIdx);
    const x2 = getX(endIdx);
    return { x1, x2: Math.max(x1 + 3, x2) };
  }, [visibleRecords, observationStartDate, observationEndDate]);

  const activeRecord =
    hoverIndex !== null && visibleRecords[hoverIndex]
      ? visibleRecords[hoverIndex]
      : visibleRecords[visibleRecords.length - 1];

  const yTicks = useMemo(() => {
    const steps = 4;
    const arr: number[] = [];
    for (let i = 0; i <= steps; i++) {
      arr.push(minRate + ((maxRate - minRate) * i) / steps);
    }
    return arr;
  }, [minRate, maxRate]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>MAS Benchmark Curve</span>
            <span aria-hidden="true">·</span>
            <span>Highlighted window: {observationStartDate} to {observationEndDate}</span>
          </div>
          {activeRecord && (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
                {activeRecord.end_of_day}
              </span>
              <span className="text-xs text-slate-600">
                Overnight SORA:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {activeRecord.sora.toFixed(4)}%
                </strong>
              </span>
              <span className="text-xs text-slate-600">
                1M Comp:{' '}
                <strong className="font-mono tabular-nums text-teal-700">
                  {activeRecord.comp_sora_1m.toFixed(4)}%
                </strong>
              </span>
              <span className="text-xs text-slate-600">
                3M Comp:{' '}
                <strong className="font-mono tabular-nums text-amber-700">
                  {activeRecord.comp_sora_3m.toFixed(4)}%
                </strong>
              </span>
              <span className="text-xs text-slate-500">
                Index:{' '}
                <span className="font-mono tabular-nums text-slate-700">
                  {activeRecord.sora_index.toFixed(8)}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setShow1M((v) => !v)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                show1M ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              1M Compounded
            </button>
            <button
              type="button"
              onClick={() => setShow3M((v) => !v)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                show3M ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              3M Compounded
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {([90, 180, 365] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTimeframeDays(days)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  timeframeDays === days
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {days === 90 ? '3M' : days === 180 ? '6M' : '1Y'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 relative select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-52 overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            const ratio = Math.max(0, Math.min(1, (relX - padLeft) / plotW));
            const idx = Math.round(ratio * (visibleRecords.length - 1));
            setHoverIndex(idx);
          }}
        >
          {yTicks.map((tick, idx) => {
            const y = getY(tick);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray={idx === 0 ? undefined : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {tick.toFixed(2)}%
                </text>
              </g>
            );
          })}

          {obsBounds && (
            <g>
              <rect
                x={obsBounds.x1}
                y={padTop}
                width={obsBounds.x2 - obsBounds.x1}
                height={plotH}
                fill="#0F172A"
                fillOpacity="0.06"
              />
              <line
                x1={obsBounds.x1}
                y1={padTop}
                x2={obsBounds.x1}
                y2={padTop + plotH}
                stroke="#0F172A"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <line
                x1={obsBounds.x2}
                y1={padTop}
                x2={obsBounds.x2}
                y2={padTop + plotH}
                stroke="#0F172A"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </g>
          )}

          {show3M && (
            <path
              d={comp3mPath}
              fill="none"
              stroke="#B45309"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          )}

          {show1M && (
            <path
              d={comp1mPath}
              fill="none"
              stroke="#0F766E"
              strokeWidth="1.5"
            />
          )}

          <path
            d={soraPath}
            fill="none"
            stroke="#0F172A"
            strokeWidth="1.75"
          />

          {hoverIndex !== null && visibleRecords[hoverIndex] && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padTop}
                x2={getX(hoverIndex)}
                y2={padTop + plotH}
                stroke="#64748B"
                strokeWidth="1"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(visibleRecords[hoverIndex].sora)}
                r="3.5"
                fill="#0F172A"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </g>
          )}

          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
            if (visibleRecords.length === 0) return null;
            const idx = Math.min(
              visibleRecords.length - 1,
              Math.round(frac * (visibleRecords.length - 1))
            );
            const rec = visibleRecords[idx];
            return (
              <text
                key={i}
                x={getX(idx)}
                y={height - 6}
                textAnchor={frac === 0 ? 'start' : frac === 1 ? 'end' : 'middle'}
                className="fill-slate-400 text-[10px] font-mono"
              >
                {rec.end_of_day}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
