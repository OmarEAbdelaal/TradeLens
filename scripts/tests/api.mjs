import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const temp=mkdtempSync(join(tmpdir(),'tradelens-api-'));const sql=new DatabaseSync(':memory:');
try{
 for(const f of ['drizzle/0000_mean_boom_boom.sql','drizzle/0001_skinny_crusher_hogan.sql'])sql.exec(readFileSync(f,'utf8'));
 globalThis.__db={prepare(text){const stmt=sql.prepare(text);let args=[];const obj={bind(...a){args=a;return obj},async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes)}}},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}}};return obj}};
 writeFileSync(join(temp,'store.mjs'),'export const database=()=>globalThis.__db;');writeFileSync(join(temp,'market-server.mjs'),'export const marketData=async()=>globalThis.__market;');
 const mappings={'@/db/store':'./store.mjs','@/lib/paper':'./paper.mjs','@/lib/market-server':'./market-server.mjs','@/lib/market':'./market.mjs','zod':import.meta.resolve('zod')};
 for(const [path,name] of [['lib/market.ts','market'],['lib/paper.ts','paper'],['app/api/paper/route.ts','route']]){let js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;for(const [from,to] of Object.entries(mappings))js=js.replaceAll("'"+from+"'","'"+to+"'").replaceAll('"'+from+'"','"'+to+'"');writeFileSync(join(temp,name+'.mjs'),js)}
 const {GET,POST}=await import(join(temp,'route.mjs'));const date=new Date().toISOString().slice(0,10);globalThis.__market={connection:'ok',market:{date,fetchedAt:new Date().toISOString(),source:'official-test',quotes:[{symbol:'DIB',name:'Test security',sector:'Financials',price:10,previous:9,change:1,volume:100,lastTrade:date,sharia:true}]}};
 const req=(body,user='test-omar',origin='https://test.local')=>new Request('https://test.local/api/paper',{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user}:{}),Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await GET(req(null,''))).status,401);assert.equal((await GET(req(null))).status,200);
 const order={version:0,id:crypto.randomUUID(),symbol:'DIB',side:'buy',qty:100,broker:'alramz',note:'API integration test',quoteDate:date,price:10};
 assert.equal((await POST(req(order,'','https://test.local'))).status,401);assert.equal((await POST(req(order,'test-omar','https://other.local'))).status,403);assert.equal((await POST(req({...order,price:1}))).status,409);assert.equal((await POST(req({...order,qty:-2}))).status,400);
 const r=await POST(req(order));assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.account.cash,8986.64);assert.equal(saved.version,1);assert.equal(saved.account.trades[0].fee,13.36);assert.equal((await POST(req(order))).status,409);
 assert.equal((await (await GET(req(null,'second-user'))).json()).account.trades.length,0);
 globalThis.__market.connection='cached';assert.equal((await POST(req({...order,id:crypto.randomUUID(),version:1}))).status,400);globalThis.__market.connection='ok';
 const concurrent=await Promise.all([POST(req({...order,version:1,id:crypto.randomUUID(),qty:1})),POST(req({...order,version:1,id:crypto.randomUUID(),qty:1}))]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 assert.equal((await (await GET(req(null))).json()).account.trades.length,2);
 console.log('PASS: SQLite migrations, authentication, origin checks, quote tampering, quantity validation, durable ledger, user isolation, duplicate/conflicting writes, unavailable quotes.');
}finally{sql.close();delete globalThis.__db;delete globalThis.__market;rmSync(temp,{recursive:true,force:true})}
