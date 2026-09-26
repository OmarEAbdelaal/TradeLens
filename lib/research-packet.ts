import type {Quote} from './market';
import type {Snapshot,PricePoint} from './portfolio-outlook';

export function stockResearchPacket(quote:Quote,marketDate:string,archive:Snapshot[],imports:PricePoint[]){
 const official=new Map<string,number>();
 for(const day of archive)if(day.date<=marketDate&&Number.isFinite(day.prices[quote.symbol])&&day.prices[quote.symbol]>0)
  official.set(day.date,day.prices[quote.symbol]);
 if(quote.lastTrade===marketDate&&quote.volume>0)official.set(marketDate,quote.price);
 const points=new Map<string,{date:string;close:number;source:'DFM bulletin'|'User CSV (unverified)'}>();
 for(const point of imports)if(point.date<=marketDate&&Number.isFinite(point.price)&&point.price>0)
  points.set(point.date,{date:point.date,close:point.price,source:'User CSV (unverified)'});
 for(const [date,close] of official)points.set(date,{date,close,source:'DFM bulletin'});
 const closes=[...points.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-60);
 const latest=closes.at(-1);
 const change=(period:number)=>closes.length>=period+1&&latest
  ?Math.round((latest.close/closes.at(-period-1)!.close-1)*10000)/100:null;
 const last20=closes.slice(-20).map(p=>p.close);
 return {
  quote:{symbol:quote.symbol,name:quote.name,sector:quote.sector,close:quote.price,previousClose:quote.previous,dailyChangePercent:quote.change,volume:quote.volume,lastTrade:quote.lastTrade,shariaMarker:quote.sharia},
  marketDate,sessionCount:closes.length,officialSessionCount:closes.filter(p=>p.source==='DFM bulletin').length,
  importedSessionCount:closes.filter(p=>p.source!=='DFM bulletin').length,
  change5SessionsPercent:change(5),change20SessionsPercent:change(20),
  closingRangeLast20:last20.length>=2?{low:Math.min(...last20),high:Math.max(...last20)}:null,
  dailyCloses:closes,
  notes:['Daily closes are not intraday highs or lows. Historical volumes, intraday ranges, financial statements, and news are not included in this DFM archive packet.','User CSV rows are unverified; official bulletins override same-date CSV closes.']
 };
}
