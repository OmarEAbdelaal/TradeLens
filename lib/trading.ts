import {z} from 'zod';
export const assetSchema=z.object({symbol:z.string().trim().min(1).max(12).regex(/^[A-Z0-9.:-]+$/),name:z.string().trim().min(1).max(80),price:z.number().finite().positive().max(1e6),average:z.number().finite().positive().max(1e6),growth:z.number().finite().min(-100).max(1000),debt:z.number().finite().min(0).max(100),source:z.string().trim().min(3).max(300),asOf:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),sample:z.boolean()});
export type Asset=z.infer<typeof assetSchema>;
export type Trade={id:string,symbol:string,side:'buy'|'sell',qty:number,price:number,fee:number,date:string,note:string};
export type State={assets:Asset[],trades:Trade[],cash:number};
export const seed:State={cash:10000,trades:[],assets:[
 {symbol:'DEMO-A',name:'Atlas Software',price:125,average:117,growth:18,debt:0.25,source:'Fictional example — not a listed company',asOf:'2026-09-25',sample:true},
 {symbol:'DEMO-B',name:'Cedar Energy',price:72,average:76,growth:8,debt:0.8,source:'Fictional example — not a listed company',asOf:'2026-09-25',sample:true},
 {symbol:'DEMO-C',name:'Northline Retail',price:48,average:44,growth:-3,debt:1.4,source:'Fictional example — not a listed company',asOf:'2026-09-25',sample:true}
]};
export function criteria(a:Asset){return [{name:'Price above 50-day average',pass:a.price>a.average,detail:`$${a.price.toFixed(2)} price / $${a.average.toFixed(2)} average`},{name:'Positive annual revenue growth',pass:a.growth>0,detail:`${a.growth}% year-over-year growth`},{name:'Debt-to-equity below 1',pass:a.debt<1,detail:`${a.debt.toFixed(2)} debt-to-equity ratio`}];}
export const score=(a:Asset)=>criteria(a).filter(x=>x.pass).length;
export function holdings(s:State,symbol:string){return s.trades.filter(t=>t.symbol===symbol).reduce((n,t)=>n+(t.side==='buy'?t.qty:-t.qty),0)}
export function equity(s:State){return s.cash+s.assets.reduce((n,a)=>n+holdings(s,a.symbol)*a.price,0)}
const round=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
export function plan(entry:number,stop:number,target:number,risk:number,cash:number,fee:number){
 if(![entry,stop,target,risk,cash,fee].every(Number.isFinite)||stop<=0||entry<=stop||target<=entry||risk<=0||cash<0||fee<0)return null;
 const qty=Math.max(0,Math.floor(Math.min((risk-2*fee)/(entry-stop),(cash-fee)/entry)));
 if(qty===0)return {qty:0,cost:0,loss:0,gain:0,ratio:0};
 const loss=round(qty*(entry-stop)+2*fee),gain=round(qty*(target-entry)-2*fee);
 return {qty,cost:round(qty*entry+fee),loss,gain,ratio:loss>0?gain/loss:0};
}
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('asset'),asset:assetSchema}),
 z.object({type:z.literal('trade'),symbol:z.string(),side:z.enum(['buy','sell']),qty:z.number().int().positive().max(1e6),fee:z.number().finite().min(0).max(10000),note:z.string().max(500)})
]);
export function applyCommand(state:State,input:unknown):State{
 const c=commandSchema.parse(input);const s=structuredClone(state);
 if(c.type==='asset'){
 if(c.asset.asOf>new Date().toISOString().slice(0,10)||!Number.isFinite(Date.parse(c.asset.asOf)))throw new Error('Use a valid observation date, not a future date.');
 const index=s.assets.findIndex(a=>a.symbol===c.asset.symbol);
 if(index>=0){if(s.assets[index].sample!==c.asset.sample)throw new Error('Keep the original sample classification.');s.assets[index]=c.asset;}else {if(s.assets.length>=100)throw new Error('Watchlist limit is 100 stocks.');s.assets.push(c.asset)}
 }else{
 const a=s.assets.find(a=>a.symbol===c.symbol);if(!a)throw new Error('Stock not found.');
 const gross=round(c.qty*a.price);
 if(c.side==='buy'&&gross+c.fee>s.cash)throw new Error('Not enough virtual cash.');
 if(c.side==='sell'&&c.qty>holdings(s,c.symbol))throw new Error('You cannot sell more shares than you hold.');
 if(c.side==='sell'&&s.cash+gross<c.fee)throw new Error('Fee exceeds available proceeds and cash.');
 s.cash=round(s.cash+(c.side==='buy'?-gross: gross)-c.fee);
 s.trades.push({id:crypto.randomUUID(),symbol:c.symbol,side:c.side,qty:c.qty,price:a.price,fee:c.fee,note:c.note,date:new Date().toISOString()});
 }return s;
}
