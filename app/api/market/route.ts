import {marketData} from '@/lib/market-server';
import {database} from '@/db/store';
import type {Market} from '@/lib/market';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!req.headers.get('oai-authenticated-user-id'))return Response.json({error:'افتح التطبيق بحسابك لحفظ تجربتك الخاصة.'},{status:401});try{const result=await marketData();const rows=await database().prepare('SELECT data FROM market_snapshots ORDER BY date DESC LIMIT 90').all<{data:string}>();return Response.json({...result,history:rows.results.map(r=>{const m=JSON.parse(r.data) as Market;return {date:m.date,prices:Object.fromEntries(m.quotes.map(q=>[q.symbol,q.price]))}}).reverse()},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'تعذّر تحميل بيانات السوق. حاول مرة أخرى.'},{status:503})}}
