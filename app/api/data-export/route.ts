import { database } from '@/db/store';

export const dynamic = 'force-dynamic';

type JsonRecord = Record<string, unknown>;

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function sanitizeSettings(row: JsonRecord | null): JsonRecord | null {
  if (!row) return null;
  const data = parseJson(row.data);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ...row, data: null };
  }

  const { secret: _encryptedApiKey, apiKey: _plainApiKey, ...safeData } = data as JsonRecord;
  return { ...row, data: safeData, apiKeyIncluded: false };
}

function parseRows(rows: JsonRecord[], fields: string[] = ['data']): JsonRecord[] {
  return rows.map((row) => {
    const next = { ...row };
    for (const field of fields) {
      if (field in next) next[field] = parseJson(next[field]);
    }
    return next;
  });
}

async function rows(sql: string, userId: string): Promise<JsonRecord[]> {
  const result = await database().prepare(sql).bind(userId).all<JsonRecord>();
  return result.results ?? [];
}

export async function GET(request: Request) {
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId) {
    return Response.json({ error: 'تسجيل الدخول مطلوب.' }, { status: 401 });
  }

  try {
    const [
      legacyPortfolios,
      paperAccounts,
      marketAccounts,
      settingsRows,
      importedPriceHistory,
      aiHistory,
      aiSelections,
      simulationArchives,
    ] = await Promise.all([
      rows('SELECT data, version FROM portfolios WHERE user_id=?', userId),
      rows('SELECT data, version FROM paper_accounts WHERE user_id=?', userId),
      rows('SELECT market, currency, data, version FROM market_accounts WHERE user_id=? ORDER BY market, currency', userId),
      rows('SELECT data, updated_at FROM user_settings WHERE user_id=?', userId),
      rows('SELECT symbol, data, updated_at FROM user_price_history WHERE user_id=? ORDER BY symbol, updated_at', userId),
      rows('SELECT id, scope, kind, market, currency, subject, model, created_at, prompt, result FROM ai_history WHERE user_id=? ORDER BY created_at, id', userId),
      rows('SELECT history_id FROM ai_selections WHERE user_id=? ORDER BY history_id', userId),
      rows('SELECT id, market, currency, label, created_at, data FROM simulation_archives WHERE user_id=? ORDER BY created_at, id', userId),
    ]);

    const payload = {
      format: 'tradelens-account-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      security: {
        apiKeysIncluded: false,
        note: 'Encrypted and plaintext API keys are intentionally excluded.',
      },
      account: {
        legacyPortfolios: parseRows(legacyPortfolios),
        paperAccounts: parseRows(paperAccounts),
        marketAccounts: parseRows(marketAccounts),
        settings: sanitizeSettings(settingsRows[0] ?? null),
        importedPriceHistory: parseRows(importedPriceHistory),
        aiHistory: parseRows(aiHistory, ['result']),
        aiSelections,
        simulationArchives: parseRows(simulationArchives),
      },
    };

    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="tradelens-account-${date}.json"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return Response.json(
      { error: 'تعذّر تجهيز نسخة البيانات. حاول مرة أخرى.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

