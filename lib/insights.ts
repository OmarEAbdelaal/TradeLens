import type {Quote} from './market';
export type HistoryPoint={date:string;price:number};
export function insights(q:Quote,bulletinDate:string,history:HistoryPoint[],language:'ar'|'en'='ar'){
 if(language==='en'){
  const lines=[`Calculation demo for ${q.symbol} from the DFM bulletin dated ${bulletinDate}. This is not an AI model or trading recommendation.`];
  const delta=q.price-q.previous;
  lines.push(`Close AED ${q.price.toFixed(3)} versus previous AED ${q.previous.toFixed(3)}: ${delta>0?'up':delta<0?'down':'unchanged'} ${Math.abs(q.change).toFixed(2)}% for the session.`);
  lines.push(q.lastTrade===bulletinDate&&q.volume>0?`${q.volume.toLocaleString('en-US')} shares traded this session.`:`Last recorded trade: ${q.lastTrade||'unavailable'}. This price is not a new trade in the bulletin session.`);
  const points=history.filter(p=>p.date<=bulletinDate&&p.price>0).sort((a,b)=>a.date.localeCompare(b.date));
  if(points.length>=2){const first=points[0],last=points.at(-1)!;const change=(last.price/first.price-1)*100;lines.push(`From ${first.date} to ${last.date}, closes changed ${change>=0?'+':''}${change.toFixed(2)}% across ${points.length} stored sessions. Missing periods are excluded.`)}else lines.push('Too few stored sessions to assess a weekly trend. Review historical prices in the chart.');
  lines.push(q.sharia?'Marked Sharia compliant in this bulletin; this is not a religious ruling.':'No Sharia compliant marker in this bulletin; verify independently before a real decision.');
  lines.push('For deeper research, review news, disclosures, financial statements, dividends and corporate actions; these are absent from this bulletin.');
  return lines.join('\n\n');
 }
 const lines=[`تجربة قراءة بيانات ${q.symbol} من نشرة DFM بتاريخ ${bulletinDate}. هذه قراءة حسابية وليست نموذج AI أو توصية تداول.`];
 const delta=q.price-q.previous;
 lines.push(`سعر الإغلاق ${q.price.toFixed(3)} درهم، والإغلاق السابق ${q.previous.toFixed(3)} درهم: ${delta>0?'ارتفع':delta<0?'انخفض':'لم يتغير'} ${Math.abs(q.change).toFixed(2)}% في الجلسة.`);
 lines.push(q.lastTrade===bulletinDate&&q.volume>0?`تداول ${q.volume.toLocaleString('en-US')} سهم في الجلسة.`:`آخر تداول مسجل ${q.lastTrade||'غير متاح'}؛ السعر لا يمثل تداولًا جديدًا في جلسة النشرة.`);
 const points=history.filter(p=>p.date<=bulletinDate&&p.price>0).sort((a,b)=>a.date.localeCompare(b.date));
 if(points.length>=2){const first=points[0],last=points.at(-1)!;const change=(last.price/first.price-1)*100;lines.push(`بين ${first.date} و${last.date} تغيّر الإغلاق ${change>=0?'+':''}${change.toFixed(2)}% ضمن ${points.length} جلسات محفوظة في التطبيق. الفترات غير المحفوظة غير ممثلة.`)}else lines.push('لا توجد جلسات محفوظة كافية داخل التطبيق لتقدير اتجاه أسبوعي؛ استخدم الرسم التاريخي للمراجعة.');
 lines.push(q.sharia?'تحمل علامة توافق شرعي في نشرة هذه الجلسة؛ العلامة ليست فتوى.':'لا تظهر علامة توافق شرعي في النشرة؛ تحقق من التصنيف بنفسك قبل أي قرار حقيقي.');
 lines.push('للتحليل الأعمق راجع الأخبار والإفصاحات والقوائم المالية والتوزيعات والإجراءات الرأسمالية؛ هذه البيانات غير موجودة في النشرة الحالية.');
 return lines.join('\n\n');
}
