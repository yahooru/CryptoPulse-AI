# CryptoPulse AI

CryptoPulse AI is an AI Portfolio Doctor for the BNB Hack Track 2 CMC Strategy Skill track. It diagnoses a crypto portfolio, reads supported BNB Smart Chain wallet balances, pulls live CoinMarketCap market data, generates risk-aware rebalance recommendations, and exports a backtestable strategy specification.

Production: https://cryptopulse-ai-eosin.vercel.app

The repo now includes both the visual Next.js demo and a concrete CMC-style Skill artifact under `skills/cryptopulse-portfolio-doctor`. Reports are generated from user input or a connected wallet, CoinMarketCap data is fetched server-side, API keys never leave the backend, and the exported strategy JSON contains the universe, target allocation, signal rules, filters, risk guards, costs, slippage, benchmark, and rebalance assumptions needed by a backtest runner.

## What It Does

- Accepts manual portfolio weights like `BTC 45%`, `ETH 35%`, `BNB 20%`.
- Connects an injected EVM wallet and switches to BNB Smart Chain for on-chain intake.
- Reads native BNB plus supported BEP-20 balances through BNB Chain JSON-RPC.
- Resolves assets to stable CoinMarketCap ids before requesting quotes.
- Uses CoinMarketCap quotes and Fear and Greed data for market regime scoring.
- Calculates health, risk, diversification, sector exposure, role exposure, and drawdown proxies.
- Produces rebalance targets and an exportable strategy spec for Track 2 judging.
- Attempts a daily historical CoinMarketCap replay for the exported universe.
- Falls back to quote-window proxy metrics when historical CMC data is unavailable on the configured plan.
- Uses OpenAI to generate a concise investment-committee narrative when `OPENAI_API_KEY` is configured.
- Falls back to deterministic reasoning if OpenAI is unavailable, so the core workflow still completes.

## Product Pages

- `/` - Brand entry page with the Track 2 strategy flow.
- `/dashboard` - Portfolio Doctor intake, wallet read, scoring, recommendations, and spec download.
- `/analysis` - Allocation, sector, role, and CMC quote matrix.
- `/risk` - Risk score, diversification, drawdown guardrails, and agent alerts.
- `/recommendations` - Target allocation actions with current and optimized weights.
- `/backtesting` - Strategy spec, target allocation, historical replay/proxy metrics, benchmark, fees, slippage, and JSON export.
- `/reasoning` - Multi-agent decision trace and OpenAI narrative.

## Architecture

```text
User input or wallet
        |
        v
Next.js App Router UI
        |
        +--> /api/onchain/portfolio
        |       |
        |       +--> BNB Smart Chain RPC
        |       +--> CoinMarketCap quotes for balance valuation
        |
        +--> /api/portfolio/analyze
                |
                +--> CoinMarketCap id resolution
                +--> CoinMarketCap quotes/latest
                +--> CoinMarketCap quotes/historical when available
                +--> CoinMarketCap Fear and Greed
                +--> Portfolio scoring engine
                +--> Historical replay engine with proxy fallback
                +--> OpenAI narrative layer
                +--> Backtestable strategy spec
```

Core modules:

- `lib/portfolio.ts` - asset catalog, portfolio normalization, scoring, recommendations, agent signals, and strategy spec generation.
- `lib/backtest.ts` - daily historical replay, benchmark comparison, Sharpe, max drawdown, turnover-cost handling, and proxy fallback support.
- `lib/cmc.ts` - CoinMarketCap API client, id resolution, quote normalization, retries, and short server-side cache.
- `lib/onchain.ts` - BNB Chain RPC wallet reads for native BNB and supported BEP-20 balances.
- `lib/openai-report.ts` - OpenAI Responses API integration for structured narrative output.
- `lib/report-storage.ts` - versioned browser-local report persistence and clear-report support.
- `components/portfolio-lab.tsx` - dashboard workflow and report generation UX.
- `components/report-pages.tsx` - separated analysis, risk, recommendation, backtesting, and reasoning pages.
- `skills/cryptopulse-portfolio-doctor` - Track 2 skill package with trigger, workflow, CMC MCP tool expectations, and input schema.

## On-Chain Support

The wallet route supports BNB Smart Chain assets declared in the local catalog, including native BNB and supported BEP-20 tokens such as BTCB/BTC exposure, ETH, USDT, USDC, LINK, CAKE, and DOGE. Balances are valued with live CoinMarketCap prices, converted into portfolio weights, and then passed through the same strategy engine as manual input.

No live trades are executed. CryptoPulse AI produces analysis and a backtestable strategy spec only.

## Environment

Create a local `.env` file with your own keys:

```bash
OPENAI_API_KEY=your_openai_key
COINMARKETCAP_API_KEY=your_coinmarketcap_key
OPENAI_MODEL=gpt-4.1-mini
BSC_RPC_URL=https://bsc-dataseed.binance.org
```

Optional:

```bash
CMC_API_BASE_URL=https://pro-api.coinmarketcap.com
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
RATE_LIMIT_TRUST_PROXY=true
```

Security notes:

- `.env*` is ignored by git.
- CoinMarketCap and OpenAI keys are used only in server routes and server modules.
- There are no `NEXT_PUBLIC_*` secrets.
- The UI does not ship demo portfolio defaults or template branding.
- The latest report is stored only in browser localStorage and can be removed with Clear Report.
- This app produces research/spec output only. It does not execute trades, request private keys, or request token approvals.

## Local Development

Install dependencies:

```bash
corepack pnpm install
```

Run the app:

```bash
corepack pnpm dev --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

Quality checks:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm audit
```

Production guards included in the app:

- Runtime request validation for API payloads.
- Streamed body-size checks on JSON routes, including requests without `content-length`.
- Shared-store rate limiting through Upstash Redis REST when configured, with in-memory fallback for local development.
- Proxy IP headers are trusted only on Vercel or when `RATE_LIMIT_TRUST_PROXY=true`.
- Timeouts for CoinMarketCap, OpenAI, and BNB Chain RPC calls.
- Wallet token reads use per-token failure isolation so one bad RPC response does not fail the whole supported-asset snapshot.
- Security headers, robots, sitemap, manifest, canonical metadata, and a production CSP without `unsafe-eval`.
- Versioned browser-local report persistence with a visible Clear Report control.

## API Routes

### `POST /api/portfolio/analyze`

Manual input:

```json
{
  "portfolioText": "BTC 45%\nETH 30%\nBNB 20%\nUSDT 5%",
  "source": "manual"
}
```

On-chain input:

```json
{
  "positions": [
    { "symbol": "BNB", "weight": 35.5, "amount": 1.2, "usdValue": 980.25 }
  ],
  "source": "bnb-chain"
}
```

Returns:

- `analysis.healthScore`
- `analysis.riskScore`
- `analysis.diversificationScore`
- `analysis.positions`
- `analysis.recommendations`
- `analysis.backtest.method`
- `analysis.backtest.benchmarkReturn` when historical replay is available
- `analysis.agentSignals`
- `analysis.strategySpec`
- `analysis.ai` when OpenAI is available

### `POST /api/onchain/portfolio`

```json
{
  "walletAddress": "0x0000000000000000000000000000000000000000"
}
```

Returns supported non-zero BNB Chain holdings with balances, prices, USD values, and computed weights.

## Track 2 Alignment

CryptoPulse AI is designed around the judging needs of a CMC Strategy Skill:

- Includes a concrete skill package at `skills/cryptopulse-portfolio-doctor`.
- Declares a JSON input schema for manual portfolios, structured positions, and BNB Chain wallet intake.
- Uses CoinMarketCap as the primary market data source.
- Resolves assets into CMC ids for reproducibility.
- Produces a concrete strategy spec rather than generic buy/sell text.
- Emits explicit `targetAllocation`, `signalRules`, `cmcSkill`, `backtestConfig`, and reproducibility metadata.
- Attempts CMC historical daily replay and includes benchmark, Sharpe, drawdown, observation count, and turnover-cost effects when available.
- Includes risk guards, rebalance rules, cost assumptions, slippage assumptions, and benchmark.
- Supports BNB Chain wallet reads for a real on-chain intake path.
- Separates analysis, risk, recommendations, backtesting, and reasoning into clear product pages.

## Current Limitations

- Historical replay depends on CoinMarketCap historical quote access for the configured API key. If CMC returns insufficient history, the app falls back to quote-window proxy metrics and labels the method clearly.
- The built-in replay uses daily quote prices and static target weights. A full external runner can still consume the exported JSON for more advanced OHLCV, intraday, or factor-based testing.
- Wallet intake reads a curated BNB Chain asset catalog; unsupported tokens are ignored until added to `ASSET_CATALOG`.
- The app is non-custodial and non-executing. It does not place trades or request token approvals.
