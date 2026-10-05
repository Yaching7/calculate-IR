import type { Request, Response } from 'express';

export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  hasApiKey: boolean;
  timestamp: string;
  uptimeSeconds: number;
}

export default async function handler(req: Request, res: Response) {
  const masKeyId = process.env.MAS_KEY_ID || (req.headers['x-mas-key-id'] as string) || (req.headers['keyid'] as string);

  const payload: HealthResponse = {
    status: 'ok',
    service: 'sora-calc-mas-serverless',
    hasApiKey: Boolean(masKeyId && masKeyId.trim().length > 0),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(payload);
}
