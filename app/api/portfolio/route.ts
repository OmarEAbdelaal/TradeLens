import {database} from '@/db/store';
import {seed,applyCommand, type State} from '@/lib/trading';
export const dynamic='force-dynamic';
async function read(user:string){const db=database();await db.prepare('INSERT INTO portfolios (user_id,data,version) VALUES (?,?,0) ON CONFLICT(user_id) DO NOTHING').bind(user,JSON.stringify(seed)).run();const row=await db.prepare('SELECT data,version FROM portfolios WHERE user_id=?').bind(user).first<{data:string,version:number}>();if(!row)throw new Error('Storage unavailable');return {state:JSON.parse(row.data) as State,version:row.version};}
export async function GET(req:Request){const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'Sign in to your private site to save your portfolio.'},{status:401});try{return Response.json(await read(user),{headers:{'Cache-Control':'no-store'}})}catch(error){console.error(error);return Response.json({error:'Your portfolio could not be loaded. Please retry.'},{status:503})}}
export async function POST(req:Request){
 const user=req.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'Sign in required.'},{status:401});
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
 if(Number(req.headers.get('content-length')||0)>20000)return Response.json({error:'Request too large.'},{status:413});
 try{const payload=await req.json() as {version?:number,command?:unknown};if(!payload||typeof payload!=='object')return Response.json({error:'Invalid request.'},{status:400});const old=await read(user);if(payload.version!==old.version)return Response.json({error:'Your portfolio changed in another tab. Reload before trying again.'},{status:409});
 let next:State;try{next=applyCommand(old.state,payload.command)}catch(error){return Response.json({error:error instanceof Error&&error.name!=='ZodError'?error.message:'Check all fields and use valid numbers.'},{status:400})}
 const result=await database().prepare('UPDATE portfolios SET data=?,version=version+1 WHERE user_id=? AND version=?').bind(JSON.stringify(next),user,old.version).run();if(!result.meta.changes)return Response.json({error:'Another change was saved first. Reload and retry.'},{status:409});return Response.json({state:next,version:old.version+1});
 }catch(error){console.error(error);return Response.json({error:'Unable to save. Your input is still here; please retry.'},{status:503})}
}
