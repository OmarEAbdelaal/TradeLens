# TradeLens — DFM paper portfolio

Private Arabic-first paper-trading workspace. Root uses real DFM daily closing prices, with AED 10,000 virtual capital. `/legacy` preserves the original USD fictional/manual portfolio and its history in the unchanged `portfolios` table.

## Data and boundaries

- Official source: https://service.dfm.ae/Bulletins/ (server-side HTTPS, 18-second timeout, 15-minute persistent cache). First verified bulletin: 2026-09-25, 65 priced cash securities/REITs, 28 with DFM Sharia badges. Catalog is parsed anew, not a fixed ticker list.
- Main-table parser validates dated metadata, exact column structure, minimum row count and unique symbols; stops before futures, excludes private companies and ETFs. Compliance means actual green-crescent image presence, not the cell's unconditional title.
- No realtime feed, financial fundamentals, model predictions, background polling, broker execution or automatic news. Client refreshes every five minutes only while visible; stores actual fetched bulletins for the last 90-day history view, with gaps explicitly acknowledged. No fabricated historical data.
- Historical account values use transactions recorded by each bulletin day in Dubai, and prices collected on that day. Weekend trades use the last available closing quote but retain their actual transaction timestamp; no backdating.
- Orders use server-observed quotes; reject changed quote/date, failed source refresh, more than four calendar days old, and securities not traded on the bulletin day. Buys additionally require the source's Sharia badge. This does not certify a broker or replace a qualified Sharia assessment.

## Fees and P&L

Published standard DFM fee profiles for Al Ramz and Emirates NBD Securities reviewed 2026-09-26. Both modeled as .275% notional + AED10 per order; VAT 5% on .225% notional and fixed fee (SCA .05% exempt). Displayed rates are indicative; actual contract/discounts and rounding may differ. Fee references are linked in-app. Each immutable trade records broker, quote date, actual timestamp, fees and fee version.

Long-only integer shares, no leverage. Weighted-average cost includes entry fees. Partial sale releases proportional cost; realized P&L includes sale fees. Portfolio estimated liquidation P&L includes already-paid fees plus fees for one exit per open holding. No dividends, splits, annual service fees, bank/FX fees or slippage modeled. Missing prices suppress total P&L rather than silently treating unpriced holdings as zero.

## Persistence and security

Vinext / Cloudflare Worker, D1 binding DB. Private Sites policy plus per-request platform user header; each account scoped to that user. Prepared SQL, strict server-side validation, origin validation, optimistic version checks and order IDs. New tables `paper_accounts` and `market_snapshots` use append-only migration 0001. Existing USD records remain unchanged.

## Validation

- `pnpm exec tsc --noEmit`
- `node scripts/tests/paper.mjs` — fee calculations, partial sales and cost basis, P&L, source parser, Sharia badges, stale quotes and invalid orders. Optional `BULLETIN_FIXTURE=/path/to/official.html` tests actual bulletin.
- `node scripts/tests/api.mjs` — real SQLite migrations and API route auth, origin, quote tampering, user isolation, cash ledger, concurrency and source-failure rejection.
- Production build via Sites workflow. Preview service reported running but was unreachable; no browser/WebMCP interaction QA completed in this environment.

OpenAI and broker APIs remain explicitly unconnected. Secure API key provisioning is required before implementing server-side model calls. Never put API keys in client code.
