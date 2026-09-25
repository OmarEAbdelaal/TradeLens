# TradeLens

Private research workspace for Omar. First edition: USD stock watchlist, explicit sample/manual data provenance, three transparent screening rules, fee-aware long-only position sizing and durable paper-trade journal. No live quotes, AI predictions, broker connection, automatic stops, background alerts or Sharia certification are active.

## Runtime

Vinext on Cloudflare Workers; D1 binding `DB`. Private Sites access policy and per-request `oai-authenticated-user-id` scope every portfolio. D1 uses prepared statements and optimistic version checks to reject concurrent updates. Portfolio writes validate on the server; overselling and spending beyond virtual cash are rejected.

## Calculations

Initial virtual balance is USD 10,000. Whole shares only. Planned size is the smaller of affordable shares and risk-budget shares, accounting for one entry and one exit fee. Prices must satisfy stop < entry < target. Gap/slippage risk is not modeled. Paper orders fill at the stored quote, including fictional examples, and never place broker orders.

The shortlist counts three illustrative criteria: price above 50-day average, positive annual revenue growth, and debt/equity below one. Counts are not probabilities, forecasts or investment recommendations.

## Next connections

Select the target exchange and licensed market-data provider. Configure OpenAI server-side through the OpenAI Developers workflow before adding model calls. Never place provider credentials in client JavaScript. Keep source timestamps and model evidence visible. Broker execution requires a separate explicitly authorized integration.

## Validation

TypeScript check; domain checks cover fee-aware sizing, invalid plans, buy/sell accounting, quote valuation, insufficient cash, negative quantities and overselling. Browser/WebMCP runtime validation was unavailable in the current environment. The optional read-only WebMCP tool is feature-detected.
