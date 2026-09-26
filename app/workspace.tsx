'use client';
import { useEffect, useState, useRef } from 'react';
import { Activity, RefreshCw, Search, ShieldCheck, Wallet, ArrowUpRight, Database, Copy, ExternalLink, Settings2, ChevronDown, ArrowUpDown, Sparkles, LogOut, ChartNoAxesCombined } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { BROKERS, fees, totals, round, type Account, type Broker } from '@/lib/paper';
import { canTrade, MARKET_SOURCE, type MarketResponse, type Quote } from '@/lib/market';
import PriceHistoryChart from '@/components/price-history-chart';
import { parseCsv, mappedPoints } from '@/lib/history-csv';
import type { HistoryPoint } from '@/lib/insights';
import { insights } from '@/lib/insights';
import { translate, type Language, type ThemeChoice } from '@/lib/locale';
const money = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const price = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3, minimumFractionDigits: 2 }).format(n);
const signed = (n: number) => (n > 0 ? '+' : '') + money(n);
const time = (s: string, language: Language = 'ar') => new Date(s).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'short', timeStyle: 'short' });
const dubaiDay = (s: string) => new Date(s).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
type Data = MarketResponse & {
    history: {
        date: string;
        prices: Record<string, number>;
    }[];
};
type Order = {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    price: number;
    quoteDate: string;
    note: string;
    broker: Broker;
};
type SortKey = 'symbol' | 'price' | 'change' | 'sharia' | 'volume';
type PublicSettings = {
    provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'compatible';
    model: string;
    endpoint: string;
    configured: boolean;
    preferences: {
        defaultSharia: 'all' | 'approved' | 'unmarked';
        refreshMinutes: 0 | 5 | 15;
        compactRows: boolean;
    };
};
type OutlookEntry = {
    symbol: string;
    name: string;
    price: number;
    sharia: boolean;
    sessions: number;
    officialSessions: number;
    importedSessions: number;
    change5: number | null;
    action: string;
    outlook: string;
    reason: string;
    condition: string;
    quantity?: number;
    netExit?: number | null;
};
type PortfolioReport = {
    marketDate: string;
    horizon: 'week' | 'month';
    model: string;
    coverage: {
        eligible: number;
        listed: number;
        officialDates: number;
        holdings: number;
        imported: number;
    };
    overview: string;
    portfolio: OutlookEntry[];
    opportunities: OutlookEntry[];
    missingHoldings: {
        symbol: string;
        quantity: number;
    }[];
};
const defaultSettings: PublicSettings = { provider: 'openai', model: '', endpoint: '', configured: false, preferences: { defaultSharia: 'all', refreshMinutes: 5, compactRows: false } };
const sectors: Record<string, string> = { 'Financials': 'القطاع المالي', 'Industrials': 'الصناعة', 'Real Estate': 'العقارات', 'Utilities': 'المرافق', 'Communication Services': 'الاتصالات', 'Materials': 'المواد', 'Consumer Staples': 'السلع الأساسية', 'Consumer Discretionary': 'السلع الاستهلاكية', 'Real Estate Investment Trust': 'صناديق العقارات' };
export default function Workspace() {
    const [language, setLanguage] = useState<Language>('ar');
    const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
    const [appearanceReady, setAppearanceReady] = useState(false);
    const tr = (value: string) => translate(language, value);
    useEffect(() => {
        const savedLanguage = localStorage.getItem('tradelens-language');
        const savedTheme = localStorage.getItem('tradelens-theme');
        if (savedLanguage === 'en' || savedLanguage === 'ar')
            setLanguage(savedLanguage);
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')
            setThemeChoice(savedTheme);
        setAppearanceReady(true);
    }, []);
    useEffect(() => {
        if (!appearanceReady)
            return;
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        localStorage.setItem('tradelens-language', language);
    }, [language, appearanceReady]);
    useEffect(() => {
        if (!appearanceReady)
            return;
        const preference = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => { document.documentElement.dataset.theme = themeChoice === 'system' ? (preference.matches ? 'dark' : 'light') : themeChoice; };
        apply();
        preference.addEventListener('change', apply);
        localStorage.setItem('tradelens-theme', themeChoice);
        return () => preference.removeEventListener('change', apply);
    }, [themeChoice, appearanceReady]);
    const [account, setAccount] = useState<Account | null>(null), [version, setVersion] = useState(0), [data, setData] = useState<Data | null>(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [sector, setSector] = useState('all'), [activity, setActivity] = useState('all'), [sort, setSort] = useState<{
        key: SortKey;
        direction: 1 | -1;
    }>({ key: 'symbol', direction: 1 }), [settings, setSettings] = useState<PublicSettings>(defaultSettings), [settingsOpen, setSettingsOpen] = useState(false), [newKey, setNewKey] = useState(''), [clearKey, setClearKey] = useState(false), [settingsSaving, setSettingsSaving] = useState(false), [aiText, setAiText] = useState(''), [aiLoading, setAiLoading] = useState(false), [portfolioReport, setPortfolioReport] = useState<PortfolioReport | null>(null), [portfolioLoading, setPortfolioLoading] = useState(false), [portfolioError, setPortfolioError] = useState(''), [horizon, setHorizon] = useState<'week' | 'month'>('week'), [detailsOpen, setDetailsOpen] = useState(false), [demoText, setDemoText] = useState(''), [imported, setImported] = useState<HistoryPoint[]>([]), [officialPoints, setOfficialPoints] = useState<HistoryPoint[]>([]), [csvRows, setCsvRows] = useState<string[][]>([]), [dateCol, setDateCol] = useState(0), [priceCol, setPriceCol] = useState(1), [symbolCol, setSymbolCol] = useState(-1), [historyError, setHistoryError] = useState(''), [importSaving, setImportSaving] = useState(false), [symbol, setSymbol] = useState(''), [broker, setBroker] = useState<Broker>('alramz'), [tab, setTab] = useState('market'), [order, setOrder] = useState<Order | null>(null);
    const market = data?.market ?? null, summary = account ? totals(account, market) : null;
    const quotes = market?.quotes ?? [], current = quotes.find(q => q.symbol === symbol) ?? quotes.find(q => q.sharia && q.volume > 0) ?? quotes[0];
    const matched = quotes.filter(q => (filter === 'all' || (filter === 'approved' ? q.sharia : !q.sharia)) && (sector === 'all' || q.sector === sector) && (activity === 'all' || (activity === 'traded' ? q.lastTrade === market?.date && q.volume > 0 : q.lastTrade !== market?.date || q.volume <= 0)) && (q.symbol + ' ' + q.name + ' ' + (sectors[q.sector] || '')).toLowerCase().includes(query.toLowerCase())).sort((a, b) => { const key = sort.key; const n = key === 'symbol' ? a.symbol.localeCompare(b.symbol) : key === 'sharia' ? Number(a.sharia) - Number(b.sharia) : a[key] - b[key]; return n * sort.direction || a.symbol.localeCompare(b.symbol); });
    function openDetails(q: Quote) {
        const request = ++historyRequest.current;
        setSymbol(q.symbol);
        setDemoText('');
        setAiText('');
        setImported([]);
        setOfficialPoints([]);
        setCsvRows([]);
        setHistoryError('');
        setDetailsOpen(true);
        void fetch(`/api/history?symbol=${encodeURIComponent(q.symbol)}`, { cache: 'no-store' }).then(async (r) => {
            const d = await r.json() as {
                error?: string;
                points: HistoryPoint[];
                officialPoints: HistoryPoint[];
            };
            if (!r.ok)
                throw new Error(d.error);
            if (request === historyRequest.current) {
                setImported(d.points);
                setOfficialPoints(d.officialPoints);
            }
        }).catch(() => {
            if (request === historyRequest.current)
                setHistoryError('تعذّر تحميل الأسعار التاريخية المحفوظة.');
        });
    }
    const historyPoints: HistoryPoint[] = current ? [...new Map([...imported, ...officialPoints, ...(data?.history || []).flatMap(h => h.prices[current.symbol] ? [{ date: h.date, price: h.prices[current.symbol] }] : [])].map(p => [p.date, p])).values()].sort((a, b) => a.date.localeCompare(b.date)) : [];
    function demo() {
        if (!current || !market)
            return;
        setDemoText(insights(current, market.date, historyPoints, language));
    }
    async function selectCsv(file: File | undefined) {
        if (!file)
            return;
        setHistoryError('');
        if (file.size > 500000) {
            setHistoryError('اختر CSV أقل من 500 كيلوبايت.');
            return;
        }
        const rows = parseCsv(await file.text());
        if (rows.length < 3) {
            setHistoryError('الملف يحتاج صف عناوين وصفّين للأسعار على الأقل.');
            return;
        }
        setCsvRows(rows);
        const header = rows[0].map(x => x.toLowerCase());
        setDateCol(Math.max(0, header.findIndex(x => /date|تاريخ/.test(x))));
        setPriceCol(Math.max(0, header.findIndex(x => /clos|last price|سعر الإغلاق|اغلاق/.test(x))));
        setSymbolCol(header.findIndex(x => /symbol|ticker|رمز/.test(x)));
    }
    async function saveCsv() {
        if (!current)
            return;
        const points = mappedPoints(csvRows, dateCol, priceCol, symbolCol, current.symbol);
        if (points.length < 2) {
            setHistoryError('لم أجد سعرين صالحين لهذا السهم. راجع أعمدة التاريخ والإغلاق والرمز.');
            return;
        }
        setImportSaving(true);
        setHistoryError('');
        try {
            const r = await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: current.symbol, points }) });
            const d = await r.json() as {
                error?: string;
                points: HistoryPoint[];
            };
            if (!r.ok)
                throw new Error(d.error);
            setImported(d.points);
            setCsvRows([]);
            setNotice(language === "ar" ? `تم حفظ ${d.points.length} جلسة تاريخية لسهم ${current.symbol}.` : `Saved ${d.points.length} historical sessions for ${current.symbol}.`);
        }
        catch (e) {
            setHistoryError(e instanceof Error ? e.message : 'تعذّر حفظ التاريخ.');
        }
        finally {
            setImportSaving(false);
        }
    }
    function toggleSort(key: SortKey) { setSort(old => ({ key, direction: old.key === key && old.direction === 1 ? -1 : 1 })); }
    const historyRequest = useRef(0);
    const live = useRef({ account, data });
    live.current = { account, data };
    const pending = useRef(false);
    async function refresh() {
        if (pending.current)
            return;
        pending.current = true;
        setLoading(true);
        setError('');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        try {
            const results = await Promise.all([fetch('/api/market', { cache: 'no-store', signal: controller.signal }), fetch('/api/paper', { cache: 'no-store', signal: controller.signal })]);
            if (results.some(r => r.status === 401))
                throw new Error('انتهت جلسة الدخول. افتح تسجيل الدخول من الرابط أدناه.');
            const m = await results[0].json() as Data & {
                error?: string;
            };
            const a = await results[1].json() as {
                account: Account;
                version: number;
                error?: string;
            };
            if (!results[0].ok)
                throw new Error(m.error || 'تعذّر تحميل أسعار السوق.');
            setData(m);
            setPortfolioReport(null);
            if (!results[1].ok)
                throw new Error(a.error || 'تعذّر تحميل المحفظة.');
            setAccount(a.account);
            setVersion(a.version);
            if (!live.current.account)
                setBroker(a.account.broker);
        }
        catch (e) {
            setError(e instanceof Error && e.name === 'AbortError' ? 'استغرق التحديث وقتًا طويلًا. حاول مرة أخرى.' : e instanceof Error ? e.message : 'تعذّر التحديث. حاول مجددًا.');
        }
        finally {
            clearTimeout(timeout);
            setLoading(false);
            pending.current = false;
        }
    }
    useEffect(() => {
        void refresh();
        void fetch('/api/settings', { cache: 'no-store' }).then(async (r) => r.ok ? await r.json() as PublicSettings : null).then((s) => {
            if (s) {
                setSettings(s);
                setFilter(s.preferences.defaultSharia);
            }
        }).catch(() => { });
    }, []);
    useEffect(() => {
        if (!settings.preferences.refreshMinutes)
            return;
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible')
                void refresh();
        }, settings.preferences.refreshMinutes * 60000);
        return () => clearInterval(timer);
    }, [settings.preferences.refreshMinutes]);
    useEffect(() => {
        const doc = document as Document & {
            modelContext?: {
                registerTool: (tool: unknown, options: unknown) => Promise<void>;
            };
        };
        if (!doc.modelContext?.registerTool)
            return;
        const lifecycle = new AbortController();
        try {
            Promise.resolve(doc.modelContext.registerTool({ name: 'read_paper_portfolio', description: 'Read virtual AED portfolio and official DFM daily close metadata. No real orders or live quotes.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ mode: 'paper', currency: 'AED', ...live.current }) }, { signal: lifecycle.signal })).catch(() => { });
        }
        catch { }
        return () => lifecycle.abort();
    }, []);
    function review(q: Quote, side: 'buy' | 'sell', qty = 1) { setError(''); setOrder({ id: crypto.randomUUID(), symbol: q.symbol, side, qty, price: q.price, quoteDate: market!.date, note: '', broker }); }
    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!order || saving)
            return;
        setSaving(true);
        setError('');
        try {
            const r = await fetch('/api/paper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...order, version }) });
            const d = await r.json() as {
                account: Account;
                version: number;
                error?: string;
            };
            if (!r.ok)
                throw new Error(d.error);
            setAccount(d.account);
            setVersion(d.version);
            setPortfolioReport(null);
            setOrder(null);
            setTab('portfolio');
            setNotice('اتسجلت العملية الافتراضية وسعرها ورسومها. لا توجد حركة فلوس حقيقية.');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'تعذّر تأكيد الحفظ. حدّث المحفظة.');
        }
        finally {
            setSaving(false);
        }
    }
    async function savePreferences(e: React.FormEvent) {
        e.preventDefault();
        setSettingsSaving(true);
        setError('');
        try {
            const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: settings.provider, model: settings.model, endpoint: settings.endpoint, preferences: settings.preferences, apiKey: newKey || undefined, clearKey }) });
            const d = await r.json() as PublicSettings & {
                error?: string;
            };
            if (!r.ok)
                throw new Error(d.error);
            setSettings(d);
            setNewKey('');
            setClearKey(false);
            setSettingsOpen(false);
            setFilter(d.preferences.defaultSharia);
            setNotice('تم حفظ إعدادات الحساب.');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'تعذّر حفظ الإعدادات.');
        }
        finally {
            setSettingsSaving(false);
        }
    }
    async function research() {
        if (!current || aiLoading)
            return;
        setAiLoading(true);
        setAiText('');
        setError('');
        try {
            const r = await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: current.symbol, language }) });
            const d = await r.json() as {
                text: string;
                error?: string;
            };
            if (!r.ok)
                throw new Error(d.error);
            setAiText(d.text);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'تعذّر التحليل.');
        }
        finally {
            setAiLoading(false);
        }
    }
    async function reviewPortfolio() {
        if (portfolioLoading)
            return;
        setPortfolioLoading(true);
        setPortfolioError('');
        setPortfolioReport(null);
        try {
            const r = await fetch('/api/portfolio-outlook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizon, language }) });
            const d = await r.json() as PortfolioReport & {
                error?: string;
            };
            if (!r.ok)
                throw new Error(d.error || 'تعذّر إعداد التقرير.');
            setPortfolioReport(d);
        }
        catch (e) {
            setPortfolioError(e instanceof Error ? e.message : 'تعذّر مراجعة المحفظة.');
        }
        finally {
            setPortfolioLoading(false);
        }
    }
    async function copyPortfolio() {
        if (!account || !market)
            return;
        try {
            setNotice('جارٍ تحميل الجلسات القديمة من DFM…');
            const r = await fetch(`/api/portfolio-outlook?horizon=${horizon}&language=${language}`, { cache: 'no-store' });
            const d = await r.json() as {
                prompt?: string;
                error?: string;
            };
            if (!r.ok || !d.prompt)
                throw new Error(d.error || 'تعذّر إعداد الملخص.');
            await navigator.clipboard.writeText(d.prompt);
            setNotice('تم نسخ المحفظة وتاريخ السوق المتاح. الصقه في ChatGPT؛ سيبحث عن أي جلسات ناقصة بمصادرها.');
        }
        catch (e) {
            setPortfolioError(e instanceof Error ? e.message : 'تعذّر النسخ؛ جرّب متصفحًا يدعم الحافظة.');
        }
    }
    async function copy() {
        if (!current || !market)
            return;
        try {
            await navigator.clipboard.writeText(language === "en" ? `Analyze this stock for learning before any decision. Do not treat a single-day move as a forecast. Explain risks and missing data; do not guarantee returns or issue a religious ruling. Verify company news with dated sources before making a recommendation.\nSource: ${MARKET_SOURCE}\nDFM close on ${market.date} (AED):\n${JSON.stringify(current)}\nSaved history, possibly including user-imported CSV that has not been independently verified: ${JSON.stringify(historyPoints.slice(-60))}\nSharia marker comes from this dated DFM bulletin. Estimated trading fees: 0.275% + AED 10 per trade with 5% VAT on applicable fees. These data contain no live prices or financial fundamentals.` : `حلّل هذا السهم للتعلّم قبل اتخاذ قرار، ولا تعتبر حركة يوم واحد توقعًا. اشرح المخاطر وما البيانات الناقصة، ولا تعطِ ضمان ربح أو فتوى شرعية. تحقّق من أخبار وبيانات الشركة بمصادر مؤرخة قبل توصية.\nالمصدر: ${MARKET_SOURCE}\nأسعار إغلاق يوم ${market.date} بالدرهم الإماراتي:\n${JSON.stringify(current)}\nأسعار تاريخية محفوظة في التطبيق، وقد يكون بعضها من ملف استورده المستخدم ولم يتحقق منه التطبيق مستقلًا: ${JSON.stringify(historyPoints.slice(-60))}\nعلامة التوافق الشرعي مأخوذة من نشرة DFM في هذا التاريخ. رسوم التداول التقديرية: 0.275% + 10 AED لكل عملية، مع ضريبة 5% على الرسوم باستثناء رسم SCA. لا توجد أسعار لحظية أو أساسيات مالية في هذه البيانات.`);
            setNotice('تم نسخ بيانات البحث. الصقها في ChatGPT لطلب تحليل منفصل.');
        }
        catch {
            setError('تعذّر النسخ؛ يمكنك تحديد بيانات السهم ونسخها يدويًا.');
        }
    }
    const selectedOrder = quotes.find(q => q.symbol === order?.symbol), orderFee = order && Number.isFinite(order.qty) && order.qty > 0 ? fees(Math.round(order.qty * order.price * 100) / 100, order.broker) : null;
    const orderReason = order && selectedOrder && market ? canTrade(market, selectedOrder, data?.connection || '', order.side) : 'السعر غير متاح.';
    return <div className={`shell ${language === "ar" ? "arabic" : "english"}`} dir={language === "ar" ? "rtl" : "ltr"}>
 <header className="topbar"><a className="brand" href="/" dir="ltr"><span className="brandmark"><Activity size={23}/></span>Trade<span>Lens</span></a><div className="header-right"><span className="mode">{tr("أسهم حقيقية · رصيد افتراضي")}</span><DropdownMenu dir={language === "ar" ? "rtl" : "ltr"}><DropdownMenuTrigger className="avatar account-button" aria-label={tr("خيارات الحساب")} title={tr("خيارات الحساب")}>OE <ChevronDown size={13}/></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSettingsOpen(true)}><Settings2 size={16}/> {language === 'ar' ? 'إعدادات الحساب والمظهر' : 'Account and appearance'}</DropdownMenuItem><DropdownMenuItem onSelect={() => setTab("connections")}><Database size={16}/> {tr("المصادر والاتصالات")}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem asChild><a href="/signout-with-chatgpt?return_to=%2F" target="_top"><LogOut size={16}/> {tr("تسجيل الخروج")}</a></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
 <main><div className="pageheading"><div><p className="eyebrow">{tr("مساحة عمر للاستثمار")}</p><h1>{tr("جرّب قرارك. تابع نتيجته.")}</h1><p className="subtext">{tr("اختار سهمًا من سوق دبي، سجّل شراء افتراضي، وشوف المكسب أو الخسارة بعد الرسوم.")}</p></div><button className="secondary" onClick={refresh} disabled={loading || saving}><RefreshCw size={17} className={loading ? 'spin' : ''}/>{loading ? tr('جارٍ التحديث…') : tr('تحديث الأسعار')}</button></div>
 <div className="sample-banner"><Database size={19}/><span><strong>{market ? (language === "ar" ? `إغلاق جلسة ${market.date}` : `Session close ${market.date}`) : tr('تحميل النشرة الرسمية')}</strong> {tr("· أسعار يومية وليست لحظية. العملية محاكاة بسعر الإغلاق، وليست تنفيذًا فعليًا.")}</span><a className="textbutton" href={MARKET_SOURCE} target="_blank" rel="noreferrer">{tr("نشرة DFM")} <ExternalLink size={14}/></a></div>
 {data?.error && <div className="error" role="alert">{data.error}{market && (language === "ar" ? ` المعروض آخر نسخة محفوظة بتاريخ ${market.date}.` : ` Showing the latest cached bulletin dated ${market.date}.`)}</div>}{error && <div className="error" role="alert">{error}{error.includes('جلسة الدخول') ? <a className="textbutton" href="/signin-with-chatgpt?return_to=%2F" target="_top">{tr("تسجيل الدخول")}</a> : <button className="textbutton" disabled={saving} onClick={refresh}>{tr("إعادة التحميل")}</button>}</div>}{notice && <div className="notice" role="status">{tr(notice)}<button className="textbutton" onClick={() => setNotice('')}>{tr("إغلاق")}</button></div>}
 <div className="stats"><div><span>{tr("قيمة المحفظة الافتراضية")}</span><strong dir="ltr">{summary?.complete ? money(summary.equity) : '—'} <em>AED</em></strong><small>{tr("الرصيد + الأسهم بسعر آخر إغلاق")}</small></div><div><span>{tr("الرصيد المتاح للشراء")}</span><strong dir="ltr">{account ? money(account.cash) : '—'} <em>AED</em></strong><small>{tr("بداية التجربة: 10,000 درهم افتراضي")}</small></div><div><span>{tr("النتيجة لو بعت كل الأسهم")}</span><strong dir="ltr" className={summary && summary.net < 0 ? 'negative' : 'positive'}>{summary?.complete ? signed(summary.net) : '—'} <em>AED</em></strong><small>{tr("بعد رسوم الشراء وتقدير رسوم البيع")}</small></div><div><span>{tr("أسهم بعلامة توافق شرعي")}</span><strong>{market ? quotes.filter(q => q.sharia).length : '—'} <em>/ {quotes.length || '—'}</em></strong><small>{tr("حسب نشرة السوق بتاريخ الإغلاق")}</small></div></div>
 <Tabs value={tab} onValueChange={setTab} className="workspace-tabs" dir={language === "ar" ? "rtl" : "ltr"}><TabsList variant="line"><TabsTrigger value="market"><Search />{tr("اختيار الأسهم")}</TabsTrigger><TabsTrigger value="portfolio"><Wallet />{tr("محفظتي الافتراضية")}</TabsTrigger><TabsTrigger value="connections"><Database />{tr("المصادر والاتصالات")}</TabsTrigger></TabsList>
 <TabsContent value="market"><div className="market-layout"><section className="panel catalog"><div className="panelheading"><div><p className="eyebrow">{tr("01 / السوق")}</p><h2>{tr("أسهم تقدر تبدأ تتعرّف عليها")}</h2></div><span className="tag">{matched.length} {tr("نتيجة")}</span></div>
 <div className="market-controls"><Select value="dfm"><SelectTrigger aria-label={tr("السوق")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dfm">{tr("سوق دبي المالي · DFM · AED")}</SelectItem><SelectItem value="adx" disabled>{tr("سوق أبوظبي · غير متصل بعد")}</SelectItem><SelectItem value="us" disabled>{tr("السوق الأمريكي · غير متصل بعد")}</SelectItem></SelectContent></Select><div className="search"><Search size={16}/><input placeholder={tr("اسم الشركة أو كود السهم…")} aria-label={tr("بحث عن سهم")} value={query} onChange={e => setQuery(e.target.value)}/></div><Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label={tr("التوافق الشرعي")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approved">{tr("بعلامة توافق شرعي فقط")}</SelectItem><SelectItem value="all">{tr("كل الأسهم في المصدر")}</SelectItem><SelectItem value="unmarked">{tr("بدون علامة توافق")}</SelectItem></SelectContent></Select><Select value={sector} onValueChange={setSector}><SelectTrigger aria-label={tr("القطاع")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{tr("كل القطاعات")}</SelectItem>{[...new Set(quotes.map(q => q.sector))].map(s => <SelectItem value={s} key={s}>{language === 'ar' ? sectors[s] || s : s}</SelectItem>)}</SelectContent></Select><Select value={activity} onValueChange={setActivity}><SelectTrigger aria-label={tr("حالة التداول")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{tr("كل حالات التداول")}</SelectItem><SelectItem value="traded">{tr("تداولت في الجلسة")}</SelectItem><SelectItem value="stale">{tr("لم تتداول في الجلسة")}</SelectItem></SelectContent></Select></div>
 <div className={settings.preferences.compactRows ? "stock-scroll compact-rows" : "stock-scroll"}><Table><TableHeader><TableRow><TableHead><button className="sort-button" onClick={() => toggleSort("symbol")}>{tr("السهم / الشركة")} <ArrowUpDown size={14}/></button></TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("price")}>{tr("الإغلاق · AED")} <ArrowUpDown size={14}/></button></TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("change")}>{tr("تغيّر الجلسة")} <ArrowUpDown size={14}/></button></TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("volume")}>{tr("الحجم")} <ArrowUpDown size={14}/></button></TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("sharia")}>{tr("علامة الشريعة")} <ArrowUpDown size={14}/></button></TableHead></TableRow></TableHeader><TableBody>{matched.map(q => <TableRow key={q.symbol} className={current?.symbol === q.symbol ? 'selected-row' : ''}><TableCell><button className="stockbutton" onClick={() => openDetails(q)}><span className="ticker-icon">{q.symbol[0]}</span><span><strong dir="ltr">{q.symbol}</strong><small dir="ltr">{q.name}</small><small>{language === 'ar' ? sectors[q.sector] || q.sector : q.sector}</small></span></button></TableCell><TableCell><span dir="ltr">{price(q.price)}</span>{q.lastTrade !== market?.date && <small className="block negative">{tr("آخر تداول")} {q.lastTrade || tr('غير معروف')}</small>}</TableCell><TableCell><span dir="ltr" className={q.change < 0 ? 'negative' : 'positive'}>{signed(q.change)}%</span></TableCell><TableCell>{q.volume.toLocaleString("en-US")}</TableCell><TableCell><span className={q.sharia ? 'sharia-chip' : 'tag'}>{q.sharia ? tr('علامة DFM') : tr('غير مؤكد')}</span></TableCell></TableRow>)}</TableBody></Table></div>
 {!matched.length && <div className="empty">{loading ? tr('بنحمّل النشرة الرسمية…') : market ? tr('لا توجد نتائج بهذه الفلاتر.') : tr('الأسعار غير متاحة الآن. اضغط تحديث للمحاولة.')}</div>}<p className="panelnote">{tr("اضغط عنوان أي عمود للفرز. القائمة ليست ترشيحات شراء. تشمل الأسهم وصناديق العقارات الموجودة بالنشرة بسعر صالح؛ لا تشمل العقود الآجلة أو كل بورصات العالم.")}</p></section>
 <aside className="panel stock-detail">{current && market ? <><div className="panelheading"><div><p className="eyebrow">{tr("02 / افهم السهم")}</p><h2 dir="ltr">{current.symbol}</h2></div><ShieldCheck className={current.sharia ? 'positive' : ''}/></div><p className="company-name" dir="ltr">{current.name}</p><div className="priceheading"><strong dir="ltr">{price(current.price)} <small>AED</small></strong><span className={current.change < 0 ? 'negative' : 'positive'} dir="ltr">{signed(current.change)}%</span></div><p className="metadata">{tr("إغلاق")} {market.date} {tr("· آخر تداول")} {current.lastTrade || tr('غير متاح')}</p><dl className="stock-facts"><div><dt>{tr("القطاع")}</dt><dd>{sectors[current.sector] || current.sector}</dd></div><div><dt>{tr("إغلاق الجلسة السابقة")}</dt><dd dir="ltr">{price(current.previous)} AED</dd></div><div><dt>{tr("حجم تداول الجلسة")}</dt><dd>{current.volume.toLocaleString('en-US')} {tr("سهم")}</dd></div></dl><div className="sourcebox"><span>{tr("التوافق الشرعي")}</span><p>{current.sharia ? tr('السهم يحمل علامة توافق شرعي في نشرة سوق دبي بهذا التاريخ.') : tr('لا تظهر علامة توافق شرعي في النشرة. يمكنك تسجيل شراء افتراضي مع مراجعة الحالة بنفسك.')}</p><small>{tr("هذه علامة المصدر وليست فتوى من التطبيق. راجع منهج الفحص والتطهير مع جهة شرعية قبل التعامل الحقيقي.")}</small></div>
 <div className="broker-control"><label>{tr("03 / منصة محاكاة الرسوم")}</label><Select value={broker} onValueChange={v => setBroker(v as Broker)}><SelectTrigger aria-label={tr("منصة حساب الرسوم")}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(BROKERS).map(([id, b]) => <SelectItem key={id} value={id}>{b.name}</SelectItem>)}</SelectContent></Select><small>{tr("اختيارها لحساب الرسوم فقط؛ لا يفتح حسابًا ولا يربط أموالك.")}</small></div>
 <button className="secondary full detail-button" onClick={() => openDetails(current)}><ChartNoAxesCombined size={17}/>{tr("رسم السعر وتفاصيل السهم")}</button><button className="primary full" disabled={!account || loading || saving || !!canTrade(market, current, data?.connection || '', 'buy')} onClick={() => review(current, 'buy')}>{tr("مراجعة شراء افتراضي")} <ArrowUpRight size={18}/></button>{canTrade(market, current, data?.connection || '', 'buy') && <p className="panelnote negative">{canTrade(market, current, data?.connection || '', 'buy')}</p>}
 <button className="secondary full research-copy" onClick={settings.configured && settings.model ? research : () => setSettingsOpen(true)} disabled={aiLoading}><Sparkles size={16}/>{aiLoading ? tr("جارٍ التحليل…") : settings.configured && settings.model ? tr("تحليل السهم بالنموذج المحدد") : tr("ربط نموذج AI للتحليل")}</button>{aiText && <div className="ai-result" role="status"><strong>{tr("تحليل")} {current.symbol} · {settings.model}</strong><p>{aiText}</p></div>}<button className="textbutton" onClick={copy}><Copy size={16}/>{tr("نسخ بيانات السهم والتاريخ")}</button><a className="textbutton" href="https://chatgpt.com/" target="_blank" rel="noreferrer" onClick={() => void copy()}>{tr("انسخ وافتح ChatGPT")} <ExternalLink size={15}/></a><small>{tr("يعتمد التحليل على النشرة فقط؛ لا توجد أخبار أو أسعار لحظية في هذه البيانات.")}</small></> : <div className="empty">{tr("تفاصيل السهم هتظهر بعد تحميل النشرة.")}</div>}</aside></div></TabsContent>
 <TabsContent value="portfolio"><section className="panel portfolio-ai"><div className="panelheading"><div><p className="eyebrow">{tr("مراجعة المحفظة بالذكاء الاصطناعي")}</p><h2>{tr("أحتفظ بإيه وأراقب شراء إيه؟")}</h2></div><Sparkles size={24}/></div><p className="subtext">{tr("يقرأ أرصدتك وعملياتك الافتراضية ونشرات DFM القديمة قبل أول صفقة، ويعرض سيناريو صعود أو هبوط مشروطًا. لا ينفذ أوامر.")}</p><div className="portfolio-ai-controls"><Select value={horizon} onValueChange={v => { setHorizon(v as 'week' | 'month'); setPortfolioReport(null); }}><SelectTrigger aria-label={tr("فترة مراجعة المحفظة")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">{tr("الجلسات الخمس القادمة")}</SelectItem><SelectItem value="month">{tr("العشرون جلسة القادمة")}</SelectItem></SelectContent></Select><button className="primary" disabled={portfolioLoading || !market || !account} onClick={settings.configured && settings.model ? reviewPortfolio : () => setSettingsOpen(true)}>{portfolioLoading ? tr('جارٍ مراجعة المحفظة…') : settings.configured && settings.model ? tr('راجع المحفظة واقترح سيناريوهات') : tr('ربط نموذج AI للمراجعة')}</button><button className="secondary" onClick={() => void copyPortfolio()}>{tr("انسخ المحفظة وتاريخ DFM")} <Copy size={15}/></button><a className="secondary" href="https://chatgpt.com/" target="_blank" rel="noreferrer">{tr("افتح ChatGPT")} <ExternalLink size={15}/></a></div><p className="panelnote">{tr("يجلب التطبيق جلسات DFM القديمة تلقائيًا؛ الأسعار إغلاقات يومية وليست سعر الآن. يحتاج تقييم الاتجاه 10 جلسات للأسبوع أو 20 جلسة للشهر، والتاريخ المستورد من CSV لم يُتحقق منه. النتائج احتمالات للتجربة الافتراضية؛ الصعود السابق لا يضمن الصعود المقبل.")} <a href="https://www.dfm.ae/the-exchange/statistics-reports/historical-data/company-prices" target="_blank" rel="noreferrer">{tr("إضافة تاريخ من DFM")}</a>.</p>{portfolioError && <p className="negative" role="alert">{tr(portfolioError)}</p>}{portfolioReport && <div className="portfolio-report" role="status"><p className="metadata">{tr("إغلاق")} {portfolioReport.marketDate} · {portfolioReport.model} · {portfolioReport.coverage.eligible} {tr("من")} {portfolioReport.coverage.listed} {tr("سهم لديه")} {portfolioReport.horizon === 'week' ? 10 : 20} {tr("جلسة أو أكثر ·")} {portfolioReport.coverage.officialDates} {tr("تواريخ DFM محفوظة")}</p><p>{portfolioReport.overview}</p><h3>{tr("أسهمك الحالية")}</h3>{portfolioReport.portfolio.length ? portfolioReport.portfolio.map(item => <article className="outlook-card" key={item.symbol}><div className="outlook-heading"><strong dir="ltr">{item.symbol}</strong><span className="tag">{item.action === 'review_sell' ? tr('راجع البيع الافتراضي') : item.action === 'hold' ? tr('احتفاظ للمراجعة') : tr('بيانات غير كافية')}</span></div><p>{item.quantity} {tr("سهم · إغلاق")} {price(item.price)} {tr("AED · تغير 5 جلسات")} {item.change5 === null ? '—' : signed(item.change5) + '%'} {tr("· ربح/خسارة بعد بيع تقديري")} {item.netExit == null ? '—' : signed(item.netExit)} AED · {item.sharia ? tr('بعلامة DFM') : tr('بلا علامة DFM')}</p><p>{tr("السيناريو:")} {item.outlook === 'up' ? tr('ميل للصعود') : item.outlook === 'down' ? tr('ميل للهبوط') : tr('غير واضح')} · {item.reason}</p><small>{tr("ما الذي قد يغيّره؟")} {item.condition} · {item.sessions} {tr("جلسة (")}{item.officialSessions} {tr("من نشرات DFM،")} {item.importedSessions} {tr("مستوردة)")}</small>{item.action === 'review_sell' && <button className="secondary" disabled={!market || !account || !quotes.some(q => q.symbol === item.symbol) || !!canTrade(market, quotes.find(q => q.symbol === item.symbol)!, data?.connection || '', 'sell')} onClick={() => {
                        const q = quotes.find(q => q.symbol === item.symbol);
                        if (q && item.quantity)
                            review(q, 'sell', item.quantity);
                    }}>{tr("مراجعة بيع افتراضي")}</button>}</article>) : <p>{tr("لم تسجل شراء افتراضي بعد، لذلك لا توجد مراكز لقرار الاحتفاظ أو البيع.")}</p>}{portfolioReport.missingHoldings.map(x => <p className="negative" key={x.symbol}>{tr("لا يوجد إغلاق حالي لسهم")} {x.symbol} ({x.quantity} {tr("سهم)، فلا يمكن تقييمه الآن.")}</p>)}<h3>{tr("فرص شراء افتراضي للمراجعة")}</h3>{portfolioReport.opportunities.length ? portfolioReport.opportunities.map(item => <article className="outlook-card" key={item.symbol}><div className="outlook-heading"><strong dir="ltr">{item.symbol}</strong><span className="tag">{tr("مرشح للمراجعة")}</span></div><p>{tr("إغلاق")} {price(item.price)} {tr("AED · تغير 5 جلسات")} {item.change5 === null ? '—' : signed(item.change5) + '%'} · {item.sharia ? tr('بعلامة DFM') : tr('بلا علامة DFM')}</p><p>{item.reason}</p><small>{tr("السيناريو مشروط:")} {item.condition} · {item.sessions} {tr("جلسة (")}{item.officialSessions} {tr("من نشرات DFM،")} {item.importedSessions} {tr("مستوردة)")}</small><button className="textbutton" onClick={() => {
                    const q = quotes.find(q => q.symbol === item.symbol);
                    if (q)
                        openDetails(q);
                }}>{tr("افتح السهم والرسم")}</button></article>) : <p>{tr("لا يوجد مرشح شراء مدعوم بجلسات كافية حاليًا. أعد المراجعة إذا تعذّر جلب الأرشيف.")}</p>}</div>}</section><section className="panel"><div className="panelheading"><div><p className="eyebrow">{tr("تجربة بأموال افتراضية فقط")}</p><h2>{tr("الأسهم اللي اشتريتها")}</h2></div><button className="secondary" onClick={() => setTab('market')}>{tr("اختيار سهم")}</button></div>{summary && summary.positions.some(p => p.qty > 0) ? <Table><TableHeader><TableRow><TableHead>{tr("السهم")}</TableHead><TableHead>{tr("الكمية")}</TableHead><TableHead>{tr("تكلفة السهم مع رسوم الشراء")}</TableHead><TableHead>{tr("آخر إغلاق")}</TableHead><TableHead>{tr("الصافي بعد بيع تقديري")}</TableHead><TableHead>{tr("العملية")}</TableHead></TableRow></TableHeader><TableBody>{summary.positions.filter(p => p.qty > 0).map(p => { const q = quotes.find(q => q.symbol === p.symbol); const pnl = q ? p.qty * q.price - fees(p.qty * q.price, account!.broker).total - p.cost : null; return <TableRow key={p.symbol}><TableCell><button className="textbutton" dir="ltr" onClick={() => q && openDetails(q)}>{p.symbol}</button><small className="block" dir="ltr">{p.name}</small></TableCell><TableCell>{p.qty}</TableCell><TableCell dir="ltr">{price(p.cost / p.qty)}</TableCell><TableCell dir="ltr">{q ? price(q.price) : tr('غير متاح')}</TableCell><TableCell><span dir="ltr" className={pnl !== null && pnl < 0 ? 'negative' : 'positive'}>{pnl === null ? '—' : signed(pnl)}</span></TableCell><TableCell><button className="secondary" disabled={!q || !market || saving || loading || !!canTrade(market, q, data?.connection || '', 'sell')} onClick={() => q && review(q, 'sell', p.qty)}>{tr("بيع افتراضي")}</button></TableCell></TableRow>; })}</TableBody></Table> : <div className="empty"><Wallet size={32}/><h3>{tr("ابدأ بأول عملية افتراضية.")}</h3><p>{tr("معاك 10,000 درهم للتجربة. اختار سهمًا، حدد الكمية وراجع السعر والرسوم قبل التأكيد.")}</p><button className="primary" onClick={() => setTab('market')}>{tr("استكشاف الأسهم")}</button></div>}<div className="portfolio-foot"><span>{tr("رسوم مدفوعة:")} <b dir="ltr">{summary ? money(summary.paid) : '—'} AED</b></span><span>{tr("ربح / خسارة عمليات البيع:")} <b dir="ltr">{summary ? signed(summary.realized) : '—'} AED</b></span><span>{tr("رسوم بيع المتبقي التقديرية:")} <b dir="ltr">{summary ? money(summary.exitFees) : '—'} AED</b></span></div><p className="panelnote">{tr("الرسوم السنوية ورسوم البنك وتحويل العملة والتوزيعات وتجزئة الأسهم غير محسوبة. راجع أي إجراء رأسمالي قبل الاعتماد على النتيجة. الخسارة الصغيرة بعد الشراء مباشرة قد تكون بسبب رسوم الدخول والخروج.")}</p></section>
 <section className="panel history"><div className="panelheading"><div><h2>{tr("متابعة الإغلاق يومًا بيوم")}</h2><p className="subtext">{tr("نحفظ نشرة اليوم عند فتح التطبيق أو تحديثه. الأيام التي لم تُجمع بياناتها لا تظهر؛ لا توجد متابعة في الخلفية حاليًا.")}</p></div></div>{account && data && data.history.some(h => account.trades.some(t => dubaiDay(t.date) <= h.date)) ? <Table><TableHeader><TableRow><TableHead>{tr("تاريخ الإغلاق")}</TableHead><TableHead>{tr("الرصيد + الأسهم · AED")}</TableHead><TableHead>{tr("النتيجة بعد البيع التقديري · AED")}</TableHead></TableRow></TableHeader><TableBody>{data.history.slice().reverse().filter(h => account.trades.some(t => dubaiDay(t.date) <= h.date)).map(h => { const trades = account.trades.filter(t => dubaiDay(t.date) <= h.date); const cash = round(account.initial + trades.reduce((sum, t) => sum + (t.side === 'buy' ? -1 : 1) * round(t.qty * t.price) - t.fee, 0)); const historical = { ...account, cash, trades, broker: trades.at(-1)?.broker || account.broker }; const valuation = totals(historical, { date: h.date, fetchedAt: '', source: MARKET_SOURCE, quotes: Object.entries(h.prices).map(([symbol, price]) => ({ symbol, price })) as Quote[] }); return <TableRow key={h.date}><TableCell>{h.date}</TableCell><TableCell dir="ltr">{valuation.complete ? money(valuation.equity) : tr('سعر ناقص')}</TableCell><TableCell><span dir="ltr" className={valuation.net < 0 ? 'negative' : 'positive'}>{valuation.complete ? signed(valuation.net) : '—'}</span></TableCell></TableRow>; })}</TableBody></Table> : <p className="subtext">{tr("تظهر النتائج مع نشرات الإغلاق التالية لأول عملية. عملية عطلة نهاية الأسبوع تظهر في ملخص المحفظة الآن، ولا نرجع بتاريخها إلى جلسة سابقة.")}</p>}</section>
 <section className="panel history"><div className="panelheading"><h2>{tr("سجل عملياتك")}</h2><span className="metadata">{account?.trades.length || 0} {tr("عملية")}</span></div>{account?.trades.slice().reverse().map(t => <div className="journal" key={t.id}><span className="journal-icon"><ArrowUpRight /></span><div><strong>{t.side === 'buy' ? tr('شراء') : tr('بيع')} {t.qty} × <button className="textbutton" dir="ltr" onClick={() => {
                const q = quotes.find(q => q.symbol === t.symbol);
                if (q)
                    openDetails(q);
            }}>{t.symbol}</button></strong><p>{t.note || tr('بدون ملاحظة')}</p><small>{time(t.date, language)} {tr("بتوقيت دبي · سعر إغلاق")} {t.quoteDate}<br />{BROKERS[t.broker].name} {tr("· رسوم العملية")} {money(t.fee)} AED</small></div><b dir="ltr">{price(t.price)} AED<small className="block">{tr("سعر السهم المسجل")}</small></b></div>)}{!account?.trades.length && <p className="subtext">{tr("كل عملية تحفظ السعر والكمية والتاريخ والمنصة والرسوم.")}</p>}</section></TabsContent>
 <TabsContent value="connections"><div className="connection-grid"><section className="panel"><Database className="connection-icon"/><h2>{tr("أسعار سوق دبي")}</h2><span className="tag">{data?.connection === 'ok' ? tr('المصدر الرسمي متاح') : data?.connection === 'cached' ? tr('نسخة محفوظة · فشل التحديث') : tr('غير متاح الآن')}</span><p>{tr("نجلب نشرة الإغلاق الرسمية عند فتح التطبيق، ونفحص التحديث حسب إعداد حسابك أثناء ظهوره أمامك. قد تُستخدم نسخة مخزنة حتى 15 دقيقة.")}</p><p>{tr("تاريخ النشرة:")} {market?.date || '—'}<br />{tr("آخر تحقق:")} {market ? time(market.fetchedAt, language) : '—'} {tr("بتوقيت دبي.")}</p><a className="textbutton" href={MARKET_SOURCE} target="_blank" rel="noreferrer">{tr("فتح المصدر الرسمي")} <ExternalLink size={15}/></a></section><section className="panel"><ShieldCheck className="connection-icon"/><h2>{tr("الشرعية والرسوم")}</h2><p>{tr("علامة التوافق الشرعي تظهر كما وردت في النشرة، ولا تمنع المحاكاة للأسهم الأخرى. حالة الشركة قد تتغير؛ الحساب النقدي وغياب الاقتراض الربوي وإقراض الأسهم تحتاج مراجعة منفصلة مع الوسيط.")}</p><p>{tr("نحسب الرسوم القياسية لسوق دبي لكل شراء وكل بيع: 0.275% من القيمة + 10 دراهم، وضريبة 5% على الرسوم باستثناء رسم SCA. قد يختلف عقدك أو العرض المتاح لك.")}</p>{Object.entries(BROKERS).map(([id, b]) => <p key={id}><a className="textbutton" href={b.source} target="_blank" rel="noreferrer">{tr("جدول")} {b.name} <ExternalLink size={14}/></a></p>)}<small>{tr("مراجعة جداول الرسوم: 26 سبتمبر 2026. اختيار وسيط هنا لا يعني اعتماد جميع خدماته شرعيًا.")}</small></section><section className="panel"><Wallet className="connection-icon"/><h2>{tr("الذكاء الاصطناعي والوسيط")}</h2><span className="tag">{settings.configured && settings.model ? (language === "ar" ? `نموذج ${settings.model} مهيأ` : `Model ${settings.model} is configured`) : tr("الـAI غير مهيأ")}</span><p>{tr("التطبيق يسجل عمليات افتراضية فقط؛ لا يستقبل أموالًا ولا ينفّذ أوامر بحساب تداول حقيقي.")}</p><p>{tr("يمكنك إضافة مفتاح API واسم نموذج من قائمة الحساب. التحليل داخل التطبيق يعتمد على بيانات نشرة DFM فقط؛ لا توجد أخبار تلقائية. اتصال الوسيط غير متاح.")}</p><p>{tr("سوق أبوظبي والأسواق الأمريكية غير متصلة في هذه النسخة.")}</p></section></div><section className="panel methodology"><h2>{tr("تجاربك السابقة محفوظة")}</h2><p>{tr("المحفظة القديمة بالدولار والأسهم الخيالية منفصلة تمامًا عن حساب تجربة سوق دبي بالدرهم.")}</p><a href="/legacy" className="textbutton">{tr("فتح مساحة التجارب القديمة")}</a></section></TabsContent>
 </Tabs><footer><span dir="ltr">TradeLens / DFM Paper Portfolio</span><span>{tr("أسعار إغلاق يومية · درهم إماراتي · لا يوجد تنفيذ بأموال حقيقية")}</span></footer></main>
 <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}><DialogContent className="history-dialog" dir={language === "ar" ? "rtl" : "ltr"}><DialogTitle>{current?.name} · {current?.symbol}</DialogTitle><DialogDescription>{tr("حركة الإغلاق التاريخية وبيانات DFM. أي ملف تستورده يُعرض كمصدر من المستخدم.")}</DialogDescription>{current && market && <><div className="history-chart-head"><strong>{tr("السعر عبر الأيام والأسابيع")}</strong><span>{tr("المحور الأفقي: التاريخ · العمودي: سعر السهم بالدرهم")}</span></div><PriceHistoryChart points={historyPoints} language={language} theme={themeChoice}/><p className="history-source">{tr("الرسم من نشرات DFM القديمة التي يجلبها التطبيق وجلساته المحفوظة ومن ملف CSV الذي تختاره أنت. الملف المستورد لم يتحقق منه التطبيق مقابل السوق.")} <a href="https://www.dfm.ae/the-exchange/statistics-reports/historical-data/company-prices" target="_blank" rel="noreferrer">{tr("تنزيل التاريخ الرسمي من DFM")}</a> {tr("(اختر الشركة والفترة ثم احفظ ملف Excel بصيغة CSV).")}</p><div className="history-import"><h3>{tr("أضف الأسعار السابقة للرسم")}</h3><p>{tr("استورد CSV بعمود للتاريخ وعمود لسعر الإغلاق، وعمود للرمز إذا ضم الملف عدة شركات. يُحفظ لسهمك فقط.")}</p><input aria-label={tr("ملف الأسعار CSV")} type="file" accept=".csv,text/csv" onChange={e => void selectCsv(e.target.files?.[0])}/>{csvRows.length > 0 && <><p>{tr("وجدت")} {csvRows.length - 1} {tr("صف. طابق الأعمدة قبل الحفظ:")}</p><div className="history-mapping"><label>{tr("التاريخ")}<select value={dateCol} onChange={e => setDateCol(Number(e.target.value))}>{csvRows[0].map((h, i) => <option key={i} value={i}>{h || (language === "ar" ? `عمود ${i + 1}` : `Column ${i + 1}`)}</option>)}</select></label><label>{tr("سعر الإغلاق")}<select value={priceCol} onChange={e => setPriceCol(Number(e.target.value))}>{csvRows[0].map((h, i) => <option key={i} value={i}>{h || (language === "ar" ? `عمود ${i + 1}` : `Column ${i + 1}`)}</option>)}</select></label><label>{tr("الرمز")}<select value={symbolCol} onChange={e => setSymbolCol(Number(e.target.value))}><option value={-1}>{tr("الملف لهذا السهم فقط")}</option>{csvRows[0].map((h, i) => <option key={i} value={i}>{h || (language === "ar" ? `عمود ${i + 1}` : `Column ${i + 1}`)}</option>)}</select></label></div><small>{tr("معاينة:")} {mappedPoints(csvRows, dateCol, priceCol, symbolCol, current.symbol).length} {tr("جلسة صالحة؛ أول سعر")} {mappedPoints(csvRows, dateCol, priceCol, symbolCol, current.symbol)[0]?.price ?? "—"} {tr("وآخر سعر")} {mappedPoints(csvRows, dateCol, priceCol, symbolCol, current.symbol).at(-1)?.price ?? "—"} {tr("AED. تأكد من الفاصلة العشرية قبل الحفظ.")}</small><button className="secondary" disabled={importSaving} onClick={saveCsv}>{importSaving ? tr('جارٍ الحفظ…') : tr('إضافة بيانات الملف للرسم')}</button></>}{historyError && <p className="negative" role="alert">{tr(historyError)}</p>}</div><div className="history-facts"><div><span>{tr("إغلاق DFM")}</span><strong dir="ltr">{price(current.price)} AED</strong></div><div><span>{tr("التغير عن السابق")}</span><strong dir="ltr" className={current.change < 0 ? 'negative' : 'positive'}>{signed(current.change)}%</strong></div><div><span>{tr("حجم التداول")}</span><strong>{current.volume.toLocaleString('en-US')}</strong></div><div><span>{tr("التوافق الشرعي")}</span><strong>{current.sharia ? tr('علامة DFM') : tr('بلا علامة')}</strong></div></div><div className="history-section"><h3>{tr("تجربة التحليل")}</h3><p>{tr("اقرأ شرحًا مبسطًا للأرقام دون مفتاح API. وعند ضبط نموذجك يمكنك اختباره بطلب تحليل حقيقي.")}</p><div className="history-actions"><button className="secondary" onClick={demo}>{tr("جرّب بدون API")}</button><a className="secondary" href="https://chatgpt.com/" target="_blank" rel="noreferrer" onClick={() => void copy()}>{tr("انسخ وافتح ChatGPT")} <ExternalLink size={15}/></a><button className="primary" disabled={!settings.configured || !settings.model || aiLoading} onClick={research}>{aiLoading ? tr('جارٍ اختبار الاتصال…') : tr('اختبار النموذج الحقيقي')}</button></div>{!settings.configured && <small>{tr("القراءة الحسابية تجريبية بلا نموذج AI. زر ChatGPT ينسخ البيانات لتلصقها هناك بحسابك؛ النتيجة لا ترجع تلقائيًا للتطبيق. للتحليل داخل التطبيق أضف مفتاح المزود واسم النموذج.")}</small>}{demoText && <div className="ai-result" role="status"><strong>{tr("قراءة حسابية تجريبية")}</strong><p>{demoText}</p></div>}{aiText && <div className="ai-result" role="status"><strong>{tr("استجابة")} {settings.model}</strong><p>{aiText}</p></div>}{error && <p className="negative" role="alert">{error}</p>}</div><div className="history-section"><h3>{tr("جلسات الرسم المسجلة")}</h3><p>{tr("تشمل نشرات DFM السابقة والمحلية والأسعار التي استوردتها. الأيام غير الموجودة لا تظهر هنا.")}</p><div className="snapshot-list">{historyPoints.slice(-30).reverse().map(h => <div key={h.date}><span>{h.date}</span><b dir="ltr">{price(h.price)} AED</b></div>)}{!historyPoints.length && <small>{tr("لا توجد جلسات محفوظة بعد.")}</small>}</div></div><div className="history-section"><h3>{tr("عملياتك الافتراضية على السهم")}</h3>{account?.trades.filter(t => t.symbol === current.symbol).slice().reverse().map(t => <div className="history-trade" key={t.id}><span>{t.side === 'buy' ? tr('شراء') : tr('بيع')} {t.qty} {tr("سهم ·")} {time(t.date, language)}</span><b dir="ltr">{price(t.price)} AED</b></div>)}{!account?.trades.some(t => t.symbol === current.symbol) && <p>{tr("لم تسجل عمليات افتراضية لهذا السهم.")}</p>}<a className="textbutton" target="_blank" rel="noreferrer" href={`https://www.dfm.ae/the-exchange/market-information/company/${encodeURIComponent(current.symbol)}`}>{tr("صفحة الشركة في DFM")} <ExternalLink size={14}/></a></div></>}</DialogContent></Dialog>
 <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="settings-dialog" dir={language === "ar" ? "rtl" : "ltr"}><DialogTitle>{tr("إعدادات الحساب")}</DialogTitle><DialogDescription>{tr("خيارات العرض والبحث واتصال نموذج الذكاء الاصطناعي.")}</DialogDescription><form onSubmit={savePreferences} className="settings-form"><section className="appearance-settings"><h3>{language === 'ar' ? tr('المظهر واللغة') : 'Appearance and language'}</h3><div className="appearance-grid"><label>{language === 'ar' ? tr('المظهر') : 'Theme'}<Select value={themeChoice} onValueChange={v => setThemeChoice(v as ThemeChoice)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">{language === 'ar' ? tr('حسب الجهاز') : 'Use device setting'}</SelectItem><SelectItem value="light">{language === 'ar' ? tr('فاتح') : 'Light'}</SelectItem><SelectItem value="dark">{language === 'ar' ? tr('داكن') : 'Dark'}</SelectItem></SelectContent></Select></label><label>{language === 'ar' ? tr('لغة الواجهة') : 'Interface language'}<Select value={language} onValueChange={v => setLanguage(v as Language)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ar">العربية</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></label></div><p className="appearance-hint">{language === 'ar' ? tr('التغييرات تظهر فورًا وتُحفظ على هذا الجهاز. بيانات المحفظة لا تتغير.') : 'Changes apply immediately and are saved on this device. Your portfolio data stay the same.'}</p></section><h3>{tr("نموذج AI")}</h3><label>{tr("مزود الخدمة")}<Select value={settings.provider} onValueChange={v => {
            if (v !== settings.provider) {
                setSettings({ ...settings, provider: v as PublicSettings['provider'], model: v === 'openrouter' ? 'openrouter/free' : '', endpoint: '', configured: false });
                setNewKey('');
                setClearKey(false);
            }
        }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai">{tr("OpenAI API (مفتاح مستقل)")}</SelectItem><SelectItem value="anthropic">Anthropic / Claude API</SelectItem><SelectItem value="gemini">Google Gemini API</SelectItem><SelectItem value="openrouter">OpenRouter API</SelectItem><SelectItem value="compatible">{tr("مزود متوافق مع OpenAI API")}</SelectItem></SelectContent></Select></label><label>{tr("اسم النموذج (Model ID)")}<input dir="ltr" autoComplete="off" placeholder={settings.provider === 'openrouter' ? tr('openrouter/free أو nvidia/nemotron-3-super-120b-a12b:free') : tr('اكتب اسم النموذج لدى مزودك')} value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })}/></label>{settings.provider === 'openrouter' && <p className="panelnote">{tr("عنوان الاتصال يُضبط تلقائيًا. يمكنك تجربة")} <code dir="ltr">openrouter/free</code> {tr("أو")} <code dir="ltr">nvidia/nemotron-3-super-120b-a12b:free</code> {tr("حسب إتاحته وحدود الاستخدام. تحتاج مفتاح OpenRouter حتى للنماذج المجانية.")} <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">{tr("إنشاء مفتاح")}</a> · <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">{tr("قائمة النماذج")}</a>.</p>}{settings.provider === 'compatible' && <label>{tr("رابط Chat Completions الكامل")}<input dir="ltr" type="url" placeholder="https://example.com/v1/chat/completions" value={settings.endpoint} onChange={e => setSettings({ ...settings, endpoint: e.target.value })}/></label>}{settings.provider === 'compatible' && <p className="panelnote">{tr("هذا رابط نقطة API لدى المزود، وليس رابط محادثة ChatGPT. هذا الاتصال يحتاج مفتاح API خاص بالمزود.")}</p>}<label>{tr("مفتاح API")} <small>{settings.configured && !clearKey ? tr('مفتاح محفوظ؛ اترك الخانة فارغة للإبقاء عليه.') : tr('المفتاح غير محفوظ.')}</small><input dir="ltr" type="password" autoComplete="new-password" placeholder={tr("ألصق مفتاح API هنا")} value={newKey} onChange={e => { setNewKey(e.target.value); setClearKey(false); }}/></label>{settings.configured && <label className="inline-check"><input type="checkbox" checked={clearKey} onChange={e => setClearKey(e.target.checked)}/>{tr("حذف المفتاح المحفوظ")}</label>}<p className="panelnote">{tr("اشتراك ChatGPT ومحادثاتك لا تتحول إلى مفتاح API ولا تُستهلك حصتها هنا. عند تغيير المزود يُفصل المفتاح السابق؛ أدخل مفتاح المزود الجديد. يُحفظ المفتاح مشفرًا لحسابك، ولا يُعرض مرة أخرى. طلبات التحليل تُرسل إلى المزود الذي تختاره وقد تُحتسب ضمن فاتورته. رابط المزود المخصص يستقبل مفتاحك وبيانات السهم.")}</p><h3>{tr("عرض السوق")}</h3><label>{tr("فلتر الشريعة عند الفتح")}<Select value={settings.preferences.defaultSharia} onValueChange={v => setSettings({ ...settings, preferences: { ...settings.preferences, defaultSharia: v as PublicSettings['preferences']['defaultSharia'] } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{tr("كل الأسهم")}</SelectItem><SelectItem value="approved">{tr("بعلامة توافق فقط")}</SelectItem><SelectItem value="unmarked">{tr("بدون علامة")}</SelectItem></SelectContent></Select></label><label>{tr("تحديث بيانات السوق")}<Select value={String(settings.preferences.refreshMinutes)} onValueChange={v => setSettings({ ...settings, preferences: { ...settings.preferences, refreshMinutes: Number(v) as 0 | 5 | 15 } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="5">{tr("كل 5 دقائق")}</SelectItem><SelectItem value="15">{tr("كل 15 دقيقة")}</SelectItem><SelectItem value="0">{tr("يدوي فقط")}</SelectItem></SelectContent></Select></label><label className="inline-check"><input type="checkbox" checked={settings.preferences.compactRows} onChange={e => setSettings({ ...settings, preferences: { ...settings.preferences, compactRows: e.target.checked } })}/>{tr("صفوف مدمجة في جدول الأسهم")}</label><section className="profile-settings"><h3>{language === 'ar' ? tr('الحساب') : 'Account'}</h3><p>{language === 'ar' ? tr('محفظتك الافتراضية وإعدادات نموذج AI مرتبطة بحسابك. إعدادات المظهر واللغة محفوظة على هذا الجهاز.') : 'Your virtual portfolio and AI model settings belong to your account. Appearance and language are saved on this device.'}</p><a className="textbutton" href="/signout-with-chatgpt?return_to=%2F" target="_top"><LogOut size={15}/>{language === 'ar' ? tr('تسجيل الخروج') : 'Sign out'}</a></section>{error && <p className="negative" role="alert">{error}</p>}<button className="primary full" disabled={settingsSaving}>{settingsSaving ? tr('جارٍ الحفظ…') : tr('حفظ الإعدادات')}</button></form></DialogContent></Dialog>
 <Dialog open={!!order} onOpenChange={v => {
            if (!v && !saving)
                setOrder(null);
        }}><DialogContent className="paper-dialog" dir={language === "ar" ? "rtl" : "ltr"}><DialogTitle>{tr("مراجعة")} {order?.side === 'buy' ? tr('شراء') : tr('بيع')} {tr("افتراضي")}</DialogTitle><DialogDescription>{tr("محاكاة بسعر الإغلاق المنشور، ولا تضمن إمكانية تنفيذ هذا السعر فعليًا.")}</DialogDescription>{order && <form onSubmit={submit}><h3 dir="ltr">{order.symbol} · {price(order.price)} AED</h3><p className="metadata">{tr("نشرة")} {order.quoteDate} · {BROKERS[order.broker].name}</p><label>{tr("عدد الأسهم")}<input type="number" required min="1" max="10000000" step="1" value={Number.isNaN(order.qty) ? '' : order.qty} onChange={e => setOrder({ ...order, qty: e.target.value === '' ? NaN : Number(e.target.value) })}/></label><label>{tr("سبب القرار (اختياري)")}<textarea maxLength={500} value={order.note} onChange={e => setOrder({ ...order, note: e.target.value })}/></label>{orderFee && <dl className="stock-facts"><div><dt>{tr("قيمة الأسهم")}</dt><dd dir="ltr">{money(order.qty * order.price)} AED</dd></div><div><dt>{tr("العمولات النسبية")}</dt><dd dir="ltr">{money(orderFee.commission)} AED</dd></div><div><dt>{tr("الرسم الثابت")}</dt><dd dir="ltr">10.00 AED</dd></div><div><dt>{tr("ضريبة الرسوم")}</dt><dd dir="ltr">{money(orderFee.vat)} AED</dd></div><div><dt>{tr("إجمالي رسوم العملية")}</dt><dd dir="ltr">{money(orderFee.total)} AED</dd></div><div><dt>{order.side === 'buy' ? tr('إجمالي الخصم') : tr('صافي حصيلة البيع')}</dt><dd dir="ltr">{money(Math.round(order.qty * order.price * 100) / 100 + (order.side === 'buy' ? orderFee.total : -orderFee.total))} AED</dd></div></dl>}{order.side === 'buy' && selectedOrder && !selectedOrder.sharia && <p className="panelnote">{tr("هذا السهم لا يحمل علامة توافق شرعي في النشرة. العملية افتراضية؛ راجع الحالة بنفسك قبل أي تعامل حقيقي.")}</p>}{orderReason && <p className="negative">{orderReason}</p>}{error && <p className="negative" role="alert">{error}</p>}<button className="primary full" disabled={saving || !account || !!orderReason || !Number.isSafeInteger(order.qty) || order.qty < 1}>{saving ? tr('جارٍ الحفظ…') : tr('تأكيد العملية الافتراضية')}</button><small>{tr("الشراء والبيع لهما رسوم مستقلة. قد توجد فروق تقريب بسيطة عن كشف الوسيط.")}</small></form>}</DialogContent></Dialog>
 </div>;
}
