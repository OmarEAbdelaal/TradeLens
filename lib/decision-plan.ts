import {z} from 'zod';
import {fees,round,type Account} from './paper';
import type {MarketId} from './markets';
export const decisionSchema=z.object({preferenceScore:z.number().min(0).max(100).nullable(),allocationPercent:z.number().min(0).max(100),entry:z.number().positive().nullable(),stop:z.number().positive().nullable(),target:z.number().positive().nullable(),exitRule:z.string().max(900),basis:z.string().max(1200),eventRisk:z.string().max(1200)});
export type Decision=z.infer<typeof decisionSchema>;
export const DECISION_INSTRUCTIONS=`For every stock conclusion include a decision object {"preferenceScore":number_or_null,"allocationPercent":number,"entry":number_or_null,"stop":number_or_null,"target":number_or_null,"exitRule":"...","basis":"...","eventRisk":"..."}. preferenceScore is an analyst preference score out of 100, NOT a probability of profit or calibrated confidence. Explain its reasoning; never claim a tested win rate. allocationPercent is a proposed percentage of virtual account equity, at most 10%. Entry, stop and target must be conditional price levels anchored to dated price evidence, not fabricated predicted returns. Use null and allocationPercent=0 if insufficient. Explain when to exit: target, invalidation/stop, next earnings or other dated event if verified, and mandatory review at the end of the chosen session horizon; stops can gap and do not guarantee execution. Compare company history, business/earnings and balance-sheet evidence, dated political/economic relations and changes (trade exposure, tariffs/sanctions, interest rates, oil, FX), explicitly connecting each supported event to company revenue/costs/valuation. Do not infer causation from political association alone. Separate facts from hypotheses and missing sources. Respect a Sharia-only buy preference: unverified status is a watchlist candidate, not a buy. Do not calculate or invent share quantity; the server computes it from cash, fees and risk constraints. Never execute trades.`;
export type DecisionPlan=Decision&{quantity:number;allocationActualPercent:number;entryCost:number;buyFee:number;sellFee:number;netTarget:number;riskAtStop:number;rewardRisk:number;blocked:string[];horizonSessions:number;winProbability:null;feeProfile:string;currency:string;riskBudgetPercent:number;maxPositionPercent:number};
export function sizeDecision(d:Decision,context:{account:Account;marketId:MarketId;currency:string;equity:number;price:number;eligible:boolean;sharia:boolean;hasNews:boolean;horizon:number;remainingCash?:number;existingPosition?:boolean}):DecisionPlan{
 const {account,marketId,currency}=context;
 if(!context.eligible)d={...d,preferenceScore:null,allocationPercent:0,entry:null,stop:null,target:null};
 const blocked:string[]=[];
 if(!context.eligible)blocked.push('history');
 if(context.existingPosition)blocked.push('existing_position');
 if(!context.sharia)blocked.push('sharia');
 if(!context.hasNews)blocked.push('news');
 if(!(marketId==='dfm'&&['alramz','enbd'].includes(account.broker))&&!account.customFees?.confirmed)blocked.push('fees');
 if(![context.equity,context.price,account.cash].every(Number.isFinite)||context.equity<=0||context.price<=0||account.cash<0)blocked.push('account');
 const entry=d.entry??0,stop=d.stop??0,target=d.target??0;
 if(![entry,stop,target].every(Number.isFinite)||stop<=0||stop>=entry||entry>=target||entry<context.price*.8||entry>context.price*1.2||!d.basis.trim()||!d.exitRule.trim()||d.preferenceScore===null||d.allocationPercent<=0)blocked.push('levels');
 const budget=Math.max(0,Math.min(account.cash,context.remainingCash??account.cash,context.equity*Math.min(d.allocationPercent,10)/100));
 const riskBudget=context.equity*.01;
 const fee=(v:number)=>fees(v,account.broker,marketId,account.customFees).total;
 const cost=(n:number)=>round(n*entry)+fee(n*entry);
 const loss=(n:number)=>round(n*(entry-stop)+fee(n*entry)+fee(n*stop));
 let quantity=0;
 if(!blocked.length){let low=0,high=Math.min(10000000,Math.floor(budget/entry));while(low<high){const mid=Math.ceil((low+high)/2);if(cost(mid)<=budget&&loss(mid)<=riskBudget)low=mid;else high=mid-1}quantity=low;if(!quantity)blocked.push('budget')}
 let buyFee=quantity?fee(quantity*entry):0,sellFee=quantity?fee(quantity*target):0,entryCost=quantity?cost(quantity):0,riskAtStop=quantity?loss(quantity):0,netTarget=quantity?round(quantity*(target-entry)-buyFee-sellFee):0;
 if(quantity&&netTarget<=0){blocked.push('fees_exceed_return');quantity=0;buyFee=sellFee=entryCost=riskAtStop=netTarget=0}
 return {...d,allocationPercent:Math.min(d.allocationPercent,10),quantity,allocationActualPercent:context.equity>0?round(entryCost/context.equity*100):0,entryCost,buyFee,sellFee,netTarget,riskAtStop,rewardRisk:riskAtStop?round(netTarget/riskAtStop):0,blocked,horizonSessions:context.horizon,winProbability:null,feeProfile:account.broker,currency,riskBudgetPercent:1,maxPositionPercent:10};
}
