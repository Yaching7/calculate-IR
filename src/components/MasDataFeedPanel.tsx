import React, { useMemo, useState } from 'react';
import { MasSoraRecord } from '../types/sora';
import { parseMasCsvOrJson } from '../data/masSoraData';
import { Check, Copy, Download, RotateCcw, Search, Upload } from 'lucide-react';

interface MasDataFeedPanelProps {
  records: MasSoraRecord[];
  onUpdateRecords: (newRecords: MasSoraRecord[]) => void;
  onResetDefaultRecords: () => void;
  onOverrideSingleRate: (dateStr: string, newRate: number) => void;
}

const SAMPLE_MAS_CSV = `end_of_day,sora,sora_index,comp_sora_1m,comp_sora_3m,comp_sora_6m,aggregate_volume_m
2026-09-25,2.6715,113.98412015,2.6890,2.7240,2.7810,2310
2026-09-28,2.6840,114.00910298,2.6885,2.7232,2.7801,2180
2026-09-29,2.6912,114.01748840,2.6892,2.7228,2.7795,2490
2026-09-30,2.7680,114.02589612,2.6924,2.7241,2.7799,3120
2026-10-01,2.6790,114.03454190,2.6918,2.7235,2.7790,2040
2026-10-02,2.6725,114.04291044,2.6911,2.7229,2.7784,1985`;

const BACKEND_ADAPTER_SNIPPET = `// Ready-to-wire Backend Adapter for MAS Domestic Interest Rates API
// Endpoint: https://eservices.mas.gov.sg/api/action/datastore/search.json
export interface MasApiQueryParams {
  resource_id: string; // e.g. '9a0bf149-308c-4bd2-832d-76c8e6cb47ed'
  between?: string;    // 'end_of_day,2026-01-01,2026-10-05'
  limit?: number;
}

export async function fetchMasSoraRates(startDate: string, endDate: string) {
  const response = await fetch(
    \`/api/mas/sora?start=\${encodeURIComponent(startDate)}&end=\${encodeURIComponent(endDate)}\`
  );
  if (!response.ok) throw new Error(\`MAS rate feed error: \${response.status}\`);
  const payload = await response.json();
  return payload.records; // Maps directly into parseMasCsvOrJson()
}`;

export const MasDataFeedPanel: React.FC<MasDataFeedPanelProps> = ({
  records,
  onUpdateRecords,
  onResetDefaultRecords,
  onOverrideSingleRate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rawImportText, setRawImportText] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const filteredRecords = useMemo(() => {
    const rev = [...records].reverse();
    if (!searchTerm.trim()) return rev.slice(0, 90);
    const q = searchTerm.trim().toLowerCase();
    return rev.filter(
      (r) =>
        r.end_of_day.includes(q) ||
        r.sora.toFixed(4).includes(q) ||
        (r.holiday_note && r.holiday_note.toLowerCase().includes(q))
    );
  }, [records, searchTerm]);

  const handleParseAndImport = (mode: 'merge' | 'replace') => {
    const result = parseMasCsvOrJson(rawImportText);
    if (result.error) {
      setImportStatus({ type: 'error', message: result.error });
      return;
    }

    if (mode === 'replace') {
      onUpdateRecords(result.records);
      setImportStatus({
        type: 'success',
        message: `Replaced dataset with ${result.records.length} validated MAS SORA records.`,
      });
    } else {
      const mergedMap = new Map<string, MasSoraRecord>();
      for (const r of records) mergedMap.set(r.end_of_day, r);
      for (const r of result.records) mergedMap.set(r.end_of_day, r);
      const merged = Array.from(mergedMap.values()).sort((a, b) =>
        a.end_of_day.localeCompare(b.end_of_day)
      );
      onUpdateRecords(merged);
      setImportStatus({
        type: 'success',
        message: `Merged ${result.records.length} records into MAS SORA dataset (${merged.length} total business days).`,
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setRawImportText(content);
    };
    reader.readAsText(file);
  };

  const handleExportDatasetCsv = () => {
    const header =
      'end_of_day,publication_date,sora,sora_index,comp_sora_1m,comp_sora_3m,comp_sora_6m,aggregate_volume_m';
    const rows = records.map(
      (r) =>
        `${r.end_of_day},${r.publication_date},${r.sora.toFixed(4)},${r.sora_index.toFixed(
          8
        )},${r.comp_sora_1m.toFixed(4)},${r.comp_sora_3m.toFixed(4)},${r.comp_sora_6m.toFixed(
          4
        )},${r.aggregate_volume_m}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MAS_SORA_Dataset_${records[records.length - 1]?.end_of_day || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(BACKEND_ADAPTER_SNIPPET);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Ingest MAS Overnight Rate Payload (CSV or JSON)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Paste a Monetary Authority of Singapore (MAS) Domestic Interest Rates CSV export or JSON response to update the local rate table.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRawImportText(SAMPLE_MAS_CSV)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                Load Sample CSV
              </button>
              <label className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
                <input
                  type="file"
                  accept=".csv,.json,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <textarea
            value={rawImportText}
            onChange={(e) => setRawImportText(e.target.value)}
            rows={6}
            placeholder="end_of_day,sora,sora_index,comp_sora_1m,comp_sora_3m,comp_sora_6m&#10;2026-10-02,2.6725,114.04291044,2.6911,2.7229,2.7784"
            className="mt-4 w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-md p-3 text-slate-800 focus:outline-none focus:border-slate-900"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              {importStatus.type === 'error' && (
                <span className="text-red-700 font-medium">Error: {importStatus.message}</span>
              )}
              {importStatus.type === 'success' && (
                <span className="text-emerald-700 font-medium">{importStatus.message}</span>
              )}
              {importStatus.type === 'idle' && (
                <span className="text-slate-500">
                  Supports `end_of_day,sora,sora_index` CSV or MAS `result.records` JSON array.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetDefaultRecords}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Default MAS Feed</span>
              </button>
              <button
                type="button"
                onClick={() => handleParseAndImport('merge')}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Merge into Active Feed
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Backend Integration Contract
              </h2>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Adapter</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              The calculation engine consumes `MasSoraRecord[]`. Connect your backend proxy route to MAS `datastore/search.json` using this schema:
            </p>
            <pre className="mt-3 p-3 bg-slate-900 text-slate-100 rounded-md font-mono text-[11px] leading-relaxed overflow-x-auto">
              {BACKEND_ADAPTER_SNIPPET}
            </pre>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Loaded business days: {records.length}</span>
            <span>Click any SORA cell below to test rate overrides</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              MAS Published Daily SORA & Compounded Benchmarks
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Published at 09:00 SGT on the next Singapore business day · Click any Overnight SORA value to edit inline
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by YYYY-MM-DD or holiday..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-slate-900 w-60"
              />
            </div>
            <button
              type="button"
              onClick={handleExportDatasetCsv}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="py-2.5 px-4">Value Date (end_of_day)</th>
                <th className="py-2.5 px-4">Publication Date (09:00 SGT)</th>
                <th className="py-2.5 px-4 text-right">Overnight SORA (% p.a.)</th>
                <th className="py-2.5 px-4 text-right">MAS SORA Index</th>
                <th className="py-2.5 px-4 text-right">1M Compounded</th>
                <th className="py-2.5 px-4 text-right">3M Compounded</th>
                <th className="py-2.5 px-4 text-right">6M Compounded</th>
                <th className="py-2.5 px-4 text-right">Volume (S$M)</th>
                <th className="py-2.5 px-4">SG Calendar Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRecords.map((row) => {
                const isEditing = editingDate === row.end_of_day;
                return (
                  <tr key={row.end_of_day} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums font-medium text-slate-900">
                      {row.end_of_day}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">
                      {row.publication_date}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {isEditing ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.0001"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = parseFloat(editingValue);
                                if (!Number.isNaN(v) && v >= 0 && v <= 25) {
                                  onOverrideSingleRate(row.end_of_day, Number(v.toFixed(4)));
                                }
                                setEditingDate(null);
                              } else if (e.key === 'Escape') {
                                setEditingDate(null);
                              }
                            }}
                            className="w-24 px-2 py-0.5 text-right font-mono text-xs border border-slate-900 rounded bg-white"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const v = parseFloat(editingValue);
                              if (!Number.isNaN(v) && v >= 0 && v <= 25) {
                                onOverrideSingleRate(row.end_of_day, Number(v.toFixed(4)));
                              }
                              setEditingDate(null);
                            }}
                            className="px-2 py-0.5 text-[11px] bg-slate-900 text-white rounded"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDate(row.end_of_day);
                            setEditingValue(row.sora.toFixed(4));
                          }}
                          title="Click to override this business day's SORA rate"
                          className="font-semibold text-slate-900 hover:text-teal-700 underline decoration-dotted underline-offset-4 cursor-pointer"
                        >
                          {row.sora.toFixed(4)}%
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.sora_index.toFixed(8)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-teal-700">
                      {row.comp_sora_1m.toFixed(4)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {row.comp_sora_3m.toFixed(4)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {row.comp_sora_6m.toFixed(4)}%
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {row.aggregate_volume_m.toLocaleString('en-SG')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {row.holiday_note ? `Includes ${row.holiday_note}` : 'Standard SG Business Day'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
