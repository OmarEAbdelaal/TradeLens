import {database} from '@/db/store';
import {parseBulletin,MARKET_SOURCE,type Market,type MarketResponse} from './market';
export async function marketData():Promise<MarketResponse>{
 const db=database();const row=await db.prepare('SELECT data FROM market_snapshots ORDER BY date DESC LIMIT 1').first<{data:string}>();const cached=row?JSON.parse(row.data) as Market:null;
 if(cached&&Date.now()-Date.parse(cached.fetchedAt)<15*60*1000)return {market:cached,connection:'ok'};
 try{const response=await fetch(MARKET_SOURCE,{signal:AbortSignal.timeout(18000),headers:{Accept:'text/html'}});if(!response.ok)throw new Error('Source unavailable');const html=await response.text();if(html.length>3000000)throw new Error('Oversized bulletin');const fresh=parseBulletin(html);
 if(cached&&fresh.date<cached.date)throw new Error('Source returned older bulletin');
 await db.prepare('INSERT INTO market_snapshots (date,data) VALUES (?,?) ON CONFLICT(date) DO UPDATE SET data=excluded.data').bind(fresh.date,JSON.stringify(fresh)).run();return {market:fresh,connection:'ok'};
 }catch(error){console.error('Market fetch failed',error instanceof Error?error.message:'Unknown');return {market:cached,connection:cached?'cached':'unavailable',error:'تعذّر تحديث النشرة الرسمية الآن. لا تُسجّل عمليات جديدة حتى يعود المصدر.'}}
}
