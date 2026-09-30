'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Activity, RefreshCw, Search, ShieldCheck, Wallet, ArrowUpRight, Database, Copy, ExternalLink, Settings2, ChevronDown, ArrowUpDown, Sparkles, LogOut, ChartNoAxesCombined } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { BROKERS, fees, totals, round, type Account, type Broker } from '@/lib/paper';
import {MARKETS,tradingCurrency,companyUrl,type MarketId} from '@/lib/markets';
import { canTrade, MARKET_SOURCE, type MarketResponse, type Quote } from '@/lib/market';
import {useStockRankings,RankingToolbar,RankingCell} from '@/components/stock-rankings';
import DecisionCard from '@/components/decision-card';
import type {Decision,DecisionPlan} from '@/lib/decision-plan';
import {DECISION_INSTRUCTIONS} from '@/lib/decision-plan';
import BrokerCosts from '@/components/broker-costs';
import SimulationSettings from '@/components/simulation-settings';
import PortfolioSummary from '@/components/portfolio-summary';
import PortfolioOverview from '@/components/portfolio-overview';
import TransactionHistory from '@/components/transaction-history';
import DashboardSection from '@/components/dashboard-section';
import MiniTrend from '@/components/mini-trend';
import {holdingSeries} from '@/lib/holding-view';
import CopyChatGPT from '@/components/copy-chatgpt';
import ResearchHistory from '@/components/research-history';
import {analysisParams,type AnalysisScope,type AnalysisRecord} from '@/lib/ai-history';
import PriceHistoryChart from '@/components/price-history-chart';
import { parseCsv, mappedPoints } from '@/lib/history-csv';
import type { HistoryPoint } from '@/lib/insights';
import { insights } from '@/lib/insights';
import { translate, type Language, type ThemeChoice } from '@/lib/locale';
const money = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const price = (n: number) => !Number.isFinite(n)||n<=0?'—':new Intl.NumberFormat('en-US', { maximumFractionDigits: n<0.01?8:3, minimumFractionDigits: 2 }).format(n);
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
type SortKey = 'symbol' | 'price' | 'change' | 'sharia' | 'volume' | 'score';
type PublicSettings = {
    provider: 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'compatible';
    model: string;
    endpoint: string;
    configured: boolean;
    preferences: {
        defaultSharia: 'all' | 'approved' | 'unmarked';
        refreshMinutes: 0 | 1 | 5 | 15;
        compactRows: boolean;
    };
};
type OutlookEntry = {
    decision?:Decision|DecisionPlan;
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
type Citation = {url:string;title:string;startIndex?:number;endIndex?:number};
type SavedMeta = {historyId?:string;createdAt?:string;model?:string;saved?:boolean;saveError?:string};
type StockAnalysis = SavedMeta & {decision?:DecisionPlan;text:string;citations?:Citation[];webSearchUsed?:boolean;coverage?:{sessions:number;official:number;imported:number;first?:string;last?:string}};
type PortfolioReport = SavedMeta & {citations?:Citation[];webSearchUsed?:boolean;
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
const defaultSettings: PublicSettings = { provider: 'openai', model: 'gpt-6-luna', endpoint: '', configured: false, preferences: { defaultSharia: 'all', refreshMinutes: 1, compactRows: false } };
const sectors: Record<string, string> = { 'Financials': 'القطاع المالي', 'Industrials': 'الصناعة', 'Real Estate': 'العقارات', 'Utilities': 'المرافق', 'Communication Services': 'الاتصالات', 'Materials': 'المواد', 'Consumer Staples': 'السلع الأساسية', 'Consumer Discretionary': 'السلع الاستهلاكية', 'Real Estate Investment Trust': 'صناديق العقارات' };
export default function Workspace() {
    const [selectedMarket,setSelectedMarket]=useState<MarketId>('dfm');
    const [walletCurrency,setWalletCurrency]=useState('AED');
    const [page,setPage]=useState(0);
    const [usExchange,setUsExchange]=useState('all');
    const [feePercent,setFeePercent]=useState(0),[feeFixed,setFeeFixed]=useState(0);
    const marketName=MARKETS[selectedMarket];
    const sourceUrl=MARKETS[selectedMarket].source;
    const isDfm=selectedMarket==='dfm';
    const [language, setLanguage] = useState<Language>('ar');
    const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
    const [appearanceReady, setAppearanceReady] = useState(false);
    const tr = (value: string) => {
        const labels:Record<string,[string,string]>={
          'اختار سهمًا من سوق دبي، سجّل شراء افتراضي، وشوف المكسب أو الخسارة بعد الرسوم.':['اختار السوق والسهم، وسجّل تجربة مستقلة بعملة التداول.','Choose a market and stock. Each portfolio uses its trading currency.'],
          'بداية التجربة: 10,000 درهم افتراضي':[`بداية المحفظة: 10,000 ${walletCurrency} افتراضي`,`Starting balance: 10,000 virtual ${walletCurrency}`],
          'معاك 10,000 درهم للتجربة. اختار سهمًا، حدد الكمية وراجع السعر والرسوم قبل التأكيد.':[`معاك 10,000 ${walletCurrency} افتراضي في المحفظة دي. راجع السعر والكمية والرسوم قبل التأكيد.`,`This wallet starts with 10,000 virtual ${walletCurrency}. Review price, quantity and fees before confirming.`],
          'أسعار سوق دبي':[marketName.ar,marketName.en],
          'إغلاق':['سعر','Price'],
          'آخر إغلاق':['آخر سعر','Latest price'],
          'الرصيد + الأسهم بسعر آخر إغلاق':['الرصيد + قيمة الأسهم بالسعر المعروض','Cash + holdings at the displayed price'],
          'أسهم بعلامة توافق شرعي':[isDfm?'أسهم بعلامة توافق شرعي':'أسهم لها سعر متاح',isDfm?'Sharia-marked stocks':'Stocks with available prices'],
          'حسب نشرة السوق بتاريخ الإغلاق':[isDfm?'حسب نشرة السوق بتاريخ الإغلاق':'التصنيف الشرعي غير متاح من هذا المصدر',isDfm?'As marked in the dated bulletin':'Sharia classification is unavailable from this source'],
          'إغلاق · AED':[`السعر · ${walletCurrency}`,`Price · ${walletCurrency}`],
          'إغلاق DFM':['سعر المصدر','Provider price'],
          'نشرة DFM':[isDfm?'نشرة DFM':'مصدر الأسعار',isDfm?'DFM bulletin':'Price source'],
          'فتح المصدر الرسمي':['فتح مصدر الأسعار','Open price source'],
          'المصدر الرسمي متاح':[isDfm?'المصدر الرسمي متاح':'مزود الأسعار متاح',isDfm?'Official source available':'Price provider available'],
          'المحور الأفقي: التاريخ · العمودي: سعر السهم بالدرهم':[`المحور الأفقي: التاريخ · العمودي: سعر السهم بـ ${walletCurrency}`,`Horizontal: date · Vertical: price in ${walletCurrency}`],
          'حركة الإغلاق التاريخية وبيانات DFM. أي ملف تستورده يُعرض كمصدر من المستخدم.':['الأسعار التاريخية المتاحة لهذا السوق. ملفات CSV مصدرها المستخدم.','Available historical prices for this market. CSV files are user-supplied.'],
          'تشمل نشرات DFM السابقة والمحلية والأسعار التي استوردتها. الأيام غير الموجودة لا تظهر هنا.':['تشمل الإغلاقات التي جمعها التطبيق والأسعار المستوردة. الأيام غير المتاحة لا تُقدّر.','Includes collected closes and imported prices. Missing dates are not estimated.'],
          'صفحة الشركة في DFM':['صفحة الشركة والأسعار','Company and prices'],
          'تنزيل التاريخ الرسمي من DFM':[isDfm?'تنزيل التاريخ الرسمي من DFM':'فتح صفحة السهم التاريخية',isDfm?'Download DFM history':'Open stock history'],
          'إضافة تاريخ من DFM':['مصدر السوق','Market source'],
          'انسخ المحفظة وتاريخ DFM':['انسخ المحفظة وتاريخ السوق','Copy portfolio and market history'],
          'من نشرات DFM،':['من المصدر،','provider,'],
          'تواريخ DFM محفوظة':['تواريخ محفوظة','stored dates'],
          'بلا علامة DFM':['التوافق غير مؤكد','Sharia status unknown'],
          'يقرأ أرصدتك وعملياتك الافتراضية ونشرات DFM القديمة قبل أول صفقة، ويعرض سيناريو صعود أو هبوط مشروطًا. لا ينفذ أوامر.':['يحلل المحفظة المختارة وتاريخ السوق المتاح، ويبحث عن الشركات لعرض سيناريوهات مشروطة.','Reviews the selected wallet and available price history, with company research and conditional scenarios.'],
          'جارٍ تحميل الجلسات القديمة من DFM…':['جارٍ تحميل تاريخ السوق…','Loading market history…'],
          'الرسم من نشرات DFM القديمة التي يجلبها التطبيق وجلساته المحفوظة ومن ملف CSV الذي تختاره أنت. الملف المستورد لم يتحقق منه التطبيق مقابل السوق.':[isDfm?'الرسم من أرشيف DFM والجلسات المحفوظة وملفاتك المستوردة.':'يجلب التطبيق تلقائيًا حتى سنة من الإغلاقات اليومية وحجم التداول عند فتح السهم، ثم يحفظها. التاريخ من مزود طرف ثالث ومطابق للسوق والرمز؛ وملف CSV يظل غير متحقق.',isDfm?'Chart uses DFM archive, saved closes and imported files.':'The app automatically fetches and saves up to one year of daily closes and volume when you open a stock. This is third-party history matched to the exchange and ticker; imported CSV remains unverified.'],
          'اضغط عنوان أي عمود للفرز. القائمة ليست ترشيحات شراء. تشمل الأسهم وصناديق العقارات الموجودة بالنشرة بسعر صالح؛ لا تشمل العقود الآجلة أو كل بورصات العالم.':['القائمة تشمل سجلات الأسهم والشركات التي يوفرها المصدر. البحث والفرز يشملان كل النتائج؛ الأسهم بلا سعر صالح تظهر ولا يمكن تداولها افتراضيًا.','All stock/company records supplied by the provider. Search and sorting cover every result. Securities without valid prices remain listed but cannot be paper-traded.'],
          'أسعار إغلاق يومية · درهم إماراتي · لا يوجد تنفيذ بأموال حقيقية':['أسعار مؤرخة بعملة التداول · محافظ افتراضية مستقلة','Dated prices in trading currency · Separate virtual portfolios'],
        };
        return (labels[value]?.[language==='ar'?0:1]??translate(language,value)).replace(/\bAED\b/g,walletCurrency);
    };
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
    }>({ key: 'symbol', direction: 1 }), [settings, setSettings] = useState<PublicSettings>(defaultSettings), [settingsOpen, setSettingsOpen] = useState(false), [newKey, setNewKey] = useState(''), [clearKey, setClearKey] = useState(false), [settingsSaving, setSettingsSaving] = useState(false), [aiText, setAiText] = useState(''), [aiCitations,setAiCitations] = useState<Citation[]>([]), [aiCoverage,setAiCoverage] = useState<{sessions:number;official:number;imported:number;first?:string;last?:string}|null>(null), [aiWebSearchUsed,setAiWebSearchUsed]=useState(false), [aiLoading, setAiLoading] = useState(false), [portfolioReport, setPortfolioReport] = useState<PortfolioReport | null>(null), [portfolioLoading, setPortfolioLoading] = useState(false), [portfolioError, setPortfolioError] = useState(''), [horizon, setHorizon] = useState<'week' | 'month'>('week'), [detailsOpen, setDetailsOpen] = useState(false), [demoText, setDemoText] = useState(''), [imported, setImported] = useState<HistoryPoint[]>([]), [officialPoints, setOfficialPoints] = useState<HistoryPoint[]>([]), [csvRows, setCsvRows] = useState<string[][]>([]), [dateCol, setDateCol] = useState(0), [priceCol, setPriceCol] = useState(1), [symbolCol, setSymbolCol] = useState(-1), [historyError, setHistoryError] = useState(''), [importSaving, setImportSaving] = useState(false), [symbol, setSymbol] = useState(''), [broker, setBroker] = useState<Broker>('alramz'), [tab, setTab] = useState('portfolio'), [order, setOrder] = useState<Order | null>(null);
    const market = data?.market ?? null, summary = account ? totals(account, market) : null;
    const allQuotes = useMemo(()=>market?.quotes ?? [],[market]);
    const currencies=[...new Set([marketName.currency,...allQuotes.map(tradingCurrency)])].sort();
    const quotes = useMemo(()=>allQuotes.filter(q=>tradingCurrency(q)===walletCurrency&&(selectedMarket!=='us'||usExchange==='all'||q.exchange===usExchange)),[allQuotes,walletCurrency,selectedMarket,usExchange]), current = quotes.find(q => q.symbol === symbol) ?? quotes.find(q => q.sharia && q.volume > 0) ?? quotes.find(q=>q.price>0&&q.volume>0&&q.lastTrade===market?.date) ?? quotes[0];
    const [aiMeta,setAiMeta]=useState<SavedMeta & {decision?:DecisionPlan}>({}),[historyRevision,setHistoryRevision]=useState(0),[historyOpenId,setHistoryOpenId]=useState<string|null>(null),[viewReady,setViewReady]=useState(false);
    const rankings=useStockRankings(selectedMarket,walletCurrency,historyRevision);
    const stockRestore=useRef(0),portfolioRestore=useRef(0);
    const viewRef=useRef({market:selectedMarket,currency:walletCurrency,symbol:current?.symbol,horizon});
    useEffect(()=>{viewRef.current={market:selectedMarket,currency:walletCurrency,symbol:current?.symbol,horizon}},[selectedMarket,walletCurrency,current?.symbol,horizon]);
    function applyStock(result:StockAnalysis){setAiText(result.text);setAiCitations(result.citations??[]);setAiCoverage(result.coverage??null);setAiWebSearchUsed(!!result.webSearchUsed);setAiMeta(result)}
    function restored(record:AnalysisRecord){return {...record.result,historyId:record.id,createdAt:record.createdAt,model:record.model,saved:true}}
    async function activeRecord(scope:AnalysisScope){const r=await fetch('/api/ai-history?'+analysisParams(scope),{cache:'no-store'}),d=await r.json() as {record:AnalysisRecord|null;error?:string};if(!r.ok)throw new Error(d.error);return d.record as AnalysisRecord|null}
    useEffect(()=>{
        queueMicrotask(()=>{try{const v=JSON.parse(localStorage.getItem('tradelens-view')||'null');if(v&&Object.hasOwn(MARKETS,v.market)&&/^[A-Z]{3}$/.test(v.currency)){setSelectedMarket(v.market);setWalletCurrency(v.currency);if(['all','NASDAQ','NYSE','AMEX'].includes(v.usExchange))setUsExchange(v.usExchange);if(typeof v.symbol==='string')setSymbol(v.symbol);if(v.horizon==='week'||v.horizon==='month')setHorizon(v.horizon);if(['market','portfolio','connections','ai-history'].includes(v.tab))setTab(v.tab)}}catch{}setViewReady(true)});
    },[]);
    useEffect(()=>{if(viewReady)try{localStorage.setItem('tradelens-view',JSON.stringify({market:selectedMarket,currency:walletCurrency,symbol:current?.symbol||symbol,horizon,tab,usExchange}))}catch{}},[viewReady,selectedMarket,walletCurrency,current?.symbol,symbol,horizon,tab,usExchange]);
    useEffect(()=>{
        const version=++stockRestore.current;
        if(!viewReady||!current?.symbol)return;
        void activeRecord({kind:'stock',market:selectedMarket,currency:walletCurrency,subject:current.symbol}).then(record=>{if(stockRestore.current===version&&record)applyStock(restored(record) as StockAnalysis)}).catch(()=>{if(stockRestore.current===version)setError(language==='ar'?'تعذّر استرجاع التحليل المحفوظ. افتح سجل AI لإعادة المحاولة.':'Could not restore saved analysis. Open AI history to retry.')});
        return ()=>{stockRestore.current++};
    },[viewReady,selectedMarket,walletCurrency,current?.symbol]);
    useEffect(()=>{
        const version=++portfolioRestore.current;queueMicrotask(()=>{if(portfolioRestore.current===version)setPortfolioReport(null)});
        if(!viewReady)return;
        void activeRecord({kind:'portfolio',market:selectedMarket,currency:walletCurrency,subject:horizon}).then(record=>{if(portfolioRestore.current===version&&record)setPortfolioReport(restored(record) as PortfolioReport)}).catch(()=>{if(portfolioRestore.current===version)setPortfolioError(language==='ar'?'تعذّر استرجاع المراجعة المحفوظة. افتح سجل AI لإعادة المحاولة.':'Could not restore saved review. Open AI history to retry.')});
        return ()=>{portfolioRestore.current++};
    },[viewReady,selectedMarket,walletCurrency,horizon]);
    function openSavedHistory(id?:string){setHistoryOpenId(id??null);setDetailsOpen(false);setTab('ai-history')}
    function activateRecord(record:AnalysisRecord){
        if(record.kind.endsWith('_prompt'))return;
        if(loading||saving){setNotice(language==='ar'?'تم تثبيت النسخة؛ ستظهر عند فتح سوقها بعد اكتمال التحديث.':'Version selected. Open its market after the update completes.');return}
        if(record.market!==selectedMarket||record.currency!==walletCurrency)changeScope(record.market,record.currency);
        if(record.kind==='stock'){setSymbol(record.subject);applyStock(restored(record) as StockAnalysis);setTab('market')}
        else {setHorizon(record.subject as 'week'|'month');setPortfolioReport(restored(record) as PortfolioReport);setTab('portfolio')}
    }
    const matched = useMemo(()=>quotes.filter(q => (filter === 'all' || (filter === 'approved' ? q.sharia : !q.sharia)) && (sector === 'all' || q.sector === sector) && (activity === 'all' || (activity === 'traded' ? q.lastTrade === market?.date && q.volume > 0 : q.lastTrade !== market?.date || q.volume <= 0)) && (q.symbol + ' ' + q.name + ' ' + (sectors[q.sector] || '')).toLowerCase().includes(query.toLowerCase())).sort((a, b) => { const key = sort.key; if(key==='score'){const h=horizon==='week'?5:20;const ra=rankings.rows[a.symbol],rb=rankings.rows[b.symbol];const av=ra?.horizon===h?ra.score:null,bv=rb?.horizon===h?rb.score:null;if(av==null&&bv==null)return a.symbol.localeCompare(b.symbol);if(av==null)return 1;if(bv==null)return -1;return (av-bv)*sort.direction||a.symbol.localeCompare(b.symbol)} const n = key === 'symbol' ? a.symbol.localeCompare(b.symbol) : key === 'sharia' ? Number(a.sharia) - Number(b.sharia) : a[key] - b[key]; return n * sort.direction || a.symbol.localeCompare(b.symbol); }),[quotes,filter,sector,activity,market?.date,query,sort,horizon,rankings.rows]);
    function changeScope(id:MarketId,currency=MARKETS[id].currency as string){
        setSelectedMarket(id);setUsExchange('all');setWalletCurrency(currency);setData(null);setAccount(null);setSymbol('');setPage(0);setQuery('');setSector('all');setFilter('all');setActivity('all');setAiText('');setPortfolioReport(null);setPortfolioError('');setDetailsOpen(false);setOrder(null);setImported([]);setOfficialPoints([]);setDemoText('');setNotice('');setError('');historyRequest.current++;
    }
    useEffect(()=>setPage(0),[query,filter,sector,activity,sort,usExchange]);
    function openDetails(q: Quote) {
        const request = ++historyRequest.current;
        const changedStock=q.symbol!==current?.symbol;
        setSymbol(q.symbol);
        setDemoText('');
        if(changedStock){setAiText('');setAiCitations([]);setAiCoverage(null);setAiWebSearchUsed(false);setAiMeta({})}
        setImported([]);
        setOfficialPoints([]);
        setCsvRows([]);
        setHistoryError('');
        setDetailsOpen(true);
        void fetch(`/api/history?market=${selectedMarket}&symbol=${encodeURIComponent(q.symbol)}`, { cache: 'no-store' }).then(async (r) => {
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
            const r = await fetch('/api/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketId:selectedMarket,symbol: current.symbol, points }) });
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
        const timeout = setTimeout(() => controller.abort(), 90000);
        try {
            const results = await Promise.all([fetch(`/api/market?market=${selectedMarket}&currency=${walletCurrency}`, { cache: 'no-store', signal: controller.signal }), fetch(`/api/paper?market=${selectedMarket}&currency=${walletCurrency}`, { cache: 'no-store', signal: controller.signal })]);
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
            if (!results[1].ok)
                throw new Error(a.error || 'تعذّر تحميل المحفظة.');
            setAccount(a.account);
            setVersion(a.version);setFeePercent(a.account.customFees?.percent??0);setFeeFixed(a.account.customFees?.fixed??0);
            setBroker(a.account.broker);
        }
        catch (e) {
            setData(previous=>previous?{...previous,connection:'cached'}:previous);
            setError(e instanceof Error && e.name === 'AbortError' ? 'استغرق التحديث وقتًا طويلًا. حاول مرة أخرى.' : e instanceof Error ? e.message : 'تعذّر التحديث. حاول مجددًا.');
        }
        finally {
            clearTimeout(timeout);
            setLoading(false);
            pending.current = false;
        }
    }
    useEffect(() => {
        void fetch('/api/settings', { cache: 'no-store' }).then(async (r) => r.ok ? await r.json() as PublicSettings : null).then((s) => {
            if (s) {
                setSettings(s);
                setFilter(s.preferences.defaultSharia);
            }
        }).catch(() => { });
    }, []);
    useEffect(()=>{if(viewReady)void refresh();},[viewReady,selectedMarket,walletCurrency]);
    useEffect(() => {
        if (!viewReady) return;
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible')
                void refresh();
        }, 60000);
        const resume=()=>{if(document.visibilityState==='visible')void refresh()};
        document.addEventListener('visibilitychange',resume);
        window.addEventListener('online',resume);
        return () => {clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume)};
    }, [viewReady,selectedMarket,walletCurrency]);
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
            Promise.resolve(doc.modelContext.registerTool({ name: 'read_paper_portfolio', description: 'Read the selected market portfolio in its own trading currency. Paper orders only.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ mode: 'paper', currency:live.current.account?.currency||'AED', ...live.current }) }, { signal: lifecycle.signal })).catch(() => { });
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
            const r = await fetch('/api/paper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...order, version,marketId:selectedMarket,currency:walletCurrency,customFees:{...account?.customFees,percent:feePercent,fixed:feeFixed} }) });
            const d = await r.json() as {
                account: Account;
                version: number;
                error?: string;
            };
            if (!r.ok)
                throw new Error(d.error);
            setAccount(d.account);
            setVersion(d.version);
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
        const requested={...viewRef.current};stockRestore.current++;
        setAiLoading(true);
        setError('');
        try {
            const r = await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketId:selectedMarket,symbol: current.symbol, horizon, language }) });
            const d = await r.json() as StockAnalysis & {error?:string};
            if (!r.ok)
                throw new Error(d.error);
            if(d.saved)setHistoryRevision(v=>v+1);
            if(viewRef.current.market===requested.market&&viewRef.current.currency===requested.currency&&viewRef.current.symbol===requested.symbol)applyStock(d);
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
        const requested={...viewRef.current};portfolioRestore.current++;
        setPortfolioLoading(true);
        setPortfolioError('');
        try {
            const r = await fetch('/api/portfolio-outlook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketId:selectedMarket,currency:walletCurrency,horizon, language }) });
            const d = await r.json() as PortfolioReport & {
                error?: string;
            };
            if (!r.ok)
                throw new Error(d.error || 'تعذّر إعداد التقرير.');
            if(d.saved)setHistoryRevision(v=>v+1);
            if(viewRef.current.market===requested.market&&viewRef.current.currency===requested.currency&&viewRef.current.horizon===requested.horizon)setPortfolioReport(d);
        }
        catch (e) {
            setPortfolioError(e instanceof Error ? e.message : 'تعذّر مراجعة المحفظة.');
        }
        finally {
            setPortfolioLoading(false);
        }
    }
    async function savePromptAndCopy(scope:AnalysisScope,prompt:string){
        const r=await fetch('/api/ai-history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...scope,prompt})}),d=await r.json() as {error?:string};if(!r.ok)throw new Error(d.error);
        setHistoryRevision(v=>v+1);return prompt;
    }
    async function copyPortfolio(regenerate=false) {
        if (!account || !market)
            return;
        try {
            const scope:AnalysisScope={kind:'portfolio_prompt',market:selectedMarket,currency:walletCurrency,subject:horizon};
            
            setNotice(language==='ar'?'جارٍ تجهيز البيانات والتاريخ المتاح…':'Preparing available data and history…');
            const r = await fetch(`/api/portfolio-outlook?market=${selectedMarket}&currency=${walletCurrency}&horizon=${horizon}&language=${language}`, { cache: 'no-store' });
            const d = await r.json() as {
                prompt?: string;
                error?: string;
            };
            if (!r.ok || !d.prompt)
                throw new Error(d.error || 'تعذّر إعداد الملخص.');
            return await savePromptAndCopy(scope,d.prompt);
        }
        catch (e) {
            setPortfolioError(e instanceof Error ? e.message : 'تعذّر النسخ؛ جرّب متصفحًا يدعم الحافظة.');
        }
    }
    async function copy(regenerate=false) {
        if (!current || !market)
            return;
        try {
            const scope:AnalysisScope={kind:'stock_prompt',market:selectedMarket,currency:walletCurrency,subject:current.symbol};
            const hr=await fetch(`/api/history?market=${selectedMarket}&symbol=${encodeURIComponent(current.symbol)}`,{cache:'no-store'});const history=await hr.json() as {points?:HistoryPoint[];officialPoints?:HistoryPoint[];error?:string};if(!hr.ok)throw new Error(history.error||'تعذر تحميل التاريخ');
            
            return await savePromptAndCopy(scope,`${DECISION_INSTRUCTIONS} Research ${current.name} (${current.symbol}) on ${marketName.en} in ${language==='en'?'English':'Arabic'}. Trading currency ${tradingCurrency(current)}. Source ${sourceUrl}, date ${market.date}, quote kind ${current.priceKind||'daily close'}. Search dated company disclosures, business drivers and recent catalysts. Give conditional scenarios and risks; do not invent missing history or convert currencies. Quote: ${JSON.stringify(current)}. Available saved/imported closes (up to roughly one trading year): ${JSON.stringify({official:history.officialPoints?.slice(-270)||[],userImportedUnverified:history.points?.slice(-270)||[]})}. Wallet: ${JSON.stringify({cash:account?.cash,capital:account?.initial,broker,fees:account?.customFees})}. Sharia classification ${isDfm?'DFM marker only':'unavailable'}.`);

        }
        catch (e) {
            setError(e instanceof Error?e.message:'تعذّر حفظ ونسخ الـprompt.');
        }
    }
    const selectedOrder = quotes.find(q => q.symbol === order?.symbol), orderFee = order && Number.isFinite(order.qty) && order.qty > 0 ? fees(Math.round(order.qty * order.price * 100) / 100, order.broker,selectedMarket,{...account?.customFees,percent:feePercent,fixed:feeFixed},order.qty,order.side) : null;
    const feesReady=!!account?.customFees?.confirmed||(selectedMarket==='dfm'&&walletCurrency==='AED'&&['alramz','enbd'].includes(broker));
    const orderReason = !feesReady ? (language==='ar'?'راجع منصة التداول والمصاريف واحفظ التعريفة أولًا.':'Review and save your trading costs first.') : order && selectedOrder && market ? canTrade(market, selectedOrder, data?.connection || '', order.side) : 'السعر غير متاح.';
    return <div className={`shell ${language === "ar" ? "arabic" : "english"}`} dir={language === "ar" ? "rtl" : "ltr"}>
 <header className="topbar"><a className="brand" href="/" dir="ltr"><span className="brandmark"><Activity size={23}/></span>Trade<span>Lens</span></a><div className="header-right"><button className="textbutton header-setting" onClick={()=>setSettingsOpen(true)}><Settings2 size={16}/>{language==='ar'?'الإعدادات':'Settings'}</button><span className="mode">{tr("أسهم حقيقية · رصيد افتراضي")}</span><DropdownMenu dir={language === "ar" ? "rtl" : "ltr"}><DropdownMenuTrigger className="avatar account-button" aria-label={tr("خيارات الحساب")} title={tr("خيارات الحساب")}>OE <ChevronDown size={13}/></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSettingsOpen(true)}><Settings2 size={16}/> {language === 'ar' ? 'إعدادات الحساب والمظهر' : 'Account and appearance'}</DropdownMenuItem><DropdownMenuItem onSelect={() => setTab("connections")}><Database size={16}/> {tr("المصادر والاتصالات")}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem asChild><a href="/signout-with-chatgpt?return_to=%2F" target="_top"><LogOut size={16}/> {tr("تسجيل الخروج")}</a></DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
 <main><div className="pageheading"><div><p className="eyebrow">{tr("مساحة عمر للاستثمار")}</p><h1>{language==='ar'?'محفظتك، بوضوح.':'Your portfolio, at a glance.'}</h1></div><button className="secondary" onClick={refresh} disabled={loading || saving}><RefreshCw size={17} className={loading ? 'spin' : ''}/>{loading ? tr('جارٍ التحديث…') : tr('تحديث الأسعار')}</button></div>
 <div className="market-picker"><label>{language==='ar'?'السوق':'Market'}<Select value={selectedMarket==='us'&&usExchange==='NASDAQ'?'us-nasdaq':selectedMarket} disabled={loading||saving||aiLoading||portfolioLoading} onValueChange={v=>{if(v==='us-nasdaq'){if(selectedMarket!=='us')changeScope('us');setUsExchange('NASDAQ');setQuery('');setSector('all');setFilter('all');setActivity('all')}else changeScope(v as MarketId)}}><SelectTrigger aria-label={language==='ar'?'اختيار السوق':'Select market'}><SelectValue/></SelectTrigger><SelectContent>{Object.entries(MARKETS).map(([id,m])=><SelectItem key={id} value={id}>{language==='ar'?m.ar:m.en} · {id.toUpperCase()}</SelectItem>)}<SelectItem value="us-nasdaq">{language==='ar'?'ناسداك الأمريكي · NASDAQ':'US Nasdaq · NASDAQ'}</SelectItem></SelectContent></Select></label><label>{language==='ar'?'عملة التداول والمحفظة':'Trading currency and wallet'}<Select value={walletCurrency} disabled={loading||saving||aiLoading||portfolioLoading} onValueChange={v=>changeScope(selectedMarket,v)}><SelectTrigger aria-label={language==='ar'?'عملة التداول':'Trading currency'}><SelectValue/></SelectTrigger><SelectContent>{currencies.map(c=><SelectItem key={c} value={c}>{c==='XXX'?(language==='ar'?'عملة غير محددة':'Unknown currency'):c}</SelectItem>)}</SelectContent></Select></label><p>{language==='ar'?`محفظة ${marketName.ar} · ${walletCurrency}. الرصيد والعمليات مستقلة؛ لا يوجد تحويل عملات تلقائي.`:`${marketName.en} · ${walletCurrency} wallet. Independent balance and trades; no automatic currency conversion.`}</p></div>
 
 {data?.error && <div className="error" role="alert">{data.error}{market && (language === "ar" ? ` المعروض آخر نسخة محفوظة بتاريخ ${market.date}.` : ` Showing the latest cached bulletin dated ${market.date}.`)}</div>}{error && <div className="error" role="alert">{error}{error.includes('جلسة الدخول') ? <a className="textbutton" href="/signin-with-chatgpt?return_to=%2F" target="_top">{tr("تسجيل الدخول")}</a> : <button className="textbutton" disabled={saving} onClick={refresh}>{tr("إعادة التحميل")}</button>}</div>}{notice && <div className="notice" role="status">{tr(notice)}<button className="textbutton" onClick={() => setNotice('')}>{tr("إغلاق")}</button></div>}
 <PortfolioOverview account={account} market={market} language={language}/>

 <Tabs value={tab} onValueChange={setTab} className="workspace-tabs" dir={language === "ar" ? "rtl" : "ltr"}><TabsList variant="line"><TabsTrigger value="portfolio"><Wallet />{tr("محفظتي الافتراضية")}</TabsTrigger><TabsTrigger value="market"><Search />{tr("اختيار الأسهم")}</TabsTrigger><TabsTrigger value="ai-history"><Sparkles/>{language==='ar'?'سجل AI':'AI history'}</TabsTrigger><TabsTrigger value="connections"><Database />{tr("المصادر والاتصالات")}</TabsTrigger></TabsList>
 <TabsContent forceMount value="market"><div className="market-layout"><DashboardSection id="screener" className="catalog" title={tr("اختيار الأسهم")} summary={`${matched.length} ${tr("نتيجة")} · ${selectedMarket.toUpperCase()}`} language={language} defaultOpen>
 <div className="stock-ai-quick"><div><strong>{language==='ar'?'تحليل السهم على ChatGPT':'Analyze stock on ChatGPT'}</strong><small>{language==='ar'?'السهم المختار: ':'Selected stock: '}{current?.symbol||'—'}</small></div><CopyChatGPT language={language} prepare={()=>copy(true)} disabled={!current||!market}/></div>
 <DashboardSection id="screener-ai" title={language==='ar'?'GENERATE · تحليل وترشيح الأسهم':'GENERATE · Stock analysis & rankings'} summary={rankings.busy?`${rankings.progress.done} / ${rankings.progress.total}`:language==='ar'?'النتائج محفوظة · إعدادات التوليد':'Saved results · Generation controls'} language={language}><RankingToolbar engine={rankings} pageSymbols={matched.slice(page*100,(page+1)*100).map(q=>q.symbol)} allSymbols={matched.map(q=>q.symbol)} horizon={horizon} onHorizon={setHorizon} language={language} configured={settings.configured&&!!settings.model} onConfigure={()=>setSettingsOpen(true)} onSort={()=>{setSort({key:'score',direction:-1});setPage(0)}}/></DashboardSection>
 {selectedMarket==='nasdaqdubai'&&<div className="notice"><div>{language==='ar'?`أنت تعرض ناسداك دبي، وليس ناسداك الأمريكي. المصدر أعاد ${allQuotes.length} ورقة لهذه البورصة؛ المعروض ${matched.length} بعد العملة والفلاتر. السندات والصكوك ليست ضمن جدول الأسهم.`:`Nasdaq Dubai is separate from US Nasdaq. Source records: ${allQuotes.length}; shown after currency and filters: ${matched.length}. Bonds and sukuk are excluded.`}</div><button className="secondary" disabled={loading||saving} onClick={()=>{changeScope('us');setUsExchange('NASDAQ')}}>{language==='ar'?'عرض ناسداك الأمريكي':'View US Nasdaq'}</button>{currencies.filter(c=>allQuotes.some(q=>tradingCurrency(q)===c)).map(c=><button key={c} className={walletCurrency===c?'primary':'secondary'} disabled={loading||saving} onClick={()=>changeScope('nasdaqdubai',c)}>{c} · {allQuotes.filter(q=>tradingCurrency(q)===c).length} {language==='ar'?'ورقة':'records'}</button>)}<a href="https://marketwatch.nasdaqdubai.com/" target="_blank" rel="noreferrer">{language==='ar'?'قائمة ناسداك دبي الرسمية':'Official Nasdaq Dubai list'}</a></div>}
 <div className="market-controls">{selectedMarket==='us'&&<Select value={usExchange} onValueChange={setUsExchange}><SelectTrigger aria-label="US exchange"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{language==='ar'?'كل البورصات الأمريكية':'All US exchanges'}</SelectItem><SelectItem value="NASDAQ">{language==='ar'?'ناسداك الأمريكي · NASDAQ':'US Nasdaq · NASDAQ'}</SelectItem><SelectItem value="NYSE">NYSE</SelectItem><SelectItem value="AMEX">NYSE American · AMEX</SelectItem></SelectContent></Select>}<div className="search"><Search size={16}/><input placeholder={tr("اسم الشركة أو كود السهم…")} aria-label={tr("بحث عن سهم")} value={query} onChange={e => setQuery(e.target.value)}/></div><Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label={tr("التوافق الشرعي")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approved">{tr("بعلامة توافق شرعي فقط")}</SelectItem><SelectItem value="all">{tr("كل الأسهم في المصدر")}</SelectItem><SelectItem value="unmarked">{tr("بدون علامة توافق")}</SelectItem></SelectContent></Select><Select value={sector} onValueChange={setSector}><SelectTrigger aria-label={tr("القطاع")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{tr("كل القطاعات")}</SelectItem>{[...new Set(quotes.map(q => q.sector))].map(s => <SelectItem value={s} key={s}>{language === 'ar' ? sectors[s] || s : s}</SelectItem>)}</SelectContent></Select><Select value={activity} onValueChange={setActivity}><SelectTrigger aria-label={tr("حالة التداول")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{tr("كل حالات التداول")}</SelectItem><SelectItem value="traded">{tr("تداولت في الجلسة")}</SelectItem><SelectItem value="stale">{tr("لم تتداول في الجلسة")}</SelectItem></SelectContent></Select></div>
 <div className={settings.preferences.compactRows ? "stock-scroll compact-rows" : "stock-scroll"}><Table><TableHeader><TableRow><TableHead><button className="sort-button" onClick={() => toggleSort("symbol")}>{tr("السهم / الشركة")} <ArrowUpDown size={14}/></button></TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("price")}>{tr("الإغلاق · AED")} <ArrowUpDown size={14}/></button></TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("change")}>{tr("تغيّر الجلسة")} <ArrowUpDown size={14}/></button></TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("volume")}>{tr("الحجم")} <ArrowUpDown size={14}/></button></TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("score")}>{language==='ar'?'ترشيح AI / النجاح التاريخي':'AI score / historical success'} <ArrowUpDown size={14}/></button></TableHead><TableHead>{language==='ar'?'الاتجاه':'Trend'}</TableHead><TableHead><button className="sort-button" onClick={() => toggleSort("sharia")}>{tr("علامة الشريعة")} <ArrowUpDown size={14}/></button></TableHead></TableRow></TableHeader><TableBody>{matched.slice(page*100,(page+1)*100).map(q => <TableRow key={q.symbol} className={current?.symbol === q.symbol ? 'selected-row' : ''}><TableCell><button className="stockbutton" onClick={() => openDetails(q)}><span className="ticker-icon">{q.symbol[0]}</span><span><strong dir="ltr">{q.symbol}</strong><small dir="ltr">{q.name}</small><small>{q.exchange||selectedMarket.toUpperCase()} · {language==='ar'?'عرض التفاصيل':'View details'}</small><small>{language === 'ar' ? sectors[q.sector] || q.sector : q.sector}</small></span></button></TableCell><TableCell><span dir="ltr">{price(q.price)} {tradingCurrency(q)}</span><small className="block">{q.lastTrade||'—'} · {q.priceKind==='delayed'?(q.delaySeconds?`${Math.round(q.delaySeconds/60)} ${language==='ar'?'دقيقة تأخير':'min delay'}`:(language==='ar'?'تأخير غير محدد':'Delay unspecified')):(language==='ar'?'إغلاق':'Close')}</small>{q.lastTrade !== market?.date && <small className="block negative">{tr("آخر تداول")} {q.lastTrade || tr('غير معروف')}</small>}</TableCell><TableCell><span dir="ltr" className={q.change < 0 ? 'negative' : q.change > 0 ? 'positive' : 'neutral'}>{q.price>0&&q.previous>0?`${q.change>0?'↗ ':q.change<0?'↘ ':'＝ '}${signed(q.change)}%`:'—'}</span></TableCell><TableCell>{q.volume.toLocaleString("en-US")}</TableCell><TableCell><RankingCell row={rankings.rows[q.symbol]} running={rankings.running.includes(q.symbol)} horizon={horizon==='week'?5:20} marketDate={market?.date||''} language={language} onOpen={()=>{const row=rankings.rows[q.symbol];if(row?.historyId)openSavedHistory(row.historyId);else openDetails(q)}}/></TableCell><TableCell><MiniTrend points={holdingSeries(data?.history||[],q.symbol)} language={language}/></TableCell><TableCell><span className={q.sharia ? 'sharia-chip' : 'tag'}>{q.sharia ? tr('علامة DFM') : tr('غير مؤكد')}</span></TableCell></TableRow>)}</TableBody></Table></div><div className="catalog-pages"><button className="secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>{language==='ar'?'السابق':'Previous'}</button><span>{language==='ar'?`صفحة ${page+1} من ${Math.max(1,Math.ceil(matched.length/100))} · ${matched.length} سهم بهذه العملة، ${allQuotes.length} في المصدر`:`Page ${page+1} of ${Math.max(1,Math.ceil(matched.length/100))} · ${matched.length} in this currency, ${allQuotes.length} in source`}</span><button className="secondary" disabled={(page+1)*100>=matched.length} onClick={()=>setPage(p=>p+1)}>{language==='ar'?'التالي':'Next'}</button></div>
 {!matched.length && <div className="empty">{loading ? tr('بنحمّل النشرة الرسمية…') : market ? tr('لا توجد نتائج بهذه الفلاتر.') : tr('الأسعار غير متاحة الآن. اضغط تحديث للمحاولة.')}</div>}<p className="panelnote">{tr("اضغط عنوان أي عمود للفرز. القائمة ليست ترشيحات شراء. تشمل الأسهم وصناديق العقارات الموجودة بالنشرة بسعر صالح؛ لا تشمل العقود الآجلة أو كل بورصات العالم.")}</p></DashboardSection>
 <aside className="stock-detail"><DashboardSection id="stock-detail" title={language==='ar'?'السهم المختار':'Selected stock'} summary={current?.symbol||'—'} language={language} defaultOpen>{current && market ? <><div className="panelheading"><div><p className="eyebrow">{tr("02 / افهم السهم")}</p><h2 dir="ltr">{current.symbol}</h2></div><ShieldCheck className={current.sharia ? 'positive' : ''}/></div><p className="company-name" dir="ltr">{current.name}</p><div className="priceheading"><strong dir="ltr">{price(current.price)} <small>{walletCurrency}</small></strong><span className={current.change < 0 ? 'negative' : 'positive'} dir="ltr">{signed(current.change)}%</span></div><p className="metadata">{tr("إغلاق")} {market.date} {tr("· آخر تداول")} {current.lastTrade || tr('غير متاح')}</p><p className="metadata">{language==='ar'?'توقيت سجل المصدر (قد يكون توقيت الشمعة وليس آخر صفقة):':'Provider record time (may be bar time, not last trade):'} {current.updatedAt?time(current.updatedAt,language):current.lastTrade||'—'} · {language==='ar'?'بتوقيت دبي':'Dubai time'}</p><dl className="stock-facts"><div><dt>{tr("القطاع")}</dt><dd>{sectors[current.sector] || current.sector}</dd></div><div><dt>{tr("إغلاق الجلسة السابقة")}</dt><dd dir="ltr">{price(current.previous)} {walletCurrency}</dd></div><div><dt>{tr("حجم تداول الجلسة")}</dt><dd>{current.volume.toLocaleString('en-US')} {tr("سهم")}</dd></div></dl><div className="sourcebox"><span>{tr("التوافق الشرعي")}</span><p>{current.sharia ? tr('السهم يحمل علامة توافق شرعي في نشرة سوق دبي بهذا التاريخ.') : (language==='ar'?'لا يوفّر المصدر تصنيفًا شرعيًا مؤكدًا لهذا السهم.':'The source does not provide a confirmed Sharia classification for this stock.')}</p><small>{tr("هذه علامة المصدر وليست فتوى من التطبيق. راجع منهج الفحص والتطهير مع جهة شرعية قبل التعامل الحقيقي.")}</small></div>

 <button className="secondary full detail-button" onClick={() => openDetails(current)}><ChartNoAxesCombined size={17}/>{tr("رسم السعر وتفاصيل السهم")}</button><button className="primary full" disabled={!account || loading || saving || !!canTrade(market, current, data?.connection || '', 'buy')} onClick={() => review(current, 'buy')}>{tr("مراجعة شراء افتراضي")} <ArrowUpRight size={18}/></button>{canTrade(market, current, data?.connection || '', 'buy') && <p className="panelnote negative">{canTrade(market, current, data?.connection || '', 'buy')}</p>}
 <div className="stock-ai-quick"><CopyChatGPT language={language} prepare={()=>copy(true)} disabled={!current||!market}/></div><button className="secondary full research-copy" onClick={settings.configured && settings.model ? research : () => setSettingsOpen(true)} disabled={aiLoading||loading||saving}><Sparkles size={16}/>{aiLoading ? tr("جارٍ التحليل…") : settings.configured && settings.model ? (aiText?(language==='ar'?'إنشاء تحليل جديد':'Generate new analysis'):(language==='ar'?'تحليل السهم وبحث الشركة':'Analyze stock and research company')) : tr("ربط نموذج AI للتحليل")}</button>{aiText && <DashboardSection id="stock-ai-result" title={language==='ar'?'نتيجة تحليل AI':'AI analysis result'} summary={aiText.slice(0,160)} language={language}><div className="ai-result" role="status"><strong>{tr("تحليل")} {current.symbol} · {aiMeta.model}</strong><SavedAnalysisNotice meta={aiMeta} language={language} onOpen={openSavedHistory}/>{aiCoverage&&<small className="block">{language==='ar'?`تاريخ الأسعار المرسل: ${aiCoverage.sessions} جلسة (${aiCoverage.official} من المصدر، ${aiCoverage.imported} مستوردة) · ${aiCoverage.first??'—'} إلى ${aiCoverage.last??'—'}`:`Price history sent: ${aiCoverage.sessions} sessions (${aiCoverage.official} provider, ${aiCoverage.imported} imported) · ${aiCoverage.first??'—'} to ${aiCoverage.last??'—'}`}</small>}<>{aiMeta.decision&&<DecisionCard decision={aiMeta.decision} language={language} currency={walletCurrency}/>}</><CitedText text={aiText} citations={aiCitations}/><ResearchSources citations={aiCitations} webSearchUsed={aiWebSearchUsed} language={language}/></div></DashboardSection>}<small>{language === 'ar' ? 'يحلّل الإغلاقات المتاحة للسوق ومحفظتك، ويبحث عن الشركة ومؤثراتها بمصادر مؤرخة عند اختيار OpenAI. البحث قد يضيف تكلفة لدى المزود. لا توجد أسعار لحظية.' : 'Uses available market closes and your position. With OpenAI, it searches dated company sources; search may incur provider charges. No live prices.'}</small></> : <div className="empty">{tr("تفاصيل السهم هتظهر بعد تحميل النشرة.")}</div>}</DashboardSection></aside></div></TabsContent>
 <TabsContent forceMount value="portfolio">{account&&<PortfolioSummary key={selectedMarket+walletCurrency} account={account} market={market} history={data?.history} connection={data?.connection} language={language} onSell={(q,n)=>review(q,'sell',n)} onOpen={openDetails} canSell={q=>!!market&&!saving&&!loading&&!canTrade(market,q,data?.connection||'','sell')}/>}<div className="portfolio-ai-prompt"><CopyChatGPT language={language} prepare={()=>copyPortfolio(true)} disabled={!account||!market}/></div><DashboardSection id="portfolio-ai" title={language==='ar'?'مراجعة المحفظة بالذكاء الاصطناعي':'AI portfolio review'} summary={portfolioReport?.overview.slice(0,180)||(language==='ar'?'التحليلات والـprompts محفوظة في سجل AI':'Analyses and prompts are saved in AI history')} language={language}><section className="panel portfolio-ai"><div className="panelheading"><div><p className="eyebrow">{tr("مراجعة المحفظة بالذكاء الاصطناعي")}</p><h2>{tr("أحتفظ بإيه وأراقب شراء إيه؟")}</h2></div><Sparkles size={24}/></div><p className="subtext">{tr("يقرأ أرصدتك وعملياتك الافتراضية ونشرات DFM القديمة قبل أول صفقة، ويعرض سيناريو صعود أو هبوط مشروطًا. لا ينفذ أوامر.")}</p><div className="portfolio-ai-controls"><Select value={horizon} onValueChange={v => { setHorizon(v as 'week' | 'month'); }}><SelectTrigger aria-label={tr("فترة مراجعة المحفظة")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">{tr("الجلسات الخمس القادمة")}</SelectItem><SelectItem value="month">{tr("العشرون جلسة القادمة")}</SelectItem></SelectContent></Select><button className="primary" disabled={portfolioLoading || !market || !account} onClick={settings.configured && settings.model ? reviewPortfolio : () => setSettingsOpen(true)}>{portfolioLoading ? tr('جارٍ مراجعة المحفظة…') : settings.configured && settings.model ? (portfolioReport?(language==='ar'?'إنشاء مراجعة جديدة':'Generate new review'):tr('راجع المحفظة واقترح سيناريوهات')) : tr('ربط نموذج AI للمراجعة')}</button></div><p className="panelnote">{language === 'ar' ? 'يستخدم التطبيق الإغلاقات المتاحة للسوق المختار. سيناريو 5 جلسات يحتاج 10 إغلاقات سابقة، ومقارنة 20 جلسة تحتاج 21 إغلاقًا. مع OpenAI يجري بحثًا مؤرخًا عن الشركات وقد تضاف تكلفة بحث. CSV المستورد غير متحقق، والنتائج افتراضية مشروطة.' : 'Available market closes are loaded. A 5-session scenario needs 10 prior closes; a 20-session comparison needs 21. OpenAI searches dated company sources and may incur search charges. Imported CSV is unverified; scenarios are conditional.'} <a href={isDfm?"https://www.dfm.ae/the-exchange/statistics-reports/historical-data/company-prices":sourceUrl} target="_blank" rel="noreferrer">{tr("إضافة تاريخ من DFM")}</a>.</p>{portfolioError && <p className="negative" role="alert">{tr(portfolioError)}</p>}{portfolioReport && <div className="portfolio-report" role="status"><SavedAnalysisNotice meta={portfolioReport} language={language} onOpen={openSavedHistory}/><p className="metadata">{tr("إغلاق")} {portfolioReport.marketDate} · {portfolioReport.model} · {portfolioReport.coverage.eligible} {tr("من")} {portfolioReport.coverage.listed} {tr("سهم لديه")} {portfolioReport.horizon === 'week' ? 10 : 21} {tr("جلسة أو أكثر ·")} {portfolioReport.coverage.officialDates} {tr("تواريخ DFM محفوظة")}</p><p>{portfolioReport.overview}</p><ResearchSources citations={portfolioReport.citations??[]} webSearchUsed={!!portfolioReport.webSearchUsed} language={language}/><h3>{tr("أسهمك الحالية")}</h3>{portfolioReport.portfolio.length ? portfolioReport.portfolio.map(item => <article className="outlook-card" key={item.symbol}><div className="outlook-heading"><strong dir="ltr">{item.symbol}</strong><span className="tag">{item.action === 'review_sell' ? tr('راجع البيع الافتراضي') : item.action === 'hold' ? tr('احتفاظ للمراجعة') : tr('بيانات غير كافية')}</span></div><p>{item.quantity} {tr("سهم · إغلاق")} {price(item.price)} {tr("AED · تغير 5 جلسات")} {item.change5 === null ? '—' : signed(item.change5) + '%'} {tr("· ربح/خسارة بعد بيع تقديري")} {item.netExit == null ? '—' : signed(item.netExit)} {walletCurrency} · {item.sharia ? tr('بعلامة DFM') : tr('بلا علامة DFM')}</p><p>{tr("السيناريو:")} {item.outlook === 'up' ? tr('ميل للصعود') : item.outlook === 'down' ? tr('ميل للهبوط') : tr('غير واضح')} · {item.reason}</p>{item.decision&&<DecisionCard decision={item.decision} language={language} currency={walletCurrency}/>}<small>{tr("ما الذي قد يغيّره؟")} {item.condition} · {item.sessions} {tr("جلسة (")}{item.officialSessions} {tr("من نشرات DFM،")} {item.importedSessions} {tr("مستوردة)")}</small>{item.action === 'review_sell' && <button className="secondary" disabled={!market || !account || !quotes.some(q => q.symbol === item.symbol) || !!canTrade(market, quotes.find(q => q.symbol === item.symbol)!, data?.connection || '', 'sell')} onClick={() => {
                        const q = quotes.find(q => q.symbol === item.symbol);
                        if (q && item.quantity)
                            review(q, 'sell', item.quantity);
                    }}>{tr("مراجعة بيع افتراضي")}</button>}</article>) : <p>{tr("لم تسجل شراء افتراضي بعد، لذلك لا توجد مراكز لقرار الاحتفاظ أو البيع.")}</p>}{portfolioReport.missingHoldings.map(x => <p className="negative" key={x.symbol}>{tr("لا يوجد إغلاق حالي لسهم")} {x.symbol} ({x.quantity} {tr("سهم)، فلا يمكن تقييمه الآن.")}</p>)}<h3>{tr("فرص شراء افتراضي للمراجعة")}</h3>{portfolioReport.opportunities.length ? portfolioReport.opportunities.map(item => <article className="outlook-card" key={item.symbol}><div className="outlook-heading"><strong dir="ltr">{item.symbol}</strong><span className="tag">{tr("مرشح للمراجعة")}</span></div><p>{tr("إغلاق")} {price(item.price)} {tr("AED · تغير 5 جلسات")} {item.change5 === null ? '—' : signed(item.change5) + '%'} · {item.sharia ? tr('بعلامة DFM') : tr('بلا علامة DFM')}</p><p>{item.reason}</p>{item.decision&&<DecisionCard decision={item.decision} language={language} currency={walletCurrency}/>}<small>{tr("السيناريو مشروط:")} {item.condition} · {item.sessions} {tr("جلسة (")}{item.officialSessions} {tr("من نشرات DFM،")} {item.importedSessions} {tr("مستوردة)")}</small><button className="textbutton" onClick={() => {
                    const q = quotes.find(q => q.symbol === item.symbol);
                    if (q)
                        openDetails(q);
                }}>{tr("افتح السهم والرسم")}</button></article>) : <p>{tr("لا يوجد مرشح شراء مدعوم بجلسات كافية حاليًا. أعد المراجعة إذا تعذّر جلب الأرشيف.")}</p>}</div>}</section></DashboardSection>
 <DashboardSection id="closing-history" title={tr("متابعة الإغلاق يومًا بيوم")} language={language} summary={`${data?.history.length||0} ${language==='ar'?'جلسة':'sessions'}`}><section className="panel history"><div className="panelheading"><div><h2>{tr("متابعة الإغلاق يومًا بيوم")}</h2><p className="subtext">{tr("نحفظ نشرة اليوم عند فتح التطبيق أو تحديثه. الأيام التي لم تُجمع بياناتها لا تظهر؛ لا توجد متابعة في الخلفية حاليًا.")}</p></div></div>{account && data && data.history.some(h => account.trades.some(t => !t.voided && dubaiDay(t.date) <= h.date)) ? <Table><TableHeader><TableRow><TableHead>{tr("تاريخ الإغلاق")}</TableHead><TableHead>{tr("الرصيد + الأسهم · AED")}</TableHead><TableHead>{tr("النتيجة بعد البيع التقديري · AED")}</TableHead></TableRow></TableHeader><TableBody>{data.history.slice().reverse().filter(h => account.trades.some(t => !t.voided && dubaiDay(t.date) <= h.date)).map(h => { const trades = account.trades.filter(t => !t.voided && dubaiDay(t.date) <= h.date); const cash = round(account.initial + trades.reduce((sum, t) => sum + (t.side === 'buy' ? -1 : 1) * round(t.qty * t.price) - t.fee, 0) - (account.expenses||[]).filter(e=>!e.voided&&dubaiDay(e.date)<=h.date).reduce((s,e)=>s+e.amount,0)); const historical = { ...account, cash, trades, broker: trades.at(-1)?.broker || account.broker }; const valuation = totals(historical, { date: h.date, fetchedAt: '', source: sourceUrl,id:selectedMarket, quotes: Object.entries(h.prices).map(([symbol, price]) => ({ symbol, price,currency:walletCurrency })) as Quote[] }); return <TableRow key={h.date}><TableCell>{h.date}</TableCell><TableCell dir="ltr">{valuation.complete ? money(valuation.equity) : tr('سعر ناقص')}</TableCell><TableCell><span dir="ltr" className={valuation.net < 0 ? 'negative' : 'positive'}>{valuation.complete ? signed(valuation.net) : '—'}</span></TableCell></TableRow>; })}</TableBody></Table> : <p className="subtext">{tr("تظهر النتائج مع نشرات الإغلاق التالية لأول عملية. عملية عطلة نهاية الأسبوع تظهر في ملخص المحفظة الآن، ولا نرجع بتاريخها إلى جلسة سابقة.")}</p>}</section></DashboardSection>
 <DashboardSection id="transactions" title={tr("سجل عملياتك")} language={language} summary={`${account?.trades.length||0} ${tr("عملية")}`}><TransactionHistory account={account} quotes={quotes} language={language} onOpen={openDetails}/></DashboardSection></TabsContent>
 <TabsContent forceMount value="ai-history"><DashboardSection id="research-history" title={language==='ar'?'سجل AI المحفوظ':'Saved AI history'} language={language} defaultOpen><ResearchHistory language={language} revision={historyRevision} openId={historyOpenId} onActivate={activateRecord}/></DashboardSection></TabsContent>
 <TabsContent forceMount value="connections"><DashboardSection id="connections" title={tr("المصادر والاتصالات")} language={language} defaultOpen><div className="connection-grid"><section className="panel"><Database className="connection-icon"/><h2>{tr("أسعار سوق دبي")}</h2><span className="tag">{data?.connection === 'ok' ? tr('المصدر الرسمي متاح') : data?.connection === 'cached' ? tr('نسخة محفوظة · فشل التحديث') : tr('غير متاح الآن')}</span><p>{language==='ar'?(isDfm?'نستخدم نشرة DFM الرسمية.':'نستخدم قائمة الأسهم من TradingView وأسعارًا متأخرة. التغطية حسب المصدر وليست ضمانًا لحصر كل ورقة مالية مدرجة.')+' التحديث عند فتح السوق أو الضغط على التحديث، مع تخزين مؤقت حتى 15 دقيقة.':(isDfm?'Uses official DFM bulletins.':'Uses TradingView stock listings and delayed quotes. Coverage depends on the source and is not a guarantee of every listed security.')+' Refreshes on market selection or refresh, with up to 15 minutes of caching.'}</p><p>{tr("تاريخ النشرة:")} {market?.date || '—'}<br />{tr("آخر تحقق:")} {market ? time(market.fetchedAt, language) : '—'} {tr("بتوقيت دبي.")}</p><a className="textbutton" href={sourceUrl} target="_blank" rel="noreferrer">{tr("فتح المصدر الرسمي")} <ExternalLink size={15}/></a></section><section className="panel"><ShieldCheck className="connection-icon"/><h2>{tr("الشرعية والرسوم")}</h2><p>{tr("علامة التوافق الشرعي تظهر كما وردت في النشرة، ولا تمنع المحاكاة للأسهم الأخرى. حالة الشركة قد تتغير؛ الحساب النقدي وغياب الاقتراض الربوي وإقراض الأسهم تحتاج مراجعة منفصلة مع الوسيط.")}</p><p>{isDfm?tr('نحسب الرسوم القياسية لسوق دبي لكل شراء وكل بيع: 0.275% من القيمة + 10 دراهم، وضريبة 5% على الرسوم باستثناء رسم SCA. قد يختلف عقدك أو العرض المتاح لك.'):(language==='ar'?'للأسواق الجديدة أدخل رسوم وسيطك التقديرية بنسبة ومبلغ ثابت بعملة المحفظة. لا توجد بيانات توافق شرعي في هذا المصدر.':'For new markets, enter estimated broker fees as a percentage and fixed amount in the wallet currency. This source supplies no Sharia classification.')}</p>{isDfm&&Object.entries(BROKERS).map(([id, b]) => <p key={id}><a className="textbutton" href={b.source} target="_blank" rel="noreferrer">{tr("جدول")} {b.name} <ExternalLink size={14}/></a></p>)}<small>{(isDfm?tr('مراجعة جداول الرسوم: 26 سبتمبر 2026. اختيار وسيط هنا لا يعني اعتماد جميع خدماته شرعيًا.'):'')}</small></section><section className="panel"><Wallet className="connection-icon"/><h2>{tr("الذكاء الاصطناعي والوسيط")}</h2><span className="tag">{settings.configured && settings.model ? (language === "ar" ? `نموذج ${settings.model} مهيأ` : `Model ${settings.model} is configured`) : tr("الـAI غير مهيأ")}</span><p>{tr("التطبيق يسجل عمليات افتراضية فقط؛ لا يستقبل أموالًا ولا ينفّذ أوامر بحساب تداول حقيقي.")}</p><p>{language==='ar'?'التحليل يستلم السوق والعملة والأسعار المتاحة ومحفظتك المختارة. مع OpenAI يتضمن بحثًا عن الشركات ومصادرها.':'Analysis receives the selected market, currency, available prices and wallet. OpenAI also searches company sources.'}</p><p>{language==='ar'?'الأسواق المتاحة: دبي، أبوظبي، مصر، وأمريكا. المحافظ مستقلة لكل سوق وعملة.':'Markets: DFM, Nasdaq Dubai, ADX, Egypt, US, Saudi Arabia, Qatar, Kuwait and Bahrain. Wallets are separated by market and currency.'}</p></section></div><section className="panel methodology"><h2>{tr("تجاربك السابقة محفوظة")}</h2><p>{tr("المحفظة القديمة بالدولار والأسهم الخيالية منفصلة تمامًا عن حساب تجربة سوق دبي بالدرهم.")}</p><a href="/legacy" className="textbutton">{tr("فتح مساحة التجارب القديمة")}</a></section></DashboardSection></TabsContent>
 </Tabs><div className="portfolio-utilities"><DashboardSection id="market-source" title={language==='ar'?'بيانات السوق':'Market data'} language={language} summary={`${data?.connection==='ok'?(language==='ar'?'المصدر متصل':'Source connected'):(language==='ar'?'المصدر غير متصل · بيانات محفوظة إن توفرت':'Source offline · cached data if available')} · ${market?.date||'—'}`} ><div className="source-strip"><Database size={18}/><span><strong>{data?.connection!=='ok'?(language==='ar'?'بيانات محفوظة — فشل آخر تحديث':'Cached data — last refresh failed'):market?.sourceName||(language==='ar'?'المصدر غير متاح':'Source unavailable')}</strong> · {market?.priceKind==='delayed'?(language==='ar'?'أسعار متأخرة أثناء الجلسة':'Delayed session quotes'):(language==='ar'?'أسعار إغلاق':'Closing prices')} · {language==='ar'?'آخر جلب':'Last fetched'} {market?time(market.fetchedAt,language):'—'}<br/>{language==='ar'?'تحديث تلقائي كل 60 ثانية أثناء فتح التطبيق، وعند العودة إليه. البيانات من المصدر وليست تجريبية؛ قد يتأخر المصدر عن التداول. راجع تاريخ السهم وتأخير المصدر أدناه.':'Refreshes automatically every 60 seconds while visible, and on return. Prices come from the provider, not sample data; the provider may lag trading. Check each stock’s date and source delay below.'}</span><a className="textbutton" href={market?.source||sourceUrl} target="_blank" rel="noreferrer">{language==='ar'?'مصدر الأسعار':'Price source'}</a></div></DashboardSection> {account&&<BrokerCosts key={selectedMarket+walletCurrency} account={account} market={selectedMarket} currency={walletCurrency} version={version} language={language} onSaved={(a,v)=>{setAccount(a);setVersion(v);setBroker(a.broker);setFeePercent(a.customFees?.percent??0);setFeeFixed(a.customFees?.fixed??0)}}/>}</div><footer><span dir="ltr">TradeLens / {selectedMarket.toUpperCase()} · {walletCurrency}</span><span>{tr("أسعار إغلاق يومية · درهم إماراتي · لا يوجد تنفيذ بأموال حقيقية")}</span></footer></main>
 <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}><DialogContent className="history-dialog" dir={language === "ar" ? "rtl" : "ltr"}><DialogTitle>{current?.name} · {current?.symbol}</DialogTitle><DialogDescription>{tr("حركة الإغلاق التاريخية وبيانات DFM. أي ملف تستورده يُعرض كمصدر من المستخدم.")}</DialogDescription>{current && market && <><div className="stock-ai-quick"><strong>{language==='ar'?'تحليل السهم بـ AI':'AI stock analysis'}</strong><CopyChatGPT language={language} prepare={()=>copy(true)} disabled={!current||!market}/></div><div className="history-chart-head"><strong>{tr("السعر عبر الأيام والأسابيع")}</strong><span>{tr("المحور الأفقي: التاريخ · العمودي: سعر السهم بالدرهم")}</span></div><PriceHistoryChart points={historyPoints} language={language} theme={themeChoice} currency={walletCurrency}/><p className="history-source">{tr("الرسم من نشرات DFM القديمة التي يجلبها التطبيق وجلساته المحفوظة ومن ملف CSV الذي تختاره أنت. الملف المستورد لم يتحقق منه التطبيق مقابل السوق.")} <a href={isDfm?"https://www.dfm.ae/the-exchange/statistics-reports/historical-data/company-prices":sourceUrl} target="_blank" rel="noreferrer">{tr("تنزيل التاريخ الرسمي من DFM")}</a> {tr("(اختر الشركة والفترة ثم احفظ ملف Excel بصيغة CSV).")}</p><DashboardSection id="stock-history-import" title={tr("أضف الأسعار السابقة للرسم")} language={language}><div className="history-import"><h3>{tr("أضف الأسعار السابقة للرسم")}</h3><p>{tr("استورد CSV بعمود للتاريخ وعمود لسعر الإغلاق، وعمود للرمز إذا ضم الملف عدة شركات. يُحفظ لسهمك فقط.")}</p><input aria-label={tr("ملف الأسعار CSV")} type="file" accept=".csv,text/csv" onChange={e => void selectCsv(e.target.files?.[0])}/>{csvRows.length > 0 && <><p>{tr("وجدت")} {csvRows.length - 1} {tr("صف. طابق الأعمدة قبل الحفظ:")}</p><div className="history-mapping"><label>{tr("التاريخ")}<select value={dateCol} onChange={e => setDateCol(Number(e.target.value))}>{csvRows[0].map((h, i) => <option key={i} value={i}>{h || (language === "ar" ? `عمود ${i + 1}` : `Column ${i + 1}`)}</option>)}</select></label><label>{tr("سعر الإغلاق")}<select value={priceCol} onChange={e => setPriceCol(Number(e.target.value))}>{csvRows[0].map((h, i) => <option key={i} value={i}>{h || (language === "ar" ? `عمود ${i + 1}` : `Column ${i + 1}`)}</option>)}</select></label><label>{tr("الرمز")}<select value={symbolCol} onChange={e => setSymbolCol(Number(e.target.value))}><option value={-1}>{tr("الملف لهذا السهم فقط")}</option>{csvRows[0].map((h, i) => <option key={i} value={i}>{h || (language === "ar" ? `عمود ${i + 1}` : `Column ${i + 1}`)}</option>)}</select></label></div><small>{tr("معاينة:")} {mappedPoints(csvRows, dateCol, priceCol, symbolCol, current.symbol).length} {tr("جلسة صالحة؛ أول سعر")} {mappedPoints(csvRows, dateCol, priceCol, symbolCol, current.symbol)[0]?.price ?? "—"} {tr("وآخر سعر")} {mappedPoints(csvRows, dateCol, priceCol, symbolCol, current.symbol).at(-1)?.price ?? "—"} {(language==='ar'?`${walletCurrency}. تأكد أن الملف بنفس عملة السهم ومن الفاصلة العشرية.`:`${walletCurrency}. Match the stock currency and decimal separator.`)}</small><button className="secondary" disabled={importSaving} onClick={saveCsv}>{importSaving ? tr('جارٍ الحفظ…') : tr('إضافة بيانات الملف للرسم')}</button></>}{historyError && <p className="negative" role="alert">{tr(historyError)}</p>}</div></DashboardSection><div className="history-facts"><div><span>{tr("إغلاق DFM")}</span><strong dir="ltr">{price(current.price)} {walletCurrency}</strong></div><div><span>{tr("التغير عن السابق")}</span><strong dir="ltr" className={current.change < 0 ? 'negative' : 'positive'}>{signed(current.change)}%</strong></div><div><span>{tr("حجم التداول")}</span><strong>{current.volume.toLocaleString('en-US')}</strong></div><div><span>{tr("التوافق الشرعي")}</span><strong>{current.sharia ? tr('علامة DFM') : tr('بلا علامة')}</strong></div></div><DashboardSection id="stock-dialog-ai" title={language==='ar'?'تحليل AI':'AI analysis'} summary={aiText.slice(0,160)||(language==='ar'?'تحليل السهم والنتائج المحفوظة':'Stock analysis & saved results')} language={language}><div className="history-section"><h3>{tr("تجربة التحليل")}</h3><p>{tr("اقرأ شرحًا مبسطًا للأرقام دون مفتاح API. وعند ضبط نموذجك يمكنك اختباره بطلب تحليل حقيقي.")}</p><div className="history-actions"><button className="secondary" onClick={demo}>{tr("جرّب بدون API")}</button><button className="primary" disabled={!settings.configured || !settings.model || aiLoading} onClick={research}>{aiLoading ? tr('جارٍ اختبار الاتصال…') : (aiText?(language==='ar'?'إنشاء تحليل جديد':'Generate new analysis'):(language==='ar'?'تحليل السهم وبحث الشركة':'Analyze stock and research company'))}</button></div>{!settings.configured && <small>{tr("القراءة الحسابية تجريبية بلا نموذج AI. زر ChatGPT ينسخ البيانات لتلصقها هناك بحسابك؛ النتيجة لا ترجع تلقائيًا للتطبيق. للتحليل داخل التطبيق أضف مفتاح المزود واسم النموذج.")}</small>}{demoText && <div className="ai-result" role="status"><strong>{tr("قراءة حسابية تجريبية")}</strong><p>{demoText}</p></div>}{aiText && <div className="ai-result" role="status"><strong>{tr("استجابة")} {aiMeta.model}</strong><SavedAnalysisNotice meta={aiMeta} language={language} onOpen={openSavedHistory}/>{aiCoverage&&<small className="block">{language==='ar'?`تاريخ الأسعار المرسل: ${aiCoverage.sessions} جلسة (${aiCoverage.official} من المصدر، ${aiCoverage.imported} مستوردة) · ${aiCoverage.first??'—'} إلى ${aiCoverage.last??'—'}`:`Price history sent: ${aiCoverage.sessions} sessions (${aiCoverage.official} provider, ${aiCoverage.imported} imported) · ${aiCoverage.first??'—'} to ${aiCoverage.last??'—'}`}</small>}<>{aiMeta.decision&&<DecisionCard decision={aiMeta.decision} language={language} currency={walletCurrency}/>}</><CitedText text={aiText} citations={aiCitations}/><ResearchSources citations={aiCitations} webSearchUsed={aiWebSearchUsed} language={language}/></div>}{error && <p className="negative" role="alert">{error}</p>}</div></DashboardSection><DashboardSection id="stock-sessions" title={tr("جلسات الرسم المسجلة")} language={language} summary={`${historyPoints.length} ${language==='ar'?'جلسة':'sessions'}`}><div className="history-section"><h3>{tr("جلسات الرسم المسجلة")}</h3><p>{tr("تشمل نشرات DFM السابقة والمحلية والأسعار التي استوردتها. الأيام غير الموجودة لا تظهر هنا.")}</p><div className="snapshot-list">{historyPoints.slice(-30).reverse().map(h => <div key={h.date}><span>{h.date}</span><b dir="ltr">{price(h.price)} {walletCurrency}</b></div>)}{!historyPoints.length && <small>{tr("لا توجد جلسات محفوظة بعد.")}</small>}</div></div></DashboardSection><DashboardSection id="stock-trades" title={tr("عملياتك الافتراضية على السهم")} language={language}><div className="history-section"><h3>{tr("عملياتك الافتراضية على السهم")}</h3>{account?.trades.filter(t => t.symbol === current.symbol).slice().reverse().map(t => <div className="history-trade" key={t.id}><span>{t.voided ? (language==='ar'?'ملغاة':'Cancelled') : t.side === 'buy' ? tr('شراء') : tr('بيع')} {t.qty} {tr("سهم ·")} {time(t.date, language)}</span><b dir="ltr">{price(t.price)} {walletCurrency}</b></div>)}{!account?.trades.some(t => t.symbol === current.symbol) && <p>{tr("لم تسجل عمليات افتراضية لهذا السهم.")}</p>}<a className="textbutton" target="_blank" rel="noreferrer" href={companyUrl(current.symbol,selectedMarket)}>{tr("صفحة الشركة في DFM")} <ExternalLink size={14}/></a></div></DashboardSection></>}</DialogContent></Dialog>
 <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="settings-dialog" dir={language === "ar" ? "rtl" : "ltr"}><DialogTitle>{tr("إعدادات الحساب")}</DialogTitle><DialogDescription>{tr("خيارات العرض والبحث واتصال نموذج الذكاء الاصطناعي.")}</DialogDescription><DashboardSection id="settings-simulation" title={language==='ar'?'المحاكاة ورأس المال':'Simulation & capital'} language={language}>{account&&<SimulationSettings account={account} version={version} market={selectedMarket} currency={walletCurrency} language={language} onSaved={(a,v)=>{setAccount(a);setVersion(v);setAiText('');setPortfolioReport(null);setHistoryRevision(n=>n+1);setOrder(null)}}/>}</DashboardSection><form onSubmit={savePreferences} className="settings-form"><DashboardSection id="settings-appearance" title={language==='ar'?'المظهر واللغة':'Appearance & language'} language={language} defaultOpen><section className="appearance-settings"><h3>{language === 'ar' ? tr('المظهر واللغة') : 'Appearance and language'}</h3><div className="appearance-grid"><label>{language === 'ar' ? tr('المظهر') : 'Theme'}<Select value={themeChoice} onValueChange={v => setThemeChoice(v as ThemeChoice)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">{language === 'ar' ? tr('حسب الجهاز') : 'Use device setting'}</SelectItem><SelectItem value="light">{language === 'ar' ? tr('فاتح') : 'Light'}</SelectItem><SelectItem value="dark">{language === 'ar' ? tr('داكن') : 'Dark'}</SelectItem></SelectContent></Select></label><label>{language === 'ar' ? tr('لغة الواجهة') : 'Interface language'}<Select value={language} onValueChange={v => setLanguage(v as Language)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ar">العربية</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></label></div><p className="appearance-hint">{language === 'ar' ? tr('التغييرات تظهر فورًا وتُحفظ على هذا الجهاز. بيانات المحفظة لا تتغير.') : 'Changes apply immediately and are saved on this device. Your portfolio data stay the same.'}</p></section></DashboardSection><DashboardSection id="settings-ai" title={tr("نموذج AI")} summary={settings.configured?settings.model:tr("الـAI غير مهيأ")} language={language}><h3>{tr("نموذج AI")}</h3><label>{tr("مزود الخدمة")}<Select value={settings.provider} onValueChange={v => {
            if (v !== settings.provider) {
                setSettings({ ...settings, provider: v as PublicSettings['provider'], model: v === 'openrouter' ? 'openrouter/free' : v === 'openai' ? 'gpt-6-luna' : '', endpoint: '', configured: false });
                setNewKey('');
                setClearKey(false);
            }
        }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai">{tr("OpenAI API (مفتاح مستقل)")}</SelectItem><SelectItem value="anthropic">Anthropic / Claude API</SelectItem><SelectItem value="gemini">Google Gemini API</SelectItem><SelectItem value="openrouter">OpenRouter API</SelectItem><SelectItem value="compatible">{tr("مزود متوافق مع OpenAI API")}</SelectItem></SelectContent></Select></label><label>{tr("اسم النموذج (Model ID)")}<input dir="ltr" autoComplete="off" list={settings.provider === 'openai' ? 'openai-model-ids' : undefined} placeholder={settings.provider === 'openai' ? 'gpt-6-luna' : settings.provider === 'openrouter' ? tr('openrouter/free أو nvidia/nemotron-3-super-120b-a12b:free') : tr('اكتب اسم النموذج لدى مزودك')} value={settings.model} onChange={e => setSettings({ ...settings, model: e.target.value })}/></label>{settings.provider === 'openai' && <><datalist id="openai-model-ids"><option value="gpt-6-luna"/><option value="gpt-6-sol"/><option value="gpt-6-astra"/></datalist><p className="panelnote">{language === 'ar' ? 'استخدم Model ID مثل gpt-6-luna أو gpt-6-astra. اسم العرض GPT-6 Astra يتحول تلقائيًا إلى معرّفه الصحيح عند الحفظ. اتصال OpenAI هنا يستخدم Responses API.' : 'Use a Model ID such as gpt-6-luna or gpt-6-astra. The display name GPT-6 Astra is converted to its API ID when saved. OpenAI uses the Responses API here.'}</p></>}{settings.provider === 'openrouter' && <p className="panelnote">{tr("عنوان الاتصال يُضبط تلقائيًا. يمكنك تجربة")} <code dir="ltr">openrouter/free</code> {tr("أو")} <code dir="ltr">nvidia/nemotron-3-super-120b-a12b:free</code> {tr("حسب إتاحته وحدود الاستخدام. تحتاج مفتاح OpenRouter حتى للنماذج المجانية.")} <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">{tr("إنشاء مفتاح")}</a> · <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">{tr("قائمة النماذج")}</a>.</p>}{settings.provider === 'compatible' && <label>{tr("رابط Chat Completions الكامل")}<input dir="ltr" type="url" placeholder="https://example.com/v1/chat/completions" value={settings.endpoint} onChange={e => setSettings({ ...settings, endpoint: e.target.value })}/></label>}{settings.provider === 'compatible' && <p className="panelnote">{tr("هذا رابط نقطة API لدى المزود، وليس رابط محادثة ChatGPT. هذا الاتصال يحتاج مفتاح API خاص بالمزود.")}</p>}<label>{tr("مفتاح API")} <small>{settings.configured && !clearKey ? tr('مفتاح محفوظ؛ اترك الخانة فارغة للإبقاء عليه.') : tr('المفتاح غير محفوظ.')}</small><input dir="ltr" type="password" autoComplete="new-password" placeholder={tr("ألصق مفتاح API هنا")} value={newKey} onChange={e => { setNewKey(e.target.value); setClearKey(false); }}/></label>{settings.configured && <label className="inline-check"><input type="checkbox" checked={clearKey} onChange={e => setClearKey(e.target.checked)}/>{tr("حذف المفتاح المحفوظ")}</label>}<p className="panelnote">{tr("اشتراك ChatGPT ومحادثاتك لا تتحول إلى مفتاح API ولا تُستهلك حصتها هنا. عند تغيير المزود يُفصل المفتاح السابق؛ أدخل مفتاح المزود الجديد. يُحفظ المفتاح مشفرًا لحسابك، ولا يُعرض مرة أخرى. طلبات التحليل تُرسل إلى المزود الذي تختاره وقد تُحتسب ضمن فاتورته. رابط المزود المخصص يستقبل مفتاحك وبيانات السهم.")}</p></DashboardSection><DashboardSection id="settings-market" title={tr("عرض السوق")} language={language}><h3>{tr("عرض السوق")}</h3><label>{tr("فلتر الشريعة عند الفتح")}<Select value={settings.preferences.defaultSharia} onValueChange={v => setSettings({ ...settings, preferences: { ...settings.preferences, defaultSharia: v as PublicSettings['preferences']['defaultSharia'] } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{tr("كل الأسهم")}</SelectItem><SelectItem value="approved">{tr("بعلامة توافق فقط")}</SelectItem><SelectItem value="unmarked">{tr("بدون علامة")}</SelectItem></SelectContent></Select></label><p className="panelnote">{language==='ar'?'تحديث الأسعار تلقائي كل دقيقة أثناء فتح التطبيق. يعيد التحديث عند العودة للتطبيق أو عودة الإنترنت.':'Prices refresh every minute while the app is visible, and when returning or reconnecting.'}</p><label className="inline-check"><input type="checkbox" checked={settings.preferences.compactRows} onChange={e => setSettings({ ...settings, preferences: { ...settings.preferences, compactRows: e.target.checked } })}/>{tr("صفوف مدمجة في جدول الأسهم")}</label></DashboardSection><DashboardSection id="settings-account" title={language==='ar'?'الحساب':'Account'} language={language}><section className="profile-settings"><h3>{language === 'ar' ? tr('الحساب') : 'Account'}</h3><p>{language === 'ar' ? tr('محفظتك الافتراضية وإعدادات نموذج AI مرتبطة بحسابك. إعدادات المظهر واللغة محفوظة على هذا الجهاز.') : 'Your virtual portfolio and AI model settings belong to your account. Appearance and language are saved on this device.'}</p><a className="textbutton" href="/signout-with-chatgpt?return_to=%2F" target="_top"><LogOut size={15}/>{language === 'ar' ? tr('تسجيل الخروج') : 'Sign out'}</a></section></DashboardSection>{error && <p className="negative" role="alert">{error}</p>}<button className="primary full" disabled={settingsSaving}>{settingsSaving ? tr('جارٍ الحفظ…') : tr('حفظ الإعدادات')}</button></form></DialogContent></Dialog>
 <Dialog open={!!order} onOpenChange={v => {
            if (!v && !saving)
                setOrder(null);
        }}><DialogContent className="paper-dialog" dir={language === "ar" ? "rtl" : "ltr"}><DialogTitle>{tr("مراجعة")} {order?.side === 'buy' ? tr('شراء') : tr('بيع')} {tr("افتراضي")}</DialogTitle><DialogDescription>{tr("محاكاة بآخر سعر منشور وقد يكون متأخرًا؛ لا تضمن إمكانية تنفيذه فعليًا.")}</DialogDescription>{order && <form onSubmit={submit}><h3 dir="ltr">{order.symbol} · {price(order.price)} {walletCurrency}</h3><p className="metadata">{tr("نشرة")} {order.quoteDate} · {BROKERS[order.broker].name}</p><label>{tr("عدد الأسهم")}<input type="number" required min="1" max="10000000" step="1" value={Number.isNaN(order.qty) ? '' : order.qty} onChange={e => setOrder({ ...order, qty: e.target.value === '' ? NaN : Number(e.target.value) })}/></label><label>{tr("سبب القرار (اختياري)")}<textarea maxLength={500} value={order.note} onChange={e => setOrder({ ...order, note: e.target.value })}/></label>{orderFee && <dl className="stock-facts"><div><dt>{tr("قيمة الأسهم")}</dt><dd dir="ltr">{money(order.qty * order.price)} {walletCurrency}</dd></div>{orderFee.lines.map((line,i)=><div key={i}><dt>{line.label}</dt><dd dir="ltr">{money(line.amount)} {walletCurrency}</dd></div>)}<div><dt>{tr("إجمالي رسوم العملية")}</dt><dd dir="ltr">{money(orderFee.total)} {walletCurrency}</dd></div><div><dt>{order.side === 'buy' ? tr('إجمالي الخصم') : tr('صافي حصيلة البيع')}</dt><dd dir="ltr">{money(Math.round(order.qty * order.price * 100) / 100 + (order.side === 'buy' ? orderFee.total : -orderFee.total))} {walletCurrency}</dd></div></dl>}{order.side === 'buy' && selectedOrder && !selectedOrder.sharia && <p className="panelnote">{tr("هذا السهم لا يحمل علامة توافق شرعي في النشرة. العملية افتراضية؛ راجع الحالة بنفسك قبل أي تعامل حقيقي.")}</p>}{orderReason && <p className="negative">{orderReason}</p>}{error && <p className="negative" role="alert">{error}</p>}<button className="primary full" disabled={saving || !account || !!orderReason || !Number.isSafeInteger(order.qty) || order.qty < 1}>{saving ? tr('جارٍ الحفظ…') : tr('تأكيد العملية الافتراضية')}</button><small>{tr("الشراء والبيع لهما رسوم مستقلة. قد توجد فروق تقريب بسيطة عن كشف الوسيط.")}</small></form>}</DialogContent></Dialog>
 </div>;
}

function safeSource(url:string){try{return new URL(url).protocol==='https:'}catch{return false}}
function CitedText({text,citations}:{text:string;citations:Citation[]}){
    const spans=citations.filter(c=>safeSource(c.url)&&Number.isInteger(c.startIndex)&&Number.isInteger(c.endIndex)&&c.startIndex!>=0&&c.endIndex!>c.startIndex!&&c.endIndex!<=text.length&&c.endIndex!-c.startIndex!<300)
        .sort((a,b)=>a.startIndex!-b.startIndex!);
    const parts:React.ReactNode[]=[];let cursor=0;
    for(const citation of spans){
        if(citation.startIndex!<cursor)continue;
        parts.push(text.slice(cursor,citation.startIndex));
        parts.push(<a key={parts.length} href={citation.url} title={citation.title} target="_blank" rel="noopener noreferrer">{text.slice(citation.startIndex,citation.endIndex)}</a>);
        cursor=citation.endIndex!;
    }
    parts.push(text.slice(cursor));
    return <p>{parts}</p>;
}
function ResearchSources({citations,webSearchUsed,language}:{citations:Citation[];webSearchUsed:boolean;language:Language}){
    if(!webSearchUsed)return <small className="block">{language==='ar'?'لم يُجرَ بحث ويب في هذا الطلب. مزود OpenAI يدعم البحث داخل التطبيق؛ بقية المزودين يستخدمون الأسعار المرفقة فقط.':'No web search ran. OpenAI supports in-app search; other providers use the attached prices only.'}</small>;
    const sources=[...new Map(citations.filter(c=>safeSource(c.url)).map(c=>[c.url,c])).values()].slice(0,12);
    return <div className="research-sources"><strong>{language==='ar'?'مصادر البحث':'Research sources'}</strong>{sources.length?sources.map((source,i)=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{i+1}. {source.title}</a>):<small>{language==='ar'?'أُجري البحث، لكن لم يُرجع النموذج روابط قابلة للتحقق؛ لا تعتمد على أي خبر غير موثق في الرد.':'Search ran, but the model returned no verifiable links. Do not rely on unsourced news in the result.'}</small>}</div>;
}

function SavedAnalysisNotice({meta,language,onOpen}:{meta:SavedMeta;language:Language;onOpen:(id?:string)=>void}){
    return <div className="saved-analysis-notice">{meta.saveError?<p className="negative" role="alert">{language==='ar'?meta.saveError:'This result could not be saved. Copy it before leaving. Earlier saved results are unchanged.'}</p>:meta.createdAt&&<small>{language==='ar'?'نسخة محفوظة':'Saved version'} · {time(meta.createdAt,language)}<br/>{language==='ar'?'تحديث الأسعار لا يغيّر هذه النتيجة.':'Price refreshes do not change this result.'}</small>}{meta.historyId&&<button className="textbutton" onClick={()=>onOpen(meta.historyId)}>{language==='ar'?'عرض الـprompt والسجل':'View prompt and history'}</button>}</div>;
}
