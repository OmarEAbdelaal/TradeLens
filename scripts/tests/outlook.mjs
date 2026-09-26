import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'tradelens-outlook-'));
const originalFetch=globalThis.fetch;
try{
 const aliases={'@/db/store':'./store.mjs','@/lib/market-server':'./market-server.mjs','@/lib/settings':'./settings.mjs','@/lib/paper':'./paper.mjs','@/lib/portfolio-outlook':'./outlook.mjs','@/lib/dfm-archive':'./archive.mjs','zod':import.meta.resolve('zod')};
 for(const [file,name] of [['lib/paper.ts','paper'],['lib/portfolio-outlook.ts','outlook'],['app/api/portfolio-outlook/route.ts','route']]){
  let js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [from,to] of Object.entries(aliases))js=js.replaceAll(`'${from}'`,`'${to}'`);
  if(name==='outlook')js=js.replaceAll("'./paper'","'./paper.mjs'");
  writeFileSync(join(dir,`${name}.mjs`),js);
 }
 writeFileSync(join(dir,'settings.mjs'),'export const loadSettings=async()=>globalThis.__settings;');
 writeFileSync(join(dir,'market-server.mjs'),'export const marketData=async()=>globalThis.__market;');
 writeFileSync(join(dir,'archive.mjs'),"export const ARCHIVE_SOURCE='https://service.dfm.ae/Bulletins/';export const officialHistory=async()=>[];");
 writeFileSync(join(dir,'store.mjs'),`export const database=()=>({prepare:(sql)=>({bind:()=>({first:async()=>({data:JSON.stringify(globalThis.__account) }),all:async()=>({results:globalThis.__imports})}),all:async()=>({results:globalThis.__snapshots.map(m=>({data:JSON.stringify(m)}))})})});`);
 const {buildOutlook}=await import(join(dir,'outlook.mjs'));
 const {POST}=await import(join(dir,'route.mjs'));
 const date=new Date().toISOString().slice(0,10);
 const quotes=['HOLD','SHORT','GAIN','STALE'].map((symbol,i)=>({symbol,name:symbol,price:10+i,previous:9+i,change:1,volume:100,lastTrade:symbol==='STALE'?'2020-01-01':date,sharia:i%2===0}));
 const market={date,fetchedAt:new Date().toISOString(),source:'test',quotes};
 const snapshots=Array.from({length:11},(_,i)=>({date:new Date(Date.now()-(11-i)*86400000).toISOString().slice(0,10),quotes:[{...quotes[0],price:8+i*.15,lastTrade:new Date(Date.now()-(11-i)*86400000).toISOString().slice(0,10)},{...quotes[2],price:8+i*.3,lastTrade:new Date(Date.now()-(11-i)*86400000).toISOString().slice(0,10)},{...quotes[3],price:8+i*.2,lastTrade:new Date(Date.now()-(11-i)*86400000).toISOString().slice(0,10)}]}));
 const account={cash:8000,initial:10000,broker:'alramz',trades:[{id:'one',symbol:'HOLD',name:'HOLD',side:'buy',qty:100,price:9,fee:12,quoteDate:date,date:new Date().toISOString(),broker:'alramz',shariaAtTrade:true},{id:'two',symbol:'SHORT',name:'SHORT',side:'buy',qty:10,price:10,fee:11,quoteDate:date,date:new Date().toISOString(),broker:'alramz',shariaAtTrade:false}]};
 const context=buildOutlook(market,account,snapshots.map(s=>({date:s.date,prices:Object.fromEntries(s.quotes.map(q=>[q.symbol,q.price]))})),[]);
 assert.equal(context.holdings.find(x=>x.symbol==='HOLD').eligible,true);
 assert.equal(context.holdings.find(x=>x.symbol==='SHORT').eligible,false);
 assert.equal(context.candidates.map(x=>x.symbol).join(','),'GAIN');
 assert.equal(buildOutlook(market,account,snapshots.map(s=>({date:s.date,prices:Object.fromEntries(s.quotes.map(q=>[q.symbol,q.price]))})),[],20).candidates.length,0);
 globalThis.__market={market,connection:'ok'};globalThis.__account=account;globalThis.__snapshots=snapshots;globalThis.__imports=[];globalThis.__settings={provider:'openrouter',model:'openrouter/free',apiKey:'test-only-key'};
 let called;
 globalThis.fetch=async(url,options)=>{called={url,options};return Response.json({choices:[{message:{content:JSON.stringify({overview:'قراءة مشروطة',holdings:[{symbol:'HOLD',action:'review_sell',outlook:'down',reason:'مراجعة الاتجاه',condition:'تغير السعر'},{symbol:'SHORT',action:'review_sell',outlook:'down',reason:'نص غير مدعوم',condition:'تغير السعر'}],opportunities:[{symbol:'GAIN',action:'consider_buy',outlook:'up',reason:'ارتفاع حديث',condition:'انعكاس الاتجاه'},{symbol:'STALE',action:'consider_buy',outlook:'up',reason:'سعر قديم',condition:'تغير السعر'},{symbol:'OTHER',action:'consider_buy',outlook:'up',reason:'رمز غير موجود',condition:'تغير السعر'}]})}}]})};
 const req=(headers={})=>new Request('https://trade.example/api/portfolio-outlook',{method:'POST',headers:{Origin:'https://trade.example','Content-Type':'application/json','oai-authenticated-user-id':'omar',...headers},body:'{"horizon":"week"}'});
 assert.equal((await POST(req({'oai-authenticated-user-id':''}))).status,401);
 assert.equal((await POST(req({Origin:'https://other.example'}))).status,403);
 const response=await POST(req());assert.equal(response.status,200);
 const report=await response.json();
 assert.equal(called.url,'https://openrouter.ai/api/v1/chat/completions');
 assert.equal(called.options.headers.Authorization,'Bearer test-only-key');
 assert.equal(report.portfolio.find(x=>x.symbol==='SHORT').action,'insufficient');
 assert.equal(report.portfolio.find(x=>x.symbol==='HOLD').action,'review_sell');
 assert.deepEqual(report.opportunities.map(x=>x.symbol),['GAIN']);
 globalThis.__settings.apiKey='';assert.equal((await POST(req())).status,400);
 console.log('PASS: full portfolio context, sparse/stale-price gates, symbol allowlist, OpenRouter call, user auth, origin, missing key.');
}finally{globalThis.fetch=originalFetch;for(const name of ['__market','__account','__snapshots','__imports','__settings'])delete globalThis[name];rmSync(dir,{recursive:true,force:true})}
