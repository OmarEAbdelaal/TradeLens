# TradeLens data, source control, and deployment

This document defines where each part of TradeLens lives and which system is authoritative.

## Sources of truth

| What | Authoritative location | Tracked in GitHub? |
| --- | --- | --- |
| Application source, UI, API routes, calculations, and tests | `OmarEAbdelaal/TradeLens` on GitHub | Yes |
| Database structure | `db/schema.ts` and append-only files under `drizzle/` | Yes |
| Live portfolios, trades, settings, AI history, and imported prices | The Sites D1 database bound as `DB` | No |
| Shared market caches and saved market history | The same Sites D1 database | No |
| AI provider keys | Encrypted inside D1 with `TRADELENS_ENCRYPTION_KEY` from the Sites secret store | No |
| Signed-in user identity | ChatGPT authentication headers supplied by the Sites platform | No |
| Production URL and deployment project | OpenAI Sites project `appgprj_6ab5e84c2be88191b5daf79b645e502b` | Deployment metadata only |

GitHub is the source of truth for code and change history. D1 is the source of truth for live application data. Live user data and secrets must never be committed to GitHub, even when the repository is private.

## Where the code is

- `app/`: pages, the main workspace, API routes, and global styles.
- `components/`: portfolio, holdings, market, AI, charts, and reusable UI components.
- `lib/`: trading rules, fees, market providers, AI integrations, and persistence helpers.
- `db/schema.ts`: the current database schema in code.
- `drizzle/`: ordered database migrations. Existing migration files are immutable after deployment; new schema changes get a new migration.
- `scripts/tests/`: calculation and API regression tests.
- `.openai/hosting.json`: the Sites project and database binding name. It contains no credentials.

## Live database tables

### Per-account data

- `portfolios`: the original legacy portfolio.
- `paper_accounts`: the DFM/AED paper portfolio.
- `market_accounts`: wallets for other market and currency combinations.
- `user_settings`: AI provider settings and the encrypted provider key.
- `user_price_history`: prices imported by the signed-in user.
- `ai_history`: saved prompts and AI results.
- `ai_selections`: the selected result for each analysis scope.
- `simulation_archives`: archived paper-trading simulations.

Every query to these tables is scoped by the platform user ID.

### Shared market data

- `market_snapshots` and `official_price_history`: saved DFM bulletins and prices.
- `exchange_cache` and `exchange_history`: current and historical exchange feeds.
- `provider_price_history`: provider-sourced price series.

These records are cached or reproducible market data. They are shared by application users and are not included in a personal account export.

## Access to account data

Open **Settings → Account → Download my account data** in the running site. The server creates a JSON export for the signed-in user containing portfolios, trades, settings without the API key, imported prices, AI history, selections, and archived simulations.

The export deliberately excludes encrypted and plaintext API keys, platform user identifiers, and shared market caches. Keep downloaded exports private because they contain portfolio and analysis history.

## Change and deployment workflow

1. Create a branch from `main` and make the code change.
2. Review the Git diff or open a pull request so every change is visible.
3. Run TypeScript, lint, relevant regression tests, and the production build.
4. Merge the reviewed commit to GitHub `main`.
5. Publish the same commit to the existing Sites project.

Publishing a new commit updates the existing production deployment; it does not require changing the public site URL. A GitHub push by itself does not deploy the site, so GitHub and the Sites deployment commit should be kept aligned.

## Security rules

- Never commit `.env*`, API keys, database exports, `.wrangler/`, `.sites-runtime/`, or downloaded account exports.
- Do not store a production D1 dump in GitHub.
- Rotate the Sites encryption secret only with a migration plan for already-encrypted provider keys.
- Treat account exports as private files and delete old copies when they are no longer needed.

