export const MARKET_IDS=['dfm','nasdaqdubai','adx','egx','us','saudi','qatar','kuwait','bahrain'] as const;
export const EXCHANGES:Record<string,string>={dfm:'DFM',nasdaqdubai:'NASDAQDUBAI',adx:'ADX',egx:'EGX',saudi:'TADAWUL',qatar:'QSE',kuwait:'KSE',bahrain:'BHB'};
export const MARKETS={
 dfm:{ar:'سوق دبي المالي',en:'Dubai Financial Market',currency:'AED',zone:'Asia/Dubai',source:'https://service.dfm.ae/Bulletins/',scanner:'uae'},
 nasdaqdubai:{ar:'ناسداك دبي',en:'Nasdaq Dubai',currency:'USD',zone:'Asia/Dubai',source:'https://www.nasdaqdubai.com/trading/historical-prices',scanner:'uae'},
 adx:{ar:'سوق أبوظبي',en:'Abu Dhabi Securities Exchange',currency:'AED',zone:'Asia/Dubai',source:'https://www.tradingview.com/markets/stocks-uae/market-movers-all-stocks/',scanner:'uae'},
 egx:{ar:'البورصة المصرية',en:'Egyptian Exchange',currency:'EGP',zone:'Africa/Cairo',source:'https://www.tradingview.com/markets/stocks-egypt/market-movers-all-stocks/',scanner:'egypt'},
 us:{ar:'السوق الأمريكي',en:'US stock markets',currency:'USD',zone:'America/New_York',source:'https://www.tradingview.com/markets/stocks-usa/market-movers-all-stocks/',scanner:'america'},
 saudi:{ar:'السوق السعودي',en:'Saudi Exchange',currency:'SAR',zone:'Asia/Riyadh',source:'https://www.tradingview.com/markets/stocks-ksa/',scanner:'ksa'},
 qatar:{ar:'بورصة قطر',en:'Qatar Exchange',currency:'QAR',zone:'Asia/Qatar',source:'https://www.tradingview.com/markets/stocks-qatar/',scanner:'qatar'},
 kuwait:{ar:'بورصة الكويت',en:'Boursa Kuwait',currency:'KWD',zone:'Asia/Kuwait',source:'https://www.tradingview.com/markets/stocks-kuwait/',scanner:'kuwait'},
 bahrain:{ar:'بورصة البحرين',en:'Bahrain Bourse',currency:'BHD',zone:'Asia/Bahrain',source:'https://www.tradingview.com/markets/stocks-bahrain/',scanner:'bahrain'}
} as const;
export type MarketId=keyof typeof MARKETS;
export const marketId=(value:unknown):MarketId=>typeof value==='string'&&Object.hasOwn(MARKETS,value)?value as MarketId:'dfm';
export const isMarketId=(value:unknown):value is MarketId=>typeof value==='string'&&Object.hasOwn(MARKETS,value);
export const currencyCode=(value:unknown,fallback:string)=>typeof value==='string'&&/^[A-Z]{3}$/.test(value)?value:fallback;
export const tradingCurrency=(quote:{currency?:string})=>quote.currency||'AED';
export const companyUrl=(symbol:string,id:MarketId)=>id==='dfm'?`https://www.dfm.ae/the-exchange/market-information/company/${encodeURIComponent(symbol)}`:`https://www.tradingview.com/symbols/${encodeURIComponent(symbol.replace(':','-'))}/`;
export const accountScope=(user:string,id:MarketId,currency:string)=>JSON.stringify([user,id,currency]);
export function sessionCompleted(date:string,id:MarketId,now=new Date()){

 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:MARKETS[id].zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',minute:'2-digit'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const today=`${p.year}-${p.month}-${p.day}`;
 return date<today||(date===today&&Number(p.hour)*60+Number(p.minute)>=(id==='us'?17*60:id==='egx'?16*60:16*60));
}
