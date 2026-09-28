import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
const temp=mkdtempSync(join(tmpdir(),'tradelens-simulations-')),db=new DatabaseSync(':memory:');globalThis.__simDb=db;
try{
 db.exec('CREATE TABLE paper_accounts(user_id TEXT PRIMARY KEY,data TEXT,version INTEGER);CREATE TABLE market_accounts(key TEXT PRIMARY KEY,user_id TEXT,market TEXT,currency TEXT,data TEXT,version INTEGER);CREATE TABLE ai_history(id TEXT PRIMARY KEY,user_id TEXT,market TEXT,currency TEXT);CREATE TABLE ai_selections(key TEXT PRIMARY KEY,user_id TEXT,history_id TEXT);');db.exec(readFileSync('drizzle/0008_nice_mister_sinister.sql','utf8'));
 writeFileSync(join(temp,'store.mjs'),`export function database(){const db=globalThis.__simDb;return {prepare(sql){return {bind(...args){const st=db.prepare(sql);return {first:async()=>st.get(...args),all:async()=>({results:st.all(...args)}),run:async()=>({meta:{changes:st.run(...args).changes}})}}}},async batch(items){db.exec('BEGIN');try{const out=[];for(const x of items)out.push(await x.run());db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}}}`);
 for(const name of ['broker-fees','markets','paper','simulation','accounts-store','route']){const source=readFileSync(name==='route'?'app/api/simulations/route.ts':`lib/${name}.ts`,'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'").replace(/'@\/lib\/([^']+)'/g,"'./$1.mjs'").replaceAll("'@/db/store'","'./store.mjs'").replaceAll("'zod'",JSON.stringify(import.meta.resolve('zod')));writeFileSync(join(temp,name+'.mjs'),js)}
 const {newAccount,executeTrade,positions,totals,fees}=await import(join(temp,'paper.mjs')),{adjustCapital,cancelTrade,addExpense}=await import(join(temp,'simulation.mjs')),{readAccount,saveAccount}=await import(join(temp,'accounts-store.mjs')),{GET,POST}=await import(join(temp,'route.mjs'));
 assert.equal(fees(5000,'thndr','egx',{percent:0,fixed:0,tariff:'thndr-egx'},100).total,11.75);
 assert.equal(fees(10000,'ibkr','us',{percent:0,fixed:0,tariff:'ibkr-fixed'},100,'buy').total,1);
 assert.equal(fees(10000,'ibkr','us',{percent:0,fixed:0,tariff:'ibkr-fixed'},100,'sell').total,1.23);
 assert.equal(fees(1000,'custom','us',{percent:.1,perShare:.01,fixed:2,vatPercent:5,sellPercent:.2,sellPerShare:.005,fxPercent:.1,extraFixed:3},100,'sell').total,10.7);
 assert.throws(()=>fees(100,'ibkr','egx',{percent:0,fixed:0,tariff:'ibkr-fixed'},5));
 let a=newAccount(),q={symbol:'ONE',name:'One',price:10,currency:'AED',sharia:true},market={id:'dfm',date:'2026-09-28',quotes:[q]};const input={id:crypto.randomUUID(),side:'buy',qty:100,broker:'alramz',note:''};a=executeTrade(a,q,market,input);assert.equal(a.cash,8986.64);assert.equal(a.trades[0].feeBreakdown.total,13.36);
 const expense=addExpense(a,10,'Custody');assert.equal(expense.cash,8976.64);const undone=cancelTrade(expense,input.id);assert.equal(undone.cash,9990);assert.equal(positions(undone).length,0);assert.equal(totals(undone,market).paid,0);assert.ok(undone.trades[0].voided);
 const sellId=crypto.randomUUID();const sold=executeTrade(a,{...q,price:12},market,{...input,id:sellId,side:'sell',qty:40});assert.throws(()=>cancelTrade(sold,input.id));const unsold=cancelTrade(sold,sellId);assert.equal(unsold.cash,a.cash);assert.equal(positions(unsold)[0].qty,100);assert.equal(cancelTrade(unsold,input.id).cash,10000);
 assert.equal(adjustCapital(a,20000).cash,18986.64);assert.throws(()=>adjustCapital(a,500));
 await readAccount('owner','dfm','AED');await saveAccount('owner','dfm','AED',sold,0);db.prepare('INSERT INTO ai_history VALUES(?,?,?,?)').run('research','owner','dfm','AED');db.prepare('INSERT INTO ai_selections VALUES(?,?,?)').run('selection','owner','research');
 const req=(body,user='owner',method='POST')=>new Request('https://test.local/api/simulations',{method,headers:{'oai-authenticated-user-id':user,origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify(body)});
 const payload={action:'reset',market:'dfm',currency:'AED',version:1,capital:25000,label:'First run'};
 assert.equal((await POST(req(payload,''))).status,401);assert.equal((await POST(req({...payload,version:0}))).status,409);assert.equal(db.prepare('SELECT count(*) n FROM simulation_archives').get().n,0);
 const reset=await POST(req(payload));assert.equal(reset.status,200);const d=await reset.json();assert.equal(d.account.cash,25000);assert.equal(d.account.trades.length,0);assert.notEqual(d.account.simulationId,a.simulationId);assert.equal(db.prepare('SELECT count(*) n FROM ai_history').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM ai_selections').get().n,0);
 const archived=db.prepare('SELECT * FROM simulation_archives').get();assert.deepEqual(JSON.parse(archived.data),sold);assert.equal((await POST(req(payload))).status,409);assert.equal(db.prepare('SELECT count(*) n FROM simulation_archives').get().n,1);
 assert.equal((await GET(new Request('https://test.local/api/simulations?id='+archived.id,{headers:{'oai-authenticated-user-id':'other'}}))).status,404);
 const list=await GET(new Request('https://test.local/api/simulations?market=dfm&currency=AED',{headers:{'oai-authenticated-user-id':'owner'}}));assert.equal((await list.json()).items.length,1);
 const other=await readAccount('owner','egx','EGP');assert.equal(other.account.initial,10000);assert.equal((await readAccount('other','dfm','AED')).account.initial,10000);
 console.log('PASS: published fee examples, per-share and side-specific costs; cancellation/refund/dependent sells; capital changes; atomic archive/reset, stale versions, user/market isolation, and preserved AI history.');
}finally{db.close();delete globalThis.__simDb;rmSync(temp,{recursive:true,force:true})}
