import type {Market,Quote} from './market';
import {MARKETS,EXCHANGES,sessionCompleted,type MarketId} from './markets';

export const FEED_COLUMNS=['name','description','exchange','currency','close','change','change_abs','volume','time','sector','update_mode','isin'];
type FeedRow={s:string;d:unknown[]};
type FeedPage={totalCount:number;data:FeedRow[];error?:string};
export function parseFeed(rows:FeedRow[],id:MarketId,totalCount:number,now=new Date()):Market{
 const quotes:Quote[]=[];const seen=new Set<string>();
 const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:MARKETS[id].zone,year:'numeric',month:'2-digit',day:'2-digit'});
 const dateCache=new Map<number,string>(),completedCache=new Map<string,boolean>();
 for(const row of rows){
  const [ticker,name,exchange,currency,close,change,delta,volume,timestamp,sector,_updateMode,isin]=row.d;
  if(typeof row.s!=='string'||!row.s.includes(':')||seen.has(row.s)||typeof ticker!=='string'||typeof name!=='string')continue;
  if(EXCHANGES[id]&&exchange!==EXCHANGES[id])continue;
  // Never guess a missing trading currency or turn an unavailable quote into a tradable price.
  const unit=typeof currency==='string'&&/^[A-Z]{3}$/.test(currency)?currency:'XXX';
  const valid=typeof close==='number'&&Number.isFinite(close)&&close>0;
  const instant=typeof timestamp==='number'&&timestamp>0&&timestamp*1000<=now.getTime()+86400000?new Date(timestamp*1000):null;
  const stamp=instant?.getTime()||0;
  let date=dateCache.get(stamp);if(date===undefined){date=instant?dateFormat.format(instant):'';dateCache.set(stamp,date)}
  if(!completedCache.has(date))completedCache.set(date,!!date&&sessionCompleted(date,id,now));
  const dailyChange=typeof change==='number'&&Number.isFinite(change)?change:0;
  const previous=valid&&typeof delta==='number'&&Number.isFinite(delta)?close-delta:valid?close:0;
  quotes.push({symbol:id==='dfm'?ticker:row.s,ticker,name,exchange:String(exchange||''),currency:unit,sector:typeof sector==='string'?sector:'Other',price:valid?close:0,previous,change:dailyChange,volume:typeof volume==='number'&&Number.isFinite(volume)&&volume>0?volume:0,lastTrade:date,sharia:false,isin:typeof isin==='string'&&/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)?isin:undefined,priceKind:completedCache.get(date)?'close':'delayed',updatedAt:instant?.toISOString(),delaySeconds:typeof _updateMode==='string'&&/^delayed_streaming_\d+$/.test(_updateMode)?Number(_updateMode.split('_').at(-1)):undefined});seen.add(row.s);
 }
 if(!quotes.length)throw new Error('No securities returned');
 const date=quotes.reduce((latest,q)=>q.lastTrade>latest?q.lastTrade:latest,'');
 if(!date)throw new Error('Missing provider dates');
 return {id,date,fetchedAt:now.toISOString(),source:MARKETS[id].source,sourceName:'TradingView · delayed market data',totalCount,priceKind:sessionCompleted(date,id,now)?'close':'delayed',quotes,coverageNote:'All stock and depositary-receipt records returned by the source. Funds, bonds and derivatives excluded. Listing coverage is provider-dependent; no Sharia classification is supplied.'};
}
export async function fetchExchange(id:MarketId):Promise<Market>{
 const rows:FeedRow[]=[];let total=0;
 // Page through the entire source universe, not just its default first screen.
 for(let start=0;start===0||start<total;start+=5000){
  const filter:object[]=[{left:'type',operation:'in_range',right:['stock','dr']}];
  if(EXCHANGES[id])filter.push({left:'exchange',operation:'equal',right:EXCHANGES[id]});
  // Cloudflare Workers only implements "follow" and "manual". Using
  // redirect:"error" throws before the provider request is sent.
  const response=await fetch(`https://scanner.tradingview.com/${MARKETS[id].scanner}/scan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filter,columns:FEED_COLUMNS,sort:{sortBy:'name',sortOrder:'asc'},range:[start,start+5000]}),signal:AbortSignal.timeout(18000),redirect:'manual'});
  if(!response.ok)throw new Error(`Market provider HTTP ${response.status}`);
  const page=await response.json() as FeedPage;
  if(!Array.isArray(page.data)||!Number.isInteger(page.totalCount)||page.totalCount<1||page.totalCount>50000||page.error)throw new Error('Invalid market provider response');
  total=page.totalCount;if(!page.data.length)throw new Error('Incomplete market catalog');rows.push(...page.data);
 }
 if(rows.length<total)throw new Error('Incomplete market catalog');
 return parseFeed(rows,id,total);
}
