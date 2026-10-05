import type { Request, Response } from 'express';

const MAS_DAILY_SORA_ENDPOINT =
  'https://eservices.mas.gov.sg/apimg-gw/server/monthly_statistical_bulletin_non610mssql/domestic_interest_rates_daily/views/domestic_interest_rates_daily';

export interface MasApiResponseRecord {
  end_of_day: string;
  sora?: string | number;
  sora_index?: string | number;
  comp_sora_1m?: string | number;
  comp_sora_3m?: string | number;
  comp_sora_6m?: string | number;
  aggregate_volume?: string | number;
  aggregate_volume_m?: string | number;
  publication_date?: string;
  [key: string]: unknown;
}

export interface NormalizedSoraRecord {
  end_of_day: string;
  sora: number;
  sora_index: number;
  comp_sora_1m: number;
  comp_sora_3m: number;
  comp_sora_6m: number;
  aggregate_volume_m: number;
  publication_date: string;
}

export default async function handler(req: Request, res: Response) {
  // Never hardcode API keys. Reads from environment or request headers
  const masKeyId = (
    process.env.MAS_KEY_ID ||
    (req.headers['keyid'] as string) ||
    (req.headers['x-mas-key-id'] as string) ||
    (req.query.keyId as string) ||
    ''
  ).trim();

  res.setHeader('Content-Type', 'application/json');

  if (!masKeyId) {
    res.status(401).json({
      success: false,
      error: 'MAS_KEY_ID is missing. Please configure the MAS_KEY_ID environment variable or supply a KeyId header.',
      endpoint: MAS_DAILY_SORA_ENDPOINT,
      requiredHeader: 'KeyId: <MAS_KEY_ID>',
    });
    return;
  }

  try {
    const url = new URL(MAS_DAILY_SORA_ENDPOINT);

    // Forward or construct query parameters
    const limit = (req.query.limit as string) || '500';
    url.searchParams.set('limit', limit);

    if (req.query.offset) {
      url.searchParams.set('offset', String(req.query.offset));
    }

    if (req.query.between) {
      url.searchParams.set('between', String(req.query.between));
    } else if (req.query.startDate && req.query.endDate) {
      url.searchParams.set('between', `end_of_day,${req.query.startDate},${req.query.endDate}`);
    }

    if (req.query.filters) {
      url.searchParams.set('filters', String(req.query.filters));
    }

    // Call MAS API with required KeyId header
    const masResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        KeyId: masKeyId,
        Accept: 'application/json',
      },
    });

    if (!masResponse.ok) {
      const errorText = await masResponse.text();
      res.status(masResponse.status).json({
        success: false,
        status: masResponse.status,
        error: `MAS API returned HTTP ${masResponse.status}`,
        details: errorText,
      });
      return;
    }

    const data = await masResponse.json();

    // MAS data usually returns { result: { records: [...] } } or records directly
    const rawRecords: MasApiResponseRecord[] = Array.isArray(data)
      ? data
      : (data?.result?.records || data?.records || []);

    const normalized: NormalizedSoraRecord[] = rawRecords
      .map((r) => {
        const rawDate = String(r.end_of_day || r.date || '').slice(0, 10);
        const soraVal = parseFloat(String(r.sora ?? ''));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(soraVal)) {
          return null;
        }

        const parseNum = (v: unknown, fallback: number) => {
          const n = parseFloat(String(v ?? ''));
          return Number.isNaN(n) ? fallback : n;
        };

        return {
          end_of_day: rawDate,
          sora: Number(soraVal.toFixed(4)),
          sora_index: parseNum(r.sora_index, 112.5),
          comp_sora_1m: parseNum(r.comp_sora_1m, soraVal),
          comp_sora_3m: parseNum(r.comp_sora_3m, soraVal),
          comp_sora_6m: parseNum(r.comp_sora_6m, soraVal),
          aggregate_volume_m: parseNum(r.aggregate_volume_m ?? r.aggregate_volume, 2000),
          publication_date: String(r.publication_date || rawDate),
        };
      })
      .filter((r): r is NormalizedSoraRecord => r !== null)
      .sort((a, b) => a.end_of_day.localeCompare(b.end_of_day));

    res.status(200).json({
      success: true,
      source: 'MAS Domestic Interest Rates Daily API Gateway',
      count: normalized.length,
      records: normalized,
      raw: data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown serverless proxy error',
    });
  }
}
