import {database} from '@/db/store';
import type {Market,MarketResponse} from './market';
import type {MarketId} from './markets';
import {fetchExchange} from './exchange-feed';
export async function exchangeData(id:MarketId):Promise<MarketResponse>{
 const db=database();
 const rows=await db.prepare('SELECT generation,data FROM exchange_cache WHERE market=? ORDER BY key').bind(id).all<{generation:string;data:string}>();
 const generation=rows.results[0]?.generation;
 const pieces=rows.results.filter(r=>r.generation===generation).map(r=>JSON.parse(r.data) as Market);
 const cached=pieces.length?{...pieces[0],quotes:pieces.flatMap(p=>p.quotes)}:null;
 if(cached&&Date.now()-Date.parse(cached.fetchedAt)<45*1000)return {market:cached,connection:'ok'};
 try{
  const market=await fetchExchange(id);const statements=[];
  for(let start=0;start<market.quotes.length;start+=500){
   statements.push(db.prepare('INSERT INTO exchange_cache(key,market,generation,data) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET generation=excluded.generation,data=excluded.data').bind(`${id}:${String(start).padStart(6,'0')}`,id,market.fetchedAt,JSON.stringify({...market,quotes:market.quotes.slice(start,start+500)})));
  }
  statements.push(db.prepare('DELETE FROM exchange_cache WHERE market=? AND generation<>?').bind(id,market.fetchedAt));
  const closes=market.quotes.filter(q=>q.priceKind==='close'&&q.lastTrade===market.date&&q.volume>0&&q.price>0);
  for(let start=0;start<closes.length;start+=1000){const prices=Object.fromEntries(closes.slice(start,start+1000).map(q=>[q.symbol,q.price]));statements.push(db.prepare('INSERT INTO exchange_history(key,market,date,data) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind(`${id}:${market.date}:${start}`,id,market.date,JSON.stringify(prices)))}
  await db.batch(statements);return {market,connection:'ok'};
 }catch(error){console.warn('Market source unavailable',id,error instanceof Error?error.message:'Unknown');return {market:cached,connection:cached?'cached':'unavailable',error:'تعذّر تحديث هذا السوق من مزود البيانات. جرّب التحديث لاحقًا؛ لا يُسمح بتسجيل عملية بسعر غير متحقق.'}}
}
