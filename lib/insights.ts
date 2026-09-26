import type {Quote} from './market';
export type HistoryPoint={date:string;price:number};
export function insights(q:Quote,bulletinDate:string,history:HistoryPoint[]){
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
