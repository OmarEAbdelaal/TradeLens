export const MARKET_SOURCE='https://service.dfm.ae/Bulletins/';
export type Quote={symbol:string;name:string;sector:string;price:number;previous:number;change:number;volume:number;lastTrade:string;sharia:boolean};
export type Market={date:string;fetchedAt:string;source:string;quotes:Quote[]};
export type MarketResponse={market:Market|null;connection:'ok'|'cached'|'unavailable';error?:string};
const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const num=(s:string)=>{const v=clean(s).replace(/,/g,'');return /^-?\d+(\.\d+)?$/.test(v)?Number(v):NaN};
export function parseBulletin(html:string,now=new Date()):Market{
 const dateText=html.match(/Daily Bulletins as of\s+(\d{2})-([A-Za-z]{3})-(\d{4})/);if(!dateText)throw new Error('Missing bulletin date');
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const month=months.indexOf(dateText[2]);if(month<0)throw new Error('Invalid bulletin date');
 const date=`${dateText[3]}-${String(month+1).padStart(2,'0')}-${dateText[1]}`;
 const table=html.split('id="tblDailyBulletins"')[1]?.split('</table>')[0];if(!table)throw new Error('Missing bulletin table');
 const quotes:Quote[]=[];let sector='';
 for(const m of table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)){
  if(/class="sector"/.test(m[1])){sector=clean(m[2]).split(' Index')[0];if(sector==='Futures')break;continue;}
  if(!/class="Data /.test(m[1])||sector==='Private Joint Stock Companies (PrJSC)'||sector==='Exchange Traded Funds')continue;
  const cells=[...m[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);if(cells.length!==21)throw new Error('Bulletin columns changed');
  const symbol=cells[1].match(/<b>(.*?)<\/b>/)?.[1];if(!symbol||!/^[A-Z0-9.\-]+$/.test(symbol))continue;
  const name=clean(cells[1].replace(/<b>.*?<\/b>\s*-?/,'')).replace(/^-\s*/,'');
  const rawDate=clean(cells[11]).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const q:Quote={symbol,name,sector,price:num(cells[7]),previous:num(cells[2]),change:num(cells[9]),volume:num(cells[13]),lastTrade:rawDate?`${rawDate[3]}-${rawDate[2]}-${rawDate[1]}`:'',sharia:/<img\b[^>]*Green_Crescent_Icon/i.test(cells[0])};
  if(!Number.isFinite(q.price)||q.price<=0)continue;
  if(!Number.isFinite(q.change))q.change=0;if(!Number.isFinite(q.volume))q.volume=0;if(!Number.isFinite(q.previous))q.previous=q.price;
  if(quotes.some(x=>x.symbol===symbol))throw new Error('Duplicate security');quotes.push(q);
 }
 if(quotes.length<20)throw new Error('Incomplete market bulletin');
 if(Date.parse(date)>now.getTime()+86400000)throw new Error('Future bulletin');
 return {date,fetchedAt:now.toISOString(),source:MARKET_SOURCE,quotes};
}
export function canTrade(m:Market,q:Quote,connection:string,side:'buy'|'sell',now=Date.now()){
 if(connection!=='ok')return 'تعذّر التأكد من المصدر الآن. حدّث الأسعار قبل تسجيل عملية.';
 if(now-Date.parse(m.date+'T00:00:00+04:00')>4*86400000)return 'نشرة الأسعار قديمة؛ التسجيل متوقف لحين وصول نشرة حديثة.';
 if(q.lastTrade!==m.date||q.volume<=0)return 'السهم لم يُتداول في تاريخ النشرة. لا نستخدم سعرًا قديمًا لتنفيذ التجربة.';
 return '';
}
