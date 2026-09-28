import {fees,type Account} from './paper';
import type {MarketId} from './markets';
export type HistoricalRate={rate:number|null;wins:number;trials:number;horizon:number;first?:string;last?:string;method:string;reason:string};
// Descriptive non-overlapping buy-and-hold windows. This does not backtest the AI recommendation.
export function historicalRate(points:{date:string;close:number;source:string}[],horizon:number,account:Account,id:MarketId):HistoricalRate{
 const result:HistoricalRate={rate:null,wins:0,trials:0,horizon,method:'Non-overlapping close-to-close buy-and-hold windows, each sized to 10% of initial virtual capital; net positive after modeled entry/exit fees. Not an AI backtest or future success probability. Dividends, slippage and independently verified corporate-action adjustments are not modeled.',reason:''};
 if(![5,20].includes(horizon))return {...result,reason:'invalid_horizon'};
 if(!(id==='dfm'&&['alramz','enbd'].includes(account.broker))&&!account.customFees?.confirmed)return {...result,reason:'fees'};
 const rows=[...new Map(points.filter(p=>!p.source.includes('unverified')&&Number.isFinite(p.close)&&p.close>0).map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 const budget=account.initial*.1;
 for(let end=rows.length-1;end>=horizon;end-=horizon){const start=end-horizon,a=rows[start],b=rows[end];if(Date.parse(b.date)-Date.parse(a.date)>(horizon*3+5)*86400000)continue;let lo=0,hi=Math.min(10000000,Math.floor(budget/a.close));while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(mid*a.close+fees(mid*a.close,account.broker,id,account.customFees).total<=budget)lo=mid;else hi=mid-1}const n=lo;if(!n)continue;const net=n*(b.close-a.close)-fees(n*a.close,account.broker,id,account.customFees).total-fees(n*b.close,account.broker,id,account.customFees).total;result.trials++;if(net>0)result.wins++;result.first=a.date;result.last??=b.date;}
 result.reason=result.trials<30?'sample':'descriptive_only';if(result.trials>=30)result.rate=Math.round(result.wins/result.trials*1000)/10;return result;
}
