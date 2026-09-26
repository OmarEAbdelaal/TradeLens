'use client';
import {useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceDot} from 'recharts';
import type {HistoryPoint} from '@/lib/insights';
export default function PriceHistoryChart({points}:{points:HistoryPoint[]}){
 const [period,setPeriod]=useState<'7'|'30'|'90'|'365'|'all'>('90');
 const end=points.at(-1)?.date||new Date().toISOString().slice(0,10);
 const cutoff=period==='all'?'':new Date(Date.parse(end+'T00:00:00Z')-Number(period)*86400000).toISOString().slice(0,10);
 const shown=points.filter(p=>!cutoff||p.date>=cutoff);
 const min=Math.min(...shown.map(p=>p.price)),max=Math.max(...shown.map(p=>p.price));
 const domain=shown.length?[Math.max(0,min-(max-min||min*.05)*.25),max+(max-min||max*.05)*.25]:[0,1];
 return <div><div className="chart-periods" aria-label="فترة الرسم">{([['7','أسبوع'],['30','شهر'],['90','3 شهور'],['365','سنة'],['all','الكل']] as const).map(([id,label])=><button key={id} className={period===id?'active':''} onClick={()=>setPeriod(id)}>{label}</button>)}</div>{shown.length?<><div className="price-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%"><LineChart data={shown} margin={{top:20,right:20,bottom:12,left:0}}><CartesianGrid stroke="#2c4357" strokeDasharray="3 4"/><XAxis dataKey="date" tick={{fill:'#afc3d2',fontSize:12}} minTickGap={35}/><YAxis domain={domain} tick={{fill:'#afc3d2',fontSize:12}} width={60}/><Tooltip contentStyle={{background:'#12283a',border:'1px solid #38556a',borderRadius:8}} formatter={(v)=>[`${Number(v).toFixed(3)} AED`,'إغلاق']} labelFormatter={(v)=>`جلسة ${v}`}/><Line type="linear" dataKey="price" stroke="#62e4c4" strokeWidth={2.5} dot={shown.length<15} activeDot={{r:6}} isAnimationActive={false}/>{shown.length===1&&<ReferenceDot x={shown[0].date} y={shown[0].price} r={5} fill="#62e4c4"/>}</LineChart></ResponsiveContainer></div><small>{shown.length} جلسة مسجلة بين {shown[0].date} و{shown.at(-1)?.date}. تُوصل النقاط للقراءة فقط؛ الأيام غير المتاحة ليست أسعارًا مقدّرة.</small></>:<div className="empty">لا توجد جلسات مسجلة لهذه الفترة. حمّل ملف الأسعار التاريخية لإظهار الرسم.</div>}</div>
}
