import type {HistoryPoint} from '@/lib/insights';
export default function MiniTrend({points,language='ar'}:{points:Pick<HistoryPoint,'date'|'price'>[];language?:string}){
 if(points.length<2)return <span className="trend-empty">{language==='ar'?'التاريخ غير كافٍ':'Insufficient history'}</span>;
 const values=points.map(p=>p.price),low=Math.min(...values),high=Math.max(...values),range=high-low,line=values.map((v,i)=>`${3+i/(values.length-1)*106},${range?31-(v-low)/range*26:18}`).join(' '),delta=values.at(-1)!-values[0];
 const label=`${points[0].date} — ${points.at(-1)!.date} · ${values[0]} → ${values.at(-1)}`;
 return <svg className={`mini-trend ${delta>0?'positive':delta<0?'negative':'neutral'}`} viewBox="0 0 112 36" role="img" aria-label={label}><title>{label}</title><polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
