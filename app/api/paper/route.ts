import {BROKER_IDS} from '@/lib/paper';
import {MARKET_IDS} from '@/lib/markets';
import {z} from 'zod';
import {readAccount,saveAccount} from '@/lib/accounts-store';
import {marketId,currencyCode,MARKETS,tradingCurrency} from '@/lib/markets';
import {newAccount,executeTrade,type Account} from '@/lib/paper';
import {marketData} from '@/lib/market-server';
import {canTrade} from '@/lib/market';
export const dynamic='force-dynamic';
export async function GET(req:Request){const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'تسجيل الدخول مطلوب.'},{status:401});try{return Response.json(await readAccount(user,marketId(new URL(req.url).searchParams.get('market')),currencyCode(new URL(req.url).searchParams.get('currency'),MARKETS[marketId(new URL(req.url).searchParams.get('market'))].currency)),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'تعذّر تحميل المحفظة. حاول مجددًا.'},{status:503})}}
const feeSchema=z.object({percent:z.number().min(0).max(10),fixed:z.number().min(0).max(10000),minimum:z.number().min(0).max(10000).optional(),vatPercent:z.number().min(0).max(100).optional(),confirmed:z.boolean().optional()}).strict();
const orderSchema=z.object({version:z.number().int().nonnegative(),id:z.string().uuid(),marketId:z.enum(MARKET_IDS).optional(),currency:z.string().regex(/^[A-Z]{3}$/).optional(),customFees:feeSchema.optional(),symbol:z.string().min(1).max(80),side:z.enum(['buy','sell']),qty:z.number().int().positive().max(10000000),broker:z.enum(BROKER_IDS),note:z.string().max(500),quoteDate:z.string(),price:z.number().positive()}).strict();
export async function POST(req:Request){const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'تسجيل الدخول مطلوب.'},{status:401});const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'طلب غير مسموح.'},{status:403});try{const raw=await req.text();if(raw.length>4000)return Response.json({error:'طلب كبير جدًا.'},{status:413});const parsed=orderSchema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'راجع الكمية والبيانات المطلوبة.'},{status:400});const input=parsed.data;const id=input.marketId||'dfm';const currency=input.currency||MARKETS[id].currency;const old=await readAccount(user,id,currency);if(old.version!==input.version)return Response.json({error:'المحفظة اتغيرت. حدّث الصفحة وراجع العملية مرة أخرى.'},{status:409});const {market,connection}=await marketData(id);const q=market?.quotes.find(q=>q.symbol===input.symbol);if(!market||!q||tradingCurrency(q)!==currency)return Response.json({error:'سعر السهم غير متاح حاليًا.'},{status:503});const reason=canTrade(market,q,connection,input.side);if(reason)return Response.json({error:reason},{status:400});if(market.date!==input.quoteDate||q.price!==input.price)return Response.json({error:'السعر أو تاريخ النشرة اتغير. حدّث الأسعار وراجع العملية.'},{status:409});let next:Account;try{next=executeTrade(old.account,q,market,input)}catch(e){return Response.json({error:e instanceof Error?e.message:'راجع العملية.'},{status:400})}
 const result=await saveAccount(user,id,currency,next,old.version);if(!result.meta.changes)return Response.json({error:'اتسجل تعديل آخر. حدّث المحفظة قبل المحاولة.'},{status:409});return Response.json({account:next,version:old.version+1},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'لم يتم تأكيد الحفظ. حدّث المحفظة قبل المحاولة مرة أخرى.'},{status:503})}}

const profileSchema=z.object({version:z.number().int().nonnegative(),marketId:z.enum(MARKET_IDS),currency:z.string().regex(/^[A-Z]{3}$/),broker:z.enum(BROKER_IDS),customFees:feeSchema}).strict();
export async function PUT(req:Request){
 const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'تسجيل الدخول مطلوب.'},{status:401});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'طلب غير مسموح.'},{status:403});
 try{const raw=await req.text();if(raw.length>2000)return Response.json({error:'طلب كبير.'},{status:413});const p=profileSchema.safeParse(JSON.parse(raw));if(!p.success)return Response.json({error:'راجع إعداد الرسوم.'},{status:400});
 const v=p.data,old=await readAccount(user,v.marketId,v.currency);if(old.version!==v.version)return Response.json({error:'حدّث المحفظة ثم احفظ الرسوم.'},{status:409});
 const account={...old.account,broker:v.broker,customFees:v.customFees};const result=await saveAccount(user,v.marketId,v.currency,account,old.version);if(!result.meta.changes)return Response.json({error:'تغيّرت المحفظة. أعد التحديث.'},{status:409});return Response.json({account,version:old.version+1},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'تعذّر حفظ الرسوم.'},{status:503})}
}
