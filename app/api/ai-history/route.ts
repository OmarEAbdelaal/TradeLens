import {z} from 'zod';
import {saveAnalysis,getAnalysis,activeAnalysis,selectAnalysis,listAnalyses} from '@/lib/ai-history-store';
export const dynamic='force-dynamic';
const scopeSchema=z.object({kind:z.enum(['stock','portfolio','stock_prompt','portfolio_prompt']),market:z.enum(['dfm','adx','egx','us']),currency:z.string().regex(/^[A-Z]{3}$/),subject:z.string().min(1).max(80)});
const promptSchema=scopeSchema.extend({kind:z.enum(['stock_prompt','portfolio_prompt']),prompt:z.string().min(1).max(300000)}).strict();
const headers={'Cache-Control':'no-store'};
export async function GET(req:Request){
 const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'تسجيل الدخول مطلوب.'},{status:401});
 try{const p=new URL(req.url).searchParams;
  if(p.has('id')){const id=z.string().uuid().safeParse(p.get('id'));if(!id.success)return Response.json({error:'معرّف غير صالح.'},{status:400});const record=await getAnalysis(user,id.data);return Response.json({record}, {status:record?200:404,headers})}
  if(p.get('mode')==='active'){const parsed=scopeSchema.safeParse(Object.fromEntries(['kind','market','currency','subject'].map(k=>[k,p.get(k)])));if(!parsed.success)return Response.json({error:'اختر سجلًا صالحًا.'},{status:400});return Response.json({record:await activeAnalysis(user,parsed.data)},{headers})}
  const cursor=p.get('cursor')||undefined;if(cursor&&!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|[a-f0-9-]{36}$/.test(cursor))return Response.json({error:'صفحة غير صالحة.'},{status:400});
  return Response.json(await listAnalyses(user,cursor),{headers});
 }catch{return Response.json({error:'تعذّر تحميل السجل المحفوظ. أعد المحاولة.'},{status:503})}
}
export async function POST(req:Request){
 const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'تسجيل الدخول مطلوب.'},{status:401});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'طلب غير مسموح.'},{status:403});
 try{const raw=await req.text();if(raw.length>310000)return Response.json({error:'النص أكبر من الحد المسموح.'},{status:413});const parsed=promptSchema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'راجع بيانات الـprompt.'},{status:400});return Response.json({record:await saveAnalysis(user,{...parsed.data,model:'',result:{}})},{headers})}catch{return Response.json({error:'تعذّر حفظ الـprompt. لم تُحذف النتائج السابقة.'},{status:503})}
}
export async function PATCH(req:Request){
 const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'تسجيل الدخول مطلوب.'},{status:401});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'طلب غير مسموح.'},{status:403});
 try{const raw=await req.text();if(raw.length>100)return Response.json({error:'طلب كبير.'},{status:413});const parsed=z.object({id:z.string().uuid()}).strict().safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'معرّف غير صالح.'},{status:400});const record=await selectAnalysis(user,parsed.data.id);return Response.json({record},{status:record?200:404,headers})}catch{return Response.json({error:'تعذّر تثبيت النتيجة. أعد المحاولة.'},{status:503})}
}
