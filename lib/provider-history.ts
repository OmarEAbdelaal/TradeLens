import {database} from '@/db/store';
import type {Market,Quote} from './market';
import type {PricePoint,Snapshot} from './portfolio-outlook';
import {tradingCurrency,type MarketId} from './markets';

type SearchItem={pairId:number;name:string;link:string;symbol:string;pair_type?:string;countryID?:number;exchange?:string;exchangeID?:number};
type HistoryRow={rowDateTimestamp?:string;rowDateRaw?:number;last_closeRaw?:string|number;volumeRaw?:number};
type HistoryPayload={data?:HistoryRow[]};
type CacheRow={provider_id:number;source:string;data:string;fetched_through:string;updated_at:string};
export type ProviderHistory={points:PricePoint[];source:string;providerId:number;cached:boolean};

const MARKET_MATCH:Partial<Record<Exclude<MarketId,'dfm'>,(item:SearchItem)=>boolean>>={
 nasdaqdubai:item=>['Nasdaq Dubai','NASDAQ Dubai','NASDAQ Dubai Ltd'].includes(item.exchange||''),
 saudi:item=>['Saudi Arabia','Saudi Arabia Stock Exchange','Tadawul','Saudi Arabia Exchange'].includes(item.exchange||''),
 qatar:item=>['Qatar','Doha','Qatar Exchange'].includes(item.exchange||''),
 kuwait:item=>['Kuwait','Kuwait Stock Exchange'].includes(item.exchange||''),
 bahrain:item=>['Bahrain','Bahrain Stock Exchange'].includes(item.exchange||''),
 adx:item=>item.exchangeID===100||item.exchange==='Abu Dhabi',
 egx:item=>item.exchangeID===33||item.countryID===59||item.exchange==='Egypt',
 us:item=>item.countryID===5||item.exchange==='NASDAQ'||item.exchange==='NYSE'||item.exchange==='NYSE Amex'||item.exchange==='OTC Markets'
};
const normalized=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'');
export function parseInvestingSearch(html:string){
 const match=html.match(/window\.allResultsQuotesDataArray\s*=\s*(\[[\s\S]*?\]);/);if(!match)return [];
 const raw=JSON.parse(match[1]) as unknown;if(!Array.isArray(raw))return [];
 return raw.filter((item):item is SearchItem=>!!item&&typeof item==='object'&&Number.isInteger((item as SearchItem).pairId)&&typeof (item as SearchItem).name==='string'&&typeof (item as SearchItem).link==='string'&&/^\/equities\/[a-z0-9?=&_-]+$/i.test((item as SearchItem).link)&&typeof (item as SearchItem).symbol==='string');
}
export function selectInvestingInstrument(items:SearchItem[],quote:Quote,id:Exclude<MarketId,'dfm'>){
 const ticker=quote.ticker||quote.symbol.split(':').at(-1)||quote.symbol;
 const candidates=items.filter(item=>item.pair_type==='equities'&&MARKET_MATCH[id]?.(item)&&normalized(item.symbol)===normalized(ticker));
 if(candidates.length===1)return candidates[0];
 const words=quote.name.toLowerCase().split(/\W+/).filter(w=>w.length>3);
 return candidates.sort((a,b)=>words.filter(w=>b.name.toLowerCase().includes(w)).length-words.filter(w=>a.name.toLowerCase().includes(w)).length)[0]||null;
}
export function parseInvestingHistory(payload:unknown,quote:Quote,marketDate:string){
 const rows=(payload as HistoryPayload)?.data;if(!Array.isArray(rows))return [];
 const points:PricePoint[]=[];
 for(const row of rows){
  const date=typeof row.rowDateTimestamp==='string'?row.rowDateTimestamp.slice(0,10):typeof row.rowDateRaw==='number'?new Date(row.rowDateRaw*1000).toISOString().slice(0,10):'';
  const price=typeof row.last_closeRaw==='number'?row.last_closeRaw:typeof row.last_closeRaw==='string'?Number(row.last_closeRaw):NaN;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>marketDate||!Number.isFinite(price)||price<=0||price>1000000)continue;
  const volume=typeof row.volumeRaw==='number'&&Number.isFinite(row.volumeRaw)&&row.volumeRaw>=0?Math.round(row.volumeRaw):undefined;
  points.push({date,price:Math.round(price*1e8)/1e8,volume});
 }
 const distinct=[...new Map(points.map(point=>[point.date,point])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-270);
 const latest=distinct.at(-1);if(!latest)return [];
 const expectedDate=quote.lastTrade||marketDate;
 if(Math.abs(Date.parse(`${expectedDate}T00:00:00Z`)-Date.parse(`${latest.date}T00:00:00Z`))>10*86400000)return [];
 if(quote.price>0&&Math.abs(latest.price/quote.price-1)>.2)return [];
 return distinct;
}
async function textWithin(response:Response,max:number){
 if(!response.ok)throw new Error(`History provider HTTP ${response.status}`);const text=await response.text();if(!text||text.length>max)throw new Error('Invalid provider response size');return text;
}
async function fetchFresh(quote:Quote,id:Exclude<MarketId,'dfm'>,marketDate:string):Promise<ProviderHistory>{
 const ticker=quote.ticker||quote.symbol.split(':').at(-1)||quote.symbol;
 const search=await fetch(`https://www.investing.com/search/?q=${encodeURIComponent(ticker)}`,{headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; TradeLens/1.0)'},signal:AbortSignal.timeout(18000),redirect:'manual'});
 const item=selectInvestingInstrument(parseInvestingSearch(await textWithin(search,1500000)),quote,id);if(!item)throw new Error('No matching historical instrument');
 const start=new Date(Date.parse(`${marketDate}T00:00:00Z`)-400*86400000).toISOString().slice(0,10);
 const url=`https://api.investing.com/api/financialdata/historical/${item.pairId}?start-date=${start}&end-date=${marketDate}&interval=P1D&time-frame=Daily`;
 const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; TradeLens/1.0)','domain-id':'www'},signal:AbortSignal.timeout(18000),redirect:'manual'});
 const payload=JSON.parse(await textWithin(response,2500000)) as unknown;
 const points=parseInvestingHistory(payload,quote,marketDate);if(points.length<20)throw new Error('Insufficient validated provider history');
 return {points,source:`https://www.investing.com${item.link.replace(/-historical-data$/,'')}-historical-data`,providerId:item.pairId,cached:false};
}
export async function providerHistory(quote:Quote,id:Exclude<MarketId,'dfm'>,marketDate:string):Promise<ProviderHistory|null>{
 if(!MARKET_MATCH[id])return null;
 const db=database(),key=`${id}:${quote.symbol}`;
 const row=await db.prepare('SELECT provider_id,source,data,fetched_through,updated_at FROM provider_price_history WHERE key=?').bind(key).first<CacheRow>();
 if(row&&row.fetched_through>=marketDate)return {points:JSON.parse(row.data),source:row.source,providerId:row.provider_id,cached:true};
 try{
  const fresh=await fetchFresh(quote,id,marketDate),now=new Date().toISOString();
  await db.prepare('INSERT INTO provider_price_history(key,market,symbol,currency,provider_id,source,data,fetched_through,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET currency=excluded.currency,provider_id=excluded.provider_id,source=excluded.source,data=excluded.data,fetched_through=excluded.fetched_through,updated_at=excluded.updated_at').bind(key,id,quote.symbol,tradingCurrency(quote),fresh.providerId,fresh.source,JSON.stringify(fresh.points),fresh.points.at(-1)!.date,now).run();
  return fresh;
 }catch(error){console.warn('Historical provider unavailable',id,quote.symbol,error instanceof Error?error.message:'Unknown');return row?{points:JSON.parse(row.data),source:row.source,providerId:row.provider_id,cached:true}:null}
}
export async function providerHistorySnapshots(market:Market,quotes:Quote[]=market.quotes):Promise<{snapshots:Snapshot[];sources:string[];covered:number}>{
 if(!market.id||market.id==='dfm')return {snapshots:[],sources:[],covered:0};
 const results:{symbol:string;history:ProviderHistory}[]=[];
 for(let start=0;start<quotes.length;start+=4){const slice=quotes.slice(start,start+4),batch=await Promise.all(slice.map(q=>providerHistory(q,market.id as Exclude<MarketId,'dfm'>,market.date)));batch.forEach((history,index)=>{if(history)results.push({symbol:slice[index].symbol,history})})}
 const days=new Map<string,Snapshot>();
 results.forEach(({symbol,history})=>{for(const point of history.points){const day=days.get(point.date)||{date:point.date,prices:{},volumes:{}};day.prices[symbol]=point.price;if(point.volume!==undefined)day.volumes![symbol]=point.volume;days.set(point.date,day)}});
 return {snapshots:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),sources:[...new Set(results.map(r=>r.history.source))],covered:results.length};
}
