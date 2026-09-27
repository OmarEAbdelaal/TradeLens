import {database} from '@/db/store';
import {analysisScope,selectionKey,type AnalysisScope,type AnalysisRecord,type AnalysisSummary} from './ai-history';
type Row={id:string;kind:AnalysisScope['kind'];market:AnalysisScope['market'];currency:string;subject:string;model:string;created_at:string;prompt:string;result:string};
const fromRow=(row:Row):AnalysisRecord=>({id:row.id,kind:row.kind,market:row.market,currency:row.currency,subject:row.subject,model:row.model,createdAt:row.created_at,prompt:row.prompt,result:JSON.parse(row.result)});
export async function saveAnalysis(user:string,input:AnalysisScope&{model:string;prompt:string;result:Record<string,unknown>}):Promise<AnalysisRecord>{
 const db=database(),id=crypto.randomUUID(),createdAt=new Date().toISOString();
 // Both the immutable result and the current selection commit together. Older entries remain intact.
 await db.batch([
  db.prepare('INSERT INTO ai_history(id,user_id,scope,kind,market,currency,subject,model,created_at,prompt,result) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,user,analysisScope(input),input.kind,input.market,input.currency,input.subject,input.model,createdAt,input.prompt,JSON.stringify(input.result)),
  db.prepare('INSERT INTO ai_selections(key,user_id,history_id) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET history_id=excluded.history_id').bind(selectionKey(user,input),user,id)
 ]);
 return {...input,id,createdAt};
}
export async function captureAnalysis(user:string,input:Parameters<typeof saveAnalysis>[1]){
 try{const record=await saveAnalysis(user,input);return {saved:true,historyId:record.id,createdAt:record.createdAt}}
 catch{console.warn('Analysis persistence unavailable');return {saved:false,saveError:'النتيجة ظاهرة لكن تعذّر حفظها في الحساب. انسخها قبل إغلاق الصفحة؛ النتائج المحفوظة سابقًا لم تتغير.'}}
}
export async function getAnalysis(user:string,id:string){
 const row=await database().prepare('SELECT * FROM ai_history WHERE user_id=? AND id=?').bind(user,id).first<Row>();return row?fromRow(row):null;
}
export async function activeAnalysis(user:string,scope:AnalysisScope){
 const row=await database().prepare('SELECT h.* FROM ai_selections s JOIN ai_history h ON h.id=s.history_id AND h.user_id=s.user_id WHERE s.key=? AND s.user_id=? AND h.scope=?').bind(selectionKey(user,scope),user,analysisScope(scope)).first<Row>();return row?fromRow(row):null;
}
export async function selectAnalysis(user:string,id:string){
 const record=await getAnalysis(user,id);if(!record)return null;
 await database().prepare('INSERT INTO ai_selections(key,user_id,history_id) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET history_id=excluded.history_id').bind(selectionKey(user,record),user,id).run();return record;
}
export async function listAnalyses(user:string,cursor?:string){
 const parts=cursor?.split('|');const db=database();
 const columns='id,kind,market,currency,subject,model,created_at';
 const rows=parts?.length===2?await db.prepare(`SELECT ${columns} FROM ai_history WHERE user_id=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 21`).bind(user,parts[0],parts[0],parts[1]).all<Row>():await db.prepare(`SELECT ${columns} FROM ai_history WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 21`).bind(user).all<Row>();
 const items:AnalysisSummary[]=rows.results.slice(0,20).map(r=>({id:r.id,kind:r.kind,market:r.market,currency:r.currency,subject:r.subject,model:r.model,createdAt:r.created_at}));const last=items.at(-1);
 return {items,nextCursor:rows.results.length>20&&last?`${last.createdAt}|${last.id}`:null};
}
