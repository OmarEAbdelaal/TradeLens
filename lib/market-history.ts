import {database} from '@/db/store';
import type {Market} from './market';
import {officialHistory} from './dfm-archive';
import type {Snapshot} from './portfolio-outlook';
import {providerHistorySnapshots} from './provider-history';
export async function savedMarketHistory(market:Market,symbols?:string[]):Promise<Snapshot[]>{
 const db=database();
 if(!market.id||market.id==='dfm'){
  const rows=await db.prepare('SELECT data FROM market_snapshots ORDER BY date DESC LIMIT 90').all<{data:string}>();
  return rows.results.map(r=>{const m=JSON.parse(r.data) as Market;return {date:m.date,prices:Object.fromEntries(m.quotes.filter(q=>q.lastTrade===m.date&&q.volume>0).map(q=>[q.symbol,q.price]))}}).reverse();
 }
 if(symbols&&!symbols.length)return [];
 const wanted=symbols?new Set(symbols):null;
 const cutoff=new Date(Date.parse(market.date+'T00:00:00Z')-50*86400000).toISOString().slice(0,10);
 const rows=await db.prepare('SELECT date,data FROM exchange_history WHERE market=? AND date>=? AND date<=? ORDER BY date').bind(market.id,cutoff,market.date).all<{date:string;data:string}>();
 const days=new Map<string,Record<string,number>>();for(const row of rows.results){const raw=JSON.parse(row.data) as Record<string,number>;const prices=wanted?Object.fromEntries(Object.entries(raw).filter(([symbol])=>wanted.has(symbol))):raw;days.set(row.date,{...days.get(row.date),...prices})}
 return [...days].map(([date,prices])=>({date,prices}));
}
function mergeSnapshots(rows:Snapshot[]){
 const days=new Map<string,Snapshot>();for(const row of rows){const old=days.get(row.date);days.set(row.date,{date:row.date,prices:{...old?.prices,...row.prices},volumes:{...old?.volumes,...row.volumes}})}return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export async function marketHistory(market:Market,count=60,hydrateProvider=false):Promise<Snapshot[]>{
 const [saved,archive,provider]=await Promise.all([savedMarketHistory(market,market.quotes.map(q=>q.symbol)),!market.id||market.id==='dfm'?officialHistory(market,count):Promise.resolve([]),hydrateProvider&&market.id&&market.id!=='dfm'?providerHistorySnapshots(market):Promise.resolve({snapshots:[]})]);
 return mergeSnapshots([...archive,...saved,...provider.snapshots]).slice(-count);
}
