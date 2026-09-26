import * as XLSX from 'xlsx';
import {database} from '@/db/store';
import type {Market} from './market';
import type {Snapshot} from './portfolio-outlook';

export const ARCHIVE_SOURCE='https://service.dfm.ae/Bulletins/';
const text=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();
const number=(value:unknown)=>Number(text(value).replace(/,/g,''));
const ddmmyyyy=(date:string)=>`${date.slice(8,10)}${date.slice(5,7)}${date.slice(0,4)}`;
const displayDate=(date:string)=>`${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}`;

// The link is the DFM bulletin's own "Export to excel" URL for that calendar day.
export function archiveUrl(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');return `${ARCHIVE_SOURCE}Bulletins/DownloadFullExcel?bdate=Daily_Bulletin_${ddmmyyyy(date)}`}

export function parseArchive(bytes:Uint8Array,date:string,knownSymbols:Set<string>):Snapshot{
 const book=XLSX.read(bytes,{type:'array',dense:true});
 for(const sheetName of book.SheetNames){
  const rows=XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName],{header:1,raw:false,defval:''});
  const headerIndex=rows.findIndex(row=>row.some(v=>/Symbol\s*-\s*Security Name|رمز الشركة\s*-/.test(text(v)))&&row.some(v=>/Current Close|سعر الإغلاق الحالي/.test(text(v))));
  if(headerIndex<0)continue;
  const headers=rows[headerIndex].map(text);
  const symbolCol=headers.findIndex(v=>/Symbol\s*-\s*Security Name|رمز الشركة\s*-/.test(v));
  const closeCol=headers.findIndex(v=>/Current Close|سعر الإغلاق الحالي/.test(v));
  const lastCol=headers.findIndex(v=>/Last Date|تاريخ آخر صفقة/.test(v));
  const volumeCol=headers.findIndex(v=>/Trade Volume|كمية التداول/.test(v));
  if([symbolCol,closeCol,lastCol,volumeCol].some(i=>i<0))continue;
  const prices:Record<string,number>={};
  for(const row of rows.slice(headerIndex+1)){
   const symbol=text(row[symbolCol]).match(/^([A-Z0-9.\-]+)\s*-/)?.[1];
   if(!symbol||!knownSymbols.has(symbol))continue;
   const close=number(row[closeCol]);
   if(text(row[lastCol])===displayDate(date)&&number(row[volumeCol])>0&&Number.isFinite(close)&&close>0)prices[symbol]=close;
  }
  if(Object.keys(prices).length>=5)return {date,prices};
 }
 throw new Error('Archive columns or trading date did not match');
}

function priorWeekdays(end:string,count:number){const dates:string[]=[];const d=new Date(`${end}T00:00:00Z`);while(dates.length<count){d.setUTCDate(d.getUTCDate()-1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)dates.push(d.toISOString().slice(0,10))}return dates}

export async function officialHistory(market:Market,needed=28):Promise<Snapshot[]>{
 const dates=priorWeekdays(market.date,needed);
 const db=database();
 const cached=await db.prepare('SELECT date,data FROM official_price_history WHERE date>=? AND date<? ORDER BY date DESC').bind(dates.at(-1),market.date).all<{date:string;data:string}>();
 const found=new Map(cached.results.map(r=>[r.date,JSON.parse(r.data) as Record<string,number>]));
 const missing=dates.filter(date=>!found.has(date));
 const symbols=new Set(market.quotes.map(q=>q.symbol));
 // Bound both requests and simultaneous connections; a failed date never becomes fabricated data.
 for(let i=0;i<missing.length;i+=6){
  await Promise.all(missing.slice(i,i+6).map(async date=>{
   try{
    const response=await fetch(archiveUrl(date),{signal:AbortSignal.timeout(11000),headers:{Accept:'application/octet-stream'},redirect:'manual'});
    if(!response.ok||Number(response.headers.get('content-length')||0)>5000000)throw new Error(`Archive HTTP ${response.status}`);
    const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>5000000||bytes.byteLength<100)throw new Error('Invalid archive size');
    const snapshot=parseArchive(bytes,date,symbols);
    await db.prepare('INSERT INTO official_price_history(date,data) VALUES(?,?) ON CONFLICT(date) DO UPDATE SET data=excluded.data').bind(date,JSON.stringify(snapshot.prices)).run();
    found.set(date,snapshot.prices);
   }catch(error){console.warn('DFM historical day unavailable',date,error instanceof Error?error.message:'Unknown')}
  }));
 }
 return [...found].filter(([date])=>date<market.date).sort(([a],[b])=>a.localeCompare(b)).map(([date,prices])=>({date,prices}));
}
