import {fees,positions,type Account} from './paper';
import type {Market} from './market';
import {tradingCurrency} from './markets';

export type PricePoint={date:string;price:number;volume?:number};
export type Snapshot={date:string;prices:Record<string,number>;volumes?:Record<string,number>};
export type Imported={symbol:string;points:PricePoint[]};
export type Signal={symbol:string;name:string;price:number;sharia:boolean;volume:number;sessions:number;officialSessions:number;importedSessions:number;recent:PricePoint[];change5:number|null;change20:number|null;eligible:boolean;quantity:number;cost:number;netExit:number|null};

const percent=(current:number,old:number)=>Math.round((current/old-1)*10000)/100;
export function buildOutlook(market:Market,account:Account,snapshots:Snapshot[],imports:Imported[],minSessions=10){
 const held=new Map(positions(account).filter(p=>p.qty>0).map(p=>[p.symbol,p]));
 const imported=new Map(imports.map(row=>[row.symbol,row.points]));
 const signals:Signal[]=market.quotes.map(q=>{
  const official=new Map<string,number>();
  for(const row of snapshots)if(row.date<=market.date&&Number.isFinite(row.prices[q.symbol])&&row.prices[q.symbol]>0)official.set(row.date,row.prices[q.symbol]);
  if(q.priceKind!=='delayed'&&q.lastTrade===market.date&&q.volume>0&&q.price>0)official.set(market.date,q.price);
  const points=new Map<string,number>();
  for(const p of imported.get(q.symbol)||[])if(p.date<=market.date&&Number.isFinite(p.price)&&p.price>0)points.set(p.date,p.price);
  for(const [date,price] of official)points.set(date,price);
  const recent=[...points].sort(([a],[b])=>a.localeCompare(b)).slice(-120).map(([date,price])=>({date,price,volume:snapshots.find(s=>s.date===date)?.volumes?.[q.symbol]}));
  const latest=recent.at(-1);
  const eligible=recent.length>=minSessions&&!!latest&&Date.parse(market.date)-Date.parse(latest.date)<=4*86400000&&q.lastTrade===market.date&&q.volume>0;
  const p=held.get(q.symbol);
  const netExit=p?Math.round((p.qty*q.price-fees(p.qty*q.price,account.broker,account.marketId||'dfm',account.customFees,p.qty,'sell').total-p.cost)*100)/100:null;
  return {symbol:q.symbol,name:q.name,price:q.price,sharia:q.sharia,volume:q.volume,sessions:recent.length,officialSessions:recent.filter(r=>official.has(r.date)).length,importedSessions:recent.filter(r=>!official.has(r.date)).length,recent,change5:recent.length>=6?percent(latest!.price,recent.at(-6)!.price):null,change20:recent.length>=21?percent(latest!.price,recent.at(-21)!.price):null,eligible,quantity:p?.qty||0,cost:p?.cost||0,netExit};
 });
 const holdings=signals.filter(s=>s.quantity>0);
 const candidates=signals.filter(s=>!s.quantity&&s.eligible).sort((a,b)=>(b.change5??-Infinity)-(a.change5??-Infinity)).slice(0,10);
 return {holdings,candidates,coverage:{marketDate:market.date,listed:signals.length,eligible:signals.filter(s=>s.eligible).length,officialDates:new Set(snapshots.map(s=>s.date).concat(market.date)).size,holdings:holdings.length,imported:imports.length},recentTrades:account.trades.filter(t=>!t.voided).slice(-25).map(t=>({symbol:t.symbol,side:t.side,qty:t.qty,price:t.price,fee:t.fee,quoteDate:t.quoteDate})),cash:account.cash};
}
