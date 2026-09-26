import type {Market,Quote} from './market';
import {MARKETS,tradingCurrency,type MarketId} from './markets';
export type FeeConfig={percent:number;fixed:number};
export const BROKERS={alramz:{name:'الرمز كابيتال · Al Ramz',source:'https://alramz.ae/sites/default/files/2025-03/commission.pdf'},enbd:{name:'الإمارات دبي الوطني للأوراق المالية',source:'https://www.emiratesnbdsecurities.com/en/schedule-of-fees'}} as const;
export type Broker=keyof typeof BROKERS;
export const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
// DFM: .125% broker + .05% market + .05% SCA + .05% CDS + AED10/order.
// VAT applies to all above except SCA. Indicative published standard rates, reviewed 2026-09-26.
export function fees(value:number,broker:Broker,marketId:MarketId='dfm',custom:FeeConfig={percent:0,fixed:0}){if(marketId!=='dfm'){if(!Number.isFinite(value)||value<0||!Number.isFinite(custom.percent)||custom.percent<0||custom.percent>10||!Number.isFinite(custom.fixed)||custom.fixed<0)throw new Error('Invalid fee input');return {commission:round(value*custom.percent/100),fixed:custom.fixed,vat:0,total:round(value*custom.percent/100+custom.fixed)}}if(!(broker in BROKERS)||!Number.isFinite(value)||value<0)throw new Error('Invalid fee input');const commission=value*.00275,fixed=10,vat=(value*.00225+fixed)*.05;return {commission:round(commission),fixed,vat:round(vat),total:round(commission+fixed+vat)};}
export type Trade={id:string;symbol:string;name:string;side:'buy'|'sell';qty:number;price:number;fee:number;feeVersion:string;broker:Broker;date:string;quoteDate:string;note:string;shariaAtTrade:boolean;marketId?:MarketId;currency?:string};
export type Account={cash:number;initial:number;broker:Broker;trades:Trade[];marketId?:MarketId;currency?:string;customFees?:FeeConfig};
export const newAccount=(marketId:MarketId='dfm',currency:string=MARKETS[marketId].currency):Account=>({cash:10000,initial:10000,broker:'alramz',trades:[],marketId,currency,customFees:{percent:0,fixed:0}});
export function positions(a:Account){const map=new Map<string,{symbol:string;name:string;qty:number;cost:number;realized:number}>();for(const t of a.trades){const p=map.get(t.symbol)||{symbol:t.symbol,name:t.name,qty:0,cost:0,realized:0};if(t.side==='buy'){p.qty+=t.qty;p.cost+=round(t.qty*t.price)+t.fee;}else{const cost=p.cost/p.qty*t.qty;p.qty-=t.qty;p.cost=p.qty? p.cost-cost:0;p.realized+=round(t.qty*t.price)-t.fee-cost;}map.set(t.symbol,p)}return [...map.values()]}
export function totals(a:Account,m:Market|null){const ps=positions(a);let value=0,exitFees=0,complete=true;for(const p of ps.filter(x=>x.qty>0)){const q=m?.quotes.find(x=>x.symbol===p.symbol);if(!q||q.price<=0||tradingCurrency(q)!==(a.currency||'AED')){complete=false;continue}value+=p.qty*q.price;exitFees+=fees(p.qty*q.price,a.broker,a.marketId||'dfm',a.customFees).total}return {positions:ps,value:round(value),exitFees:round(exitFees),complete,equity:round(a.cash+value),net:round(a.cash+value-exitFees-a.initial),realized:round(ps.reduce((s,p)=>s+p.realized,0)),paid:round(a.trades.reduce((s,t)=>s+t.fee,0))}}
export function executeTrade(a:Account,q:Quote,market:Market,input:{id:string;side:'buy'|'sell';qty:number;broker:Broker;note:string;customFees?:FeeConfig},now=new Date()):Account{
 if((a.marketId||'dfm')!==(market.id||'dfm')||tradingCurrency(q)!==(a.currency||'AED')||q.price<=0||!Number.isFinite(q.price))throw new Error('السوق أو عملة السهم لا يطابقان المحفظة.');
 if(a.trades.some(t=>t.id===input.id))throw new Error('العملية مسجلة بالفعل. حدّث المحفظة.');
 if(!Number.isSafeInteger(input.qty)||input.qty<1||input.qty>10000000)throw new Error('اكتب عدد أسهم صحيحًا أكبر من صفر.');
 const gross=round(input.qty*q.price),fee=fees(gross,input.broker,a.marketId||'dfm',input.customFees||a.customFees).total;
 if(input.side==='buy'&&gross+fee>a.cash)throw new Error('الرصيد الافتراضي لا يكفي لقيمة الأسهم والرسوم.');
 if(input.side==='sell'&&input.qty>(positions(a).find(p=>p.symbol===q.symbol)?.qty||0))throw new Error('الكمية أكبر من الأسهم التي تملكها.');
 const cash=round(a.cash+(input.side==='buy'?-gross-fee:gross-fee));if(cash<0)throw new Error('رصيدك لا يكفي لتغطية الرسوم.');
 return {...a,cash,broker:input.broker,customFees:input.customFees||a.customFees,trades:[...a.trades,{...input,symbol:q.symbol,name:q.name,price:q.price,fee,currency:a.currency||'AED',marketId:a.marketId||'dfm',feeVersion:(a.marketId||'dfm')==='dfm'?'DFM-standard-2026-09-26':'user-estimate',date:now.toISOString(),quoteDate:market.date,shariaAtTrade:q.sharia}]};
}
