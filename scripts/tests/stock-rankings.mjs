import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const dir=mkdtempSync(join(tmpdir(),'stock-rankings-')),db=new DatabaseSync(':memory:');globalThis.__rankingDb=db;
try{
 for(const [path,name] of [['lib/broker-fees.ts','broker-fees'],['lib/markets.ts','markets'],['lib/paper.ts','paper'],['lib/historical-rate.ts','historical-rate'],['app/api/stock-rankings/route.ts','route']]){let js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'").replaceAll("'@/lib/markets'","'./markets.mjs'").replaceAll("'@/db/store'","'./store.mjs'");writeFileSync(join(dir,name+'.mjs'),js)}
 writeFileSync(join(dir,'store.mjs'),`export const database=()=>({prepare:sql=>({bind:(...args)=>({all:async()=>({results:globalThis.__rankingDb.prepare(sql).all(...args)})})})});`);
 const {historicalRate}=await import(join(dir,'historical-rate.mjs')),{newAccount}=await import(join(dir,'paper.mjs'));
 const points=Array.from({length:161},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),close:10+i*.5,source:'Provider'}));
 const a=newAccount(),r=historicalRate(points,5,a,'dfm');assert.equal(r.trials,32);assert.equal(r.rate,100);assert.equal(r.wins,32);
 assert.equal(historicalRate(points.slice(0,50),5,a,'dfm').rate,null);
 assert.equal(historicalRate(points.map(p=>({...p,source:'User CSV (unverified)'})),5,a,'dfm').trials,0);
 assert.equal(historicalRate(points,20,a,'dfm').rate,null);
 assert.equal(historicalRate(points.map(p=>({...p,close:10})),5,a,'dfm').rate,0);
 assert.equal(historicalRate(points,5,newAccount('us'),'us').reason,'fees');
 db.exec('CREATE TABLE ai_history(id TEXT,user_id TEXT,subject TEXT,created_at TEXT,kind TEXT,market TEXT,currency TEXT,result TEXT); CREATE TABLE ai_selections(user_id TEXT,history_id TEXT)');
 const result=JSON.stringify({decision:{preferenceScore:72,horizonSessions:5,blocked:[],quantity:20},quoteDate:'2026-09-28',historicalRate:r});
 for(const [id,user,currency] of [['a','owner','AED'],['b','other','AED'],['c','owner','USD']]){db.prepare('INSERT INTO ai_history VALUES(?,?,?,?,?,?,?,?)').run(id,user,'TEST','2026-09-28T10:00:00Z','stock','dfm',currency,result);db.prepare('INSERT INTO ai_selections VALUES(?,?)').run(user,id)}
 const {GET}=await import(join(dir,'route.mjs'));const req=(user,query='market=dfm&currency=AED')=>new Request('https://example.com/api/stock-rankings?'+query,{headers:user?{'oai-authenticated-user-id':user}:{}});
 assert.equal((await GET(req())).status,401);assert.equal((await GET(req('owner','market=invalid&currency=AED'))).status,400);
 const payload=await (await GET(req('owner'))).json();assert.equal(payload.items.length,1);assert.equal(payload.items[0].historyId,'a');assert.equal(payload.items[0].score,72);assert.deepEqual(payload.items[0].blocked,[]);assert.equal(payload.items[0].historicalRate.trials,32);
 console.log('PASS: ranking user/currency isolation, authentication, stored score parsing; historical fee-adjusted outcomes, sample threshold, CSV exclusion and horizon separation.');
}finally{db.close();delete globalThis.__rankingDb;rmSync(dir,{recursive:true,force:true})}
