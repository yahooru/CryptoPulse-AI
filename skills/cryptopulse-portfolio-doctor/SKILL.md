---
name: cryptopulse-portfolio-doctor
description: |
  Generate a risk-aware, backtestable crypto portfolio strategy spec from user-supplied weights or BNB Chain wallet holdings using CoinMarketCap data. Use this skill when a user asks for portfolio health, allocation risk, rebalance targets, or a Track 2 strategy specification.
Trigger: "portfolio doctor", "portfolio health", "crypto allocation", "rebalance crypto", "backtestable strategy", "BNB Hack Track 2", "/cryptopulse-portfolio-doctor"
license: MIT
compatibility: ">=1.0.0"
user-invocable: true
allowed-tools:
  - mcp__cmc-mcp__search_cryptos
  - mcp__cmc-mcp__get_crypto_quotes_latest
  - mcp__cmc-mcp__get_global_metrics_latest
  - mcp__cmc-mcp__get_crypto_technical_analysis
  - mcp__cmc-mcp__get_crypto_latest_news
  - mcp__cmc-mcp__get_global_crypto_derivatives_metrics
  - mcp__cmc-mcp__trending_crypto_narratives
---

# CryptoPulse Portfolio Doctor

CryptoPulse Portfolio Doctor is a CMC Strategy Skill for BNB Hack Track 2. It turns a portfolio into a reproducible strategy spec with allocation targets, signal rules, risk guards, costs, slippage, benchmark, and replay assumptions.

This is not a live-trading skill and must not sign transactions or promise returns.

## Input Contract

Validate user input against `input.schema.json`.

Supported input modes:

1. `portfolioText`: one asset per line, such as `BTC 45%`.
2. `positions`: structured positions with `symbol`, optional `weight`, `amount`, and `usdValue`.
3. `walletAddress`: optional BNB Chain address when a host app supports wallet balance intake.

Normalize weights to 100 percent before scoring.

## Workflow

1. Identify assets.
   - For each symbol, call `search_cryptos` first when a stable CMC id is not already known.
   - Reject unresolved assets instead of silently dropping them.

2. Fetch market data.
   - Call `get_crypto_quotes_latest` for all held assets plus candidate target assets.
   - Include price, market cap, volume, 7d/30d/90d changes, and rank.
   - Call `get_global_metrics_latest` for broader sentiment, especially Fear and Greed.

3. Enrich signals when available.
   - Prefer `get_crypto_technical_analysis` for RSI, MACD, EMA/SMA, pivots, and trend state.
   - Use `get_global_crypto_derivatives_metrics` to flag overheated leverage regimes.
   - Use `trending_crypto_narratives` and recent news only as supporting context, not as standalone buy signals.

4. Score the portfolio.
   - Penalize single-asset concentration above 30 percent.
   - Penalize meme exposure above 8 percent and tier-4/5 exposure above 25 percent.
   - Reward BTC/ETH/BNB core exposure and a stablecoin buffer.
   - Convert the result into health, risk, and diversification scores.

5. Generate target allocation.
   - Always emit explicit `targetAllocation` weights that sum to 100.
   - Use BTC, ETH, and BNB as the default core sleeve.
   - Use one liquid satellite sleeve only when it passes momentum and liquidity checks.
   - Size stablecoins from 12 to 22 percent depending on CMC sentiment.

6. Emit the strategy spec.
   - Include `schemaVersion`, `uniqueName`, CMC ids, data sources, target allocation, signal rules, rebalance rules, entry/exit filters, risk guards, benchmark, costs, slippage, and lookback.
   - Include a `backtestConfig` object that a runner can consume without reading prose.
   - Include clear notes when historical data is unavailable and proxy metrics are used.

## Output Requirements

Return JSON with:

- `analysis.healthScore`
- `analysis.riskScore`
- `analysis.diversificationScore`
- `analysis.positions`
- `analysis.recommendations`
- `analysis.backtest`
- `analysis.strategySpec`

The `strategySpec.uniqueName` must be `cryptopulse_portfolio_doctor`.

## Guardrails

- Do not provide financial advice.
- Do not promise profit.
- Do not execute trades.
- Do not request private keys or token approvals.
- Treat unsupported wallet tokens as coverage gaps and report them clearly.

## Demo Host

The Next.js host app exposes the same workflow at:

- `POST /api/portfolio/analyze`
- `POST /api/onchain/portfolio`

Use the host app for the visual demo and this skill package for the Track 2 submission artifact.
