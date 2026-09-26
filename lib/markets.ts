export const MARKETS={
 dfm:{ar:'سوق دبي المالي',en:'Dubai Financial Market',currency:'AED',zone:'Asia/Dubai',source:'https://service.dfm.ae/Bulletins/',scanner:'uae'},
 adx:{ar:'سوق أبوظبي',en:'Abu Dhabi Securities Exchange',currency:'AED',zone:'Asia/Dubai',source:'https://www.tradingview.com/markets/stocks-uae/market-movers-all-stocks/',scanner:'uae'},
 egx:{ar:'البورصة المصرية',en:'Egyptian Exchange',currency:'EGP',zone:'Africa/Cairo',source:'https://www.tradingview.com/markets/stocks-egypt/market-movers-all-stocks/',scanner:'egypt'},
 us:{ar:'السوق الأمريكي',en:'US stock markets',currency:'USD',zone:'America/New_York',source:'https://www.tradingview.com/markets/stocks-usa/market-movers-all-stocks/',scanner:'america'}
} as const;
export type MarketId=keyof typeof MARKETS;
export const marketId=(value:unknown):MarketId=>typeof value==='string'&&Object.hasOwn(MARKETS,value)?value as MarketId:'dfm';
export const isMarketId=(value:unknown):value is MarketId=>typeof value==='string'&&Object.hasOwn(MARKETS,value);
export const currencyCode=(value:unknown,fallback:string)=>typeof value==='string'&&/^[A-Z]{3}$/.test(value)?value:fallback;
export const tradingCurrency=(quote:{currency?:string})=>quote.currency||'AED';
export const companyUrl=(symbol:string,id:MarketId)=>id==='dfm'?`https://www.dfm.ae/the-exchange/market-information/company/${encodeURIComponent(symbol)}`:`https://www.tradingview.com/symbols/${encodeURIComponent(symbol.replace(':','-'))}/`;
export const accountScope=(user:string,id:MarketId,currency:string)=>JSON.stringify([user,id,currency]);
export function sessionCompleted(date:string,id:MarketId,now=new Date()){
 if(id==='dfm')return true;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:MARKETS[id].zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',minute:'2-digit'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const today=`${p.year}-${p.month}-${p.day}`;
 return date<today||(date===today&&Number(p.hour)*60+Number(p.minute)>=(id==='us'?17*60:id==='egx'?16*60:16*60));
}
