# SORA Calc SG — Singapore Overnight Rate Average Interest Calculator

A fast, accurate, and interactive Singapore-based SORA interest payment and compounding calculator aligned with Monetary Authority of Singapore (MAS) and SC-STS (Steering Committee for SOR & SIBOR Transition to SORA) financial market conventions.

## Features

- **MAS & SC-STS Calculation Methodologies**:
  - **Compounded in Arrears (Daily)**: Computes interest using the official compounded SORA formula `[ ∏ (1 + SORA_i × n_i / 365) − 1 ] × (365 / d)` with Observation Period Shift or Lookback without Observation Shift (0, 2, 3, 5, 10 business days).
  - **MAS SORA Index Method**: Derives effective interest rates directly from start/end SORA Index ratios (base 100.00000000 on 3 Aug 2020).
  - **Compounded in Advance (1M / 3M / 6M)**: Standard for Singapore residential mortgages (HDB and Private Property home loans) and SME term loans.
- **Singapore Business Day & Public Holiday Calendar**:
  - Accurate day-count weights ($n_i = 1$ for standard days, $n_i = 3$ across weekends, $n_i = 2, 4$ across Singapore public holidays).
- **Daily Accrual Ledger**:
  - Full audit trail of each Singapore business day with daily compounding factor, cumulative factor, and accrued SGD interest.
- **Rate Shock Sensitivity & Stress-Test Matrix**:
  - Parallel shift simulations (-50 bps to +150 bps) across period interest and amortizing monthly loan instalments.
- **MAS Data Feed Ingestion & Backend Ready**:
  - Upload or paste official MAS Domestic Interest Rates CSV or JSON payloads.
  - Interactive inline rate override for stress testing.
  - Copyable backend API adapter schema (`datastore/search.json`).

## Tech Stack

- **React 19** + **TypeScript**
- **Vite**
- **Tailwind CSS v4**
- **Lucide React**

## Getting Started

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build
```
