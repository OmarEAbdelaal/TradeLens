import {z} from 'zod';
import {database} from '@/db/store';
import {readAccount,saveAccount} from '@/lib/accounts-store';
import {newAccount} from '@/lib/paper';
import {adjustCapital,cancelTrade,addExpense} from '@/lib/simulation';
import {MARKET_IDS,MARKETS,marketId,currencyCode,accountScope} from '@/lib/markets';
export const dynamic='force-dynamic';
export async function GET(req:Request){const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'تسجيل الدخول مطلوب'},{status:401});try{const p=new URL(req.url).searchParams,db=database();if(p.get('id')){const row=await db.prepare('SELECT * FROM simulation_archives WHERE id=? AND user_id=?').bind(p.get('id'),user).first<{data:string}>();if(!row)return Response.json({error:'غير موجود'},{status:404});return Response.json({archive:{...row,data:JSON.parse(row.data)}},{headers:{'Cache-Control':'no-store'}})}const m=marketId(p.get('market')),c=currencyCode(p.get('currency'),MARKETS[m].currency);const rows=await db.prepare('SELECT id,label,created_at,market,currency,json_extract(data,\'$.initial\') AS initial,json_extract(data,\'$.cash\') AS cash,json_array_length(json_extract(data,\'$.trades\')) AS trades FROM simulation_archives WHERE user_id=? AND market=? AND currency=? ORDER BY created_at DESC LIMIT 100').bind(user,m,c).all();return Response.json({items:rows.results},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'تعذر تحميل المحاكاة السابقة'},{status:503})}}
const schema=z.object({action:z.enum(['capital','reset','cancel','expense','cancel_expense']),market:z.enum(MARKET_IDS),currency:z.string().regex(/^[A-Z]{3}$/),version:z.number().int().nonnegative(),capital:z.number().min(1).max(100000000).optional(),id:z.string().uuid().optional(),amount:z.number().positive().max(100000000).optional(),label:z.string().max(150).optional()}).strict();
export async function POST(req:Request){const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'تسجيل الدخول مطلوب'},{status:401});if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'طلب غير مسموح'},{status:403});try{const raw=await req.text();if(raw.length>2000)return Response.json({error:'طلب كبير'},{status:413});const p=schema.safeParse(JSON.parse(raw));if(!p.success)return Response.json({error:'راجع القيم المطلوبة'},{status:400});const v=p.data,old=await readAccount(user,v.market,v.currency);if(v.version!==old.version)return Response.json({error:'المحفظة تغيرت. حدّث الصفحة ثم حاول.'},{status:409});let next=old.account;
 if(v.action==='reset'){
 next={...newAccount(v.market,v.currency),broker:old.account.broker,customFees:old.account.customFees,initial:Math.round((v.capital??old.account.initial)*100)/100,cash:Math.round((v.capital??old.account.initial)*100)/100};
 const db=database(),legacy=v.market==='dfm'&&v.currency==='AED',table=legacy?'paper_accounts':'market_accounts',where=legacy?'user_id=?':'key=? AND user_id=?',keys=legacy?[user]:[accountScope(user,v.market,v.currency),user];
 const result=await db.batch([
 db.prepare(`INSERT INTO simulation_archives(id,user_id,market,currency,label,created_at,data) SELECT ?,?,?,?,?,?,data FROM ${table} WHERE ${where} AND version=?`).bind(crypto.randomUUID(),user,v.market,v.currency,v.label?.trim()||'محاكاة سابقة',new Date().toISOString(),...keys,old.version),
 db.prepare(`UPDATE ${table} SET data=?,version=version+1 WHERE ${where} AND version=?`).bind(JSON.stringify(next),...keys,old.version),
 db.prepare(`DELETE FROM ai_selections WHERE user_id=? AND history_id IN (SELECT id FROM ai_history WHERE user_id=? AND market=? AND currency=?) AND EXISTS (SELECT 1 FROM ${table} WHERE ${where} AND json_extract(data,'$.simulationId')=?)`).bind(user,user,v.market,v.currency,...keys,next.simulationId)
 ]);if(!result[1].meta.changes)return Response.json({error:'تغيرت المحفظة. لم يبدأ حساب جديد.'},{status:409});
 }else{
 if(v.action==='capital'){if(v.capital===undefined)throw new Error('أدخل رأس المال');next=adjustCapital(next,v.capital)}
 if(v.action==='cancel'){if(!v.id)throw new Error('اختر العملية');next=cancelTrade(next,v.id)}
 if(v.action==='expense'){if(v.amount===undefined)throw new Error('أدخل المصروف');next=addExpense(next,v.amount,v.label||'')}
 if(v.action==='cancel_expense'){const expense=next.expenses?.find(x=>x.id===v.id&&!x.voided);if(!expense)throw new Error('المصروف غير موجود');next={...next,cash:Math.round((next.cash+expense.amount)*100)/100,expenses:next.expenses?.map(x=>x.id===v.id?{...x,voided:true}:x)}}
 const result=await saveAccount(user,v.market,v.currency,next,old.version);if(!result.meta.changes)return Response.json({error:'تغيرت المحفظة. حدّث الصفحة.'},{status:409});}
 return Response.json({account:next,version:old.version+1},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'تعذر حفظ المحاكاة'},{status:400})}}
