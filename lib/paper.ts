import {calculateFees,validateTariffCurrency,type FeeBreakdown,type Tariff} from './broker-fees';
import type {Market,Quote} from './market';
import {MARKETS,tradingCurrency,type MarketId} from './markets';
export type FeeConfig={percent:number;fixed:number;minimum?:number;vatPercent?:number;confirmed?:boolean;tariff?:Tariff;brokerName?:string;perShare?:number;sellPercent?:number;sellPerShare?:number;fxPercent?:number;extraFixed?:number};
export const BROKER_IDS=['alramz','enbd','ibkr','sarwa','baraka','thndr','custom'] as const;
export const BROKERS={alramz:{name:'الرمز كابيتال · Al Ramz',source:'https://alramz.ae/sites/default/files/2025-03/commission.pdf'},enbd:{name:'الإمارات دبي الوطني للأوراق المالية',source:'https://www.emiratesnbdsecurities.com/en/schedule-of-fees'},ibkr:{name:'Interactive Brokers · إعداد يدوي',source:'https://www.interactivebrokers.com/en/pricing/commissions-home.php'},sarwa:{name:'Sarwa · إعداد يدوي',source:'https://www.sarwa.co/'},baraka:{name:'baraka · إعداد يدوي',source:'https://getbaraka.com/'},thndr:{name:'Thndr · إعداد يدوي',source:'https://thndr.app/'},custom:{name:'وسيط آخر · Custom broker',source:''}} as const;
export type Broker=keyof typeof BROKERS;
export const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
// DFM: .125% broker + .05% market + .05% SCA + .05% CDS + AED10/order.
// VAT applies to all above except SCA. Indicative published standard rates, reviewed 2026-09-26.
export const fees=calculateFees;
export type Trade={voided?:boolean;voidedAt?:string;feeBreakdown?:FeeBreakdown;id:string;symbol:string;name:string;side:'buy'|'sell';qty:number;price:number;fee:number;feeVersion:string;broker:Broker;date:string;quoteDate:string;note:string;shariaAtTrade:boolean;marketId?:MarketId;currency?:string};
export type Account={simulationId?:string;startedAt?:string;expenses?:import('./simulation').AccountExpense[];cash:number;initial:number;broker:Broker;trades:Trade[];marketId?:MarketId;currency?:string;customFees?:FeeConfig};
export const newAccount=(marketId:MarketId='dfm',currency:string=MARKETS[marketId].currency):Account=>({simulationId:crypto.randomUUID(),startedAt:new Date().toISOString(),cash:10000,initial:10000,broker:marketId==='dfm'?'alramz':'custom',trades:[],marketId,currency,customFees:{percent:0,fixed:0}});
export function positions(a:Account){const map=new Map<string,{symbol:string;name:string;qty:number;cost:number;realized:number}>();for(const t of a.trades.filter(t=>!t.voided)){const p=map.get(t.symbol)||{symbol:t.symbol,name:t.name,qty:0,cost:0,realized:0};if(t.side==='buy'){p.qty+=t.qty;p.cost+=round(t.qty*t.price)+t.fee;}else{const cost=p.cost/p.qty*t.qty;p.qty-=t.qty;p.cost=p.qty? p.cost-cost:0;p.realized+=round(t.qty*t.price)-t.fee-cost;}map.set(t.symbol,p)}return [...map.values()]}
export function totals(a:Account,m:Market|null){const ps=positions(a);let value=0,exitFees=0,complete=true;for(const p of ps.filter(x=>x.qty>0)){const q=m?.quotes.find(x=>x.symbol===p.symbol);if(!q||q.price<=0||tradingCurrency(q)!==(a.currency||'AED')){complete=false;continue}value+=p.qty*q.price;exitFees+=fees(p.qty*q.price,a.broker,a.marketId||'dfm',a.customFees,p.qty,'sell').total}return {positions:ps,value:round(value),exitFees:round(exitFees),complete,equity:round(a.cash+value),net:round(a.cash+value-exitFees-a.initial),realized:round(ps.reduce((s,p)=>s+p.realized,0)),paid:round(a.trades.filter(t=>!t.voided).reduce((s,t)=>s+t.fee,0))}}
export function executeTrade(a:Account,q:Quote,market:Market,input:{id:string;side:'buy'|'sell';qty:number;broker:Broker;note:string;customFees?:FeeConfig},now=new Date()):Account{
 if((a.marketId||'dfm')!==(market.id||'dfm')||tradingCurrency(q)!==(a.currency||'AED')||q.price<=0||!Number.isFinite(q.price))throw new Error('السوق أو عملة السهم لا يطابقان المحفظة.');
 if(a.trades.some(t=>t.id===input.id))throw new Error('العملية مسجلة بالفعل. حدّث المحفظة.');
 if(!Number.isSafeInteger(input.qty)||input.qty<1||input.qty>10000000)throw new Error('اكتب عدد أسهم صحيحًا أكبر من صفر.');
 validateTariffCurrency(input.customFees||a.customFees,a.currency||'AED');
 const gross=round(input.qty*q.price),feeBreakdown=fees(gross,input.broker,a.marketId||'dfm',input.customFees||a.customFees,input.qty,input.side),fee=feeBreakdown.total;
 if(input.side==='buy'&&gross+fee>a.cash)throw new Error('الرصيد الافتراضي لا يكفي لقيمة الأسهم والرسوم.');
 if(input.side==='sell'&&input.qty>(positions(a).find(p=>p.symbol===q.symbol)?.qty||0))throw new Error('الكمية أكبر من الأسهم التي تملكها.');
 const cash=round(a.cash+(input.side==='buy'?-gross-fee:gross-fee));if(cash<0)throw new Error('رصيدك لا يكفي لتغطية الرسوم.');
 return {...a,cash,broker:input.broker,customFees:input.customFees||a.customFees,trades:[...a.trades,{...input,symbol:q.symbol,name:q.name,price:q.price,fee,feeBreakdown,currency:a.currency||'AED',marketId:a.marketId||'dfm',feeVersion:input.customFees?.tariff&&input.customFees.tariff!=='manual'?input.customFees.tariff+'-2026-09-28':(a.marketId||'dfm')==='dfm'&&['alramz','enbd'].includes(input.broker)?'DFM-standard-2026-09-26':'user-estimate',date:now.toISOString(),quoteDate:market.date,shariaAtTrade:q.sharia}]};
}
