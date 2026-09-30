import {positions,type Account} from './paper';
import {tradingCurrency} from './markets';
import type {Market} from './market';
export type PriceSnapshot={date:string;prices:Record<string,number>};
// Presentation only: execution, fee allocation and stored trades remain in paper.ts.
export function holdingViews(account:Account,market:Market|null){
 const grossCosts=new Map<string,{qty:number;cost:number}>();
 for(const trade of account.trades.filter(t=>!t.voided)){
  const p=grossCosts.get(trade.symbol)||{qty:0,cost:0};
  if(trade.side==='buy'){p.qty+=trade.qty;p.cost+=trade.qty*trade.price}
  else {p.cost=p.qty>0?p.cost*(1-trade.qty/p.qty):0;p.qty-=trade.qty;if(p.qty===0)p.cost=0}
  grossCosts.set(trade.symbol,p);
 }
 const quotes=new Map(market?.quotes.map(q=>[q.symbol,q])??[]);
 return positions(account).map(p=>{
  const candidate=quotes.get(p.symbol),q=candidate&&tradingCurrency(candidate)===(account.currency||'AED')?candidate:undefined;
  const last=q&&Number.isFinite(q.price)&&q.price>0?q.price:null,average=p.qty>0?(grossCosts.get(p.symbol)?.cost??0)/p.qty:null;
  const value=p.qty===0?0:last===null?null:last*p.qty,pnl=value===null?null:value-p.cost,pct=p.cost>0&&pnl!==null?pnl/p.cost*100:null;
  const pricePct=average!==null&&average>0&&last!==null?(last/average-1)*100:null;
  const previous=q&&Number.isFinite(q.previous)&&q.previous>0?q.previous:null,day=last!==null&&previous!==null?(last-previous)*p.qty:null,dayPct=last!==null&&previous!==null?(last/previous-1)*100:null;
  return {...p,q,last,average,value,pnl,pct,pricePct,previous,day,dayPct};
 });
}
export function holdingSeries(history:PriceSnapshot[],symbol:string){return history.filter(h=>Number.isFinite(h.prices[symbol])&&h.prices[symbol]>0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30).map(h=>({date:h.date,price:h.prices[symbol]}))}
