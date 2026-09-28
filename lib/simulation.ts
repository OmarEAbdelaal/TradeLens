import {positions,round,type Account,type Trade} from './paper';
export type AccountExpense={id:string;date:string;amount:number;label:string;voided?:boolean};
export function adjustCapital(a:Account,capital:number):Account{
 if(!Number.isFinite(capital)||capital<1||capital>100000000)throw new Error('رأس المال يجب أن يكون بين 1 و100,000,000.');
 const cash=round(a.cash+capital-a.initial);if(cash<0)throw new Error('التخفيض أكبر من النقد المتاح. ابدأ محاكاة جديدة بدلًا من تغيير المراكز الحالية.');
 return {...a,initial:round(capital),cash};
}
export function cancelTrade(a:Account,id:string,now=new Date()):Account{
 const target=a.trades.find(t=>t.id===id&&!t.voided);if(!target)throw new Error('العملية غير موجودة أو ملغاة بالفعل.');
 const trades=a.trades.map(t=>t.id===id?{...t,voided:true,voidedAt:now.toISOString()}:t);
 const quantities=new Map<string,number>();let cash=a.initial;
 // Replay recorded executions, never today's prices or newly changed tariffs.
 const events=[...trades.filter(t=>!t.voided).map(t=>({date:t.date,t})),...(a.expenses||[]).filter(e=>!e.voided).map(e=>({date:e.date,e}))].sort((x,y)=>x.date.localeCompare(y.date));
 for(const event of events){if('e' in event){cash=round(cash-event.e.amount)}else{const t=event.t,n=quantities.get(t.symbol)||0;if(t.side==='sell'&&t.qty>n)throw new Error('هناك بيع يعتمد على عملية الشراء دي. ألغِ البيع أولًا، أو ابدأ محاكاة جديدة.');quantities.set(t.symbol,n+(t.side==='buy'?t.qty:-t.qty));cash=round(cash+(t.side==='buy'?-1:1)*round(t.qty*t.price)-t.fee)}if(cash<0)throw new Error('الإلغاء يجعل رصيد إحدى العمليات اللاحقة سالبًا. ألغِ العمليات التابعة أولًا.');}
 return {...a,trades,cash};
}
export function addExpense(a:Account,amount:number,label:string):Account{
 if(!Number.isFinite(amount)||amount<=0||amount>a.cash||!label.trim())throw new Error('أدخل مصروفًا موجبًا في حدود النقد المتاح وسبب المصروف.');
 return {...a,cash:round(a.cash-amount),expenses:[...(a.expenses||[]),{id:crypto.randomUUID(),date:new Date().toISOString(),amount:round(amount),label:label.slice(0,150)}]};
}
