import {marketData} from '@/lib/market-server';
import {marketId,currencyCode,MARKETS} from '@/lib/markets';
import {readAccount} from '@/lib/accounts-store';
import {positions} from '@/lib/paper';
import {savedMarketHistory} from '@/lib/market-history';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!req.headers.get('oai-authenticated-user-id'))return Response.json({error:'تسجيل الدخول مطلوب.'},{status:401});
 try{const params=new URL(req.url).searchParams,id=marketId(params.get('market'));const result=await marketData(id);const wallet=id==='dfm'?null:await readAccount(req.headers.get('oai-authenticated-user-id')!,id,currencyCode(params.get('currency'),MARKETS[id].currency));return Response.json({...result,history:result.market?await savedMarketHistory(result.market,wallet?positions(wallet.account).map(p=>p.symbol):undefined):[]},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'تعذّر تحميل بيانات السوق. حاول مرة أخرى.'},{status:503})}
}
