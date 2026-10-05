# SORA Calc SG — Full Conversation & Implementation History

**Application**: SORA Calc SG (Singapore Overnight Rate Average Calculator)  
**Date**: October 5, 2026  
**Repository**: [https://github.com/Yaching7/calculate-IR.git](https://github.com/Yaching7/calculate-IR.git)  

---

## 1. Initial Prompt & Project Inception

### User Request
> "build me a simple Singapore based SORA calculator that reads MAS backed overnight rates for calculating interest payments accurately and efficiently. Just the front end for now, I will include the backend integration later."

### Engineering & Architecture Decisions
- **Financial Standard**: Aligned strictly with Monetary Authority of Singapore (MAS) and SC-STS (Steering Committee for SOR & SIBOR Transition to SORA) conventions.
  - Day Count Fraction: **Actual/365 (Fixed)** (standard for Singapore Dollar SGD transactions).
  - Compounding Formula:
    $$\text{Compounded SORA} = \left[ \prod_{i=1}^{d_0} \left( 1 + \frac{\text{SORA}_i \times n_i}{365} \right) - 1 \right] \times \frac{365}{d}$$
  - Supported Methodologies:
    1. **Compounded in Arrears (Daily)**: Supports Observation Period Shift or Lookback without Observation Shift (0, 2, 3, 5, 10 business days), Lockout Days (0, 2, 5 days), and Daily Floor (0.00% floor or unfloored).
    2. **MAS SORA Index Method**: Rate derivation directly from the 8-decimal official SORA Index ratio $\left(\frac{\text{Index}_{\text{End}}}{\text{Index}_{\text{Start}}} - 1\right) \times \frac{365}{d}$.
    3. **Compounded in Advance (1M / 3M / 6M)**: Suitable for Singapore retail mortgages (HDB and Private Property) and SME term loans.
- **Singapore Calendar & MOM Public Holidays**:
  - Dynamically calculates day weighting $n_i$ ($n_i = 1$ on standard business days, $n_i = 3$ on standard Fridays/weekends, $n_i = 2, 4$ on Singapore public holidays such as Deepavali, Chinese New Year, Good Friday, Hari Raya Puasa, Labour Day, Vesak Day, National Day, Christmas).
- **Core Files Created**:
  - `src/types/sora.ts`: Domain data models and calculation types.
  - `src/data/masSoraData.ts`: Singapore holiday calendar, SORA Index compounding generator, and MAS CSV/JSON parsers.
  - `src/utils/soraCalculator.ts`: Core SC-STS mathematical computation engine.
  - `src/components/SoraRateChart.tsx`: High-performance SVG benchmark curve with active observation window shading.
  - `src/components/LoanSensitivityPanel.tsx`: Stress-test matrix (-50 bps to +150 bps) and multi-year amortizing repayment schedule.
  - `src/components/MasDataFeedPanel.tsx`: CSV/JSON data ingestion and rate override interface.
  - `src/App.tsx`: Primary application layout complying with top-bar contracts and unboxed metadata discipline.

---

## 2. GitHub Push & Codebase Synchronization

### User Request
> `git push [TOKEN]@https://github.com/Yaching7/calculate-IR.git`

### Actions Performed
1. Initialized git repository on branch `main`.
2. Configured user profile (`Yaching7`, `yaching35@gmail.com`).
3. Added project files and documentation (`README.md`, `.gitignore`, `tsconfig.json`, `vite.config.ts`, `package.json`, `src/`).
4. Committed: `Initial commit: SORA Calc SG - Singapore Overnight Rate Average interest calculator` (Commit `34ffdb9`).
5. Pushed to remote repository `https://github.com/Yaching7/calculate-IR.git`.
6. Sanitized remote tracking URL to remove personal access token from git configuration.

---

## 3. Serverless MAS Connection Implementation

### User Request
> "add a serverless connection that pulls MAS data using the following end points:
> - store this in /api folder (at project root level) NOT src file
> - include /health.ts and /sora.ts within the same subfolder
> - do not hardcode api keys, I will include them manually
> 
> # Daily SORA + compounded 1M/3M/6M averages:
> https://eservices.mas.gov.sg/apimg-gw/server/monthly_statistical_bulletin_non610mssql/domestic_interest_rates_daily/views/domestic_interest_rates_daily
> 
> # All requests need the header: KeyId: <MAS_KEY_ID>"

### Implementation Details

#### 1. `/api/health.ts`
- Provides an operational health check for the serverless function layer.
- Verifies uptime and whether `process.env.MAS_KEY_ID` or request headers have been configured without exposing the secret key.
- Returns status code 200 with JSON:
  ```json
  {
    "status": "ok",
    "service": "sora-calc-mas-serverless",
    "hasApiKey": true,
    "timestamp": "2026-10-05T08:00:25.768Z",
    "uptimeSeconds": 23
  }
  ```

#### 2. `/api/sora.ts`
- Connects directly to the MAS API Gateway endpoint:
  `https://eservices.mas.gov.sg/apimg-gw/server/monthly_statistical_bulletin_non610mssql/domestic_interest_rates_daily/views/domestic_interest_rates_daily`
- Injects required header: `KeyId: <MAS_KEY_ID>`.
- Supports query parameters: `limit`, `offset`, `between` (e.g. date filters).
- Normalizes MAS dataset response fields (`end_of_day`, `sora`, `sora_index`, `comp_sora_1m`, `comp_sora_3m`, `comp_sora_6m`, `aggregate_volume_m`).
- Returns HTTP 401 with setup instructions if `MAS_KEY_ID` is missing, preventing unauthenticated calls.

#### 3. `/server.ts` & `package.json`
- Configured Express server running on port 3000 with `vite.middlewares` mounted in development.
- Updated scripts:
  - `"dev": "tsx server.ts"`
  - `"build": "vite build"`
  - `"start": "tsx server.ts"`
  - `"lint": "tsc --noEmit"`

#### 4. `.env.example`
- Added documentation for the environment variable:
  ```env
  MAS_KEY_ID="YOUR_MAS_API_KEY_HERE"
  ```

#### 5. Frontend Live Connection Card (`src/components/MasDataFeedPanel.tsx`)
- Integrated a live health probe button ("Ping /api/health").
- Added a one-click "Pull Live MAS SORA Rates" action calling `/api/sora`.
- Added an optional manual KeyId test field for local testing before setting environment variables.

---

## 4. GitHub Push of Serverless Updates

### User Request
> `git push [TOKEN]@https://github.com/Yaching7/calculate-IR.git`

### Actions Performed
1. Staged and committed changes:
   - Commit: `8cb2a62` — `Add serverless connection: /api/sora.ts and /api/health.ts for MAS rates`
   - Files included:
     - `api/health.ts`
     - `api/sora.ts`
     - `server.ts`
     - `package.json`
     - `.env.example`
     - `src/components/MasDataFeedPanel.tsx`
2. Pushed updates to `https://github.com/Yaching7/calculate-IR.git` on branch `main`.
3. Verified compilation (`compile_applet`) and TypeScript linter (`lint_applet`), both passing with zero errors.

---

## 5. Summary of Project File Tree

```
/
├── .env.example
├── .gitignore
├── README.md
├── CHAT_EXPORT.md
├── index.html
├── metadata.json
├── package.json
├── server.ts
├── tsconfig.json
├── vite.config.ts
├── api/
│   ├── health.ts
│   └── sora.ts
└── src/
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    ├── components/
    │   ├── LoanSensitivityPanel.tsx
    │   ├── MasDataFeedPanel.tsx
    │   └── SoraRateChart.tsx
    ├── data/
    │   └── masSoraData.ts
    ├── types/
    │   └── sora.ts
    └── utils/
        └── soraCalculator.ts
```
