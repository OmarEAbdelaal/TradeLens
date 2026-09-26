import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const temp=mkdtempSync(join(tmpdir(),'tradelens-markets-'));
const originalFetch=globalThis.fetch;
const db=new DatabaseSync(':memory:');globalThis.__marketTestDb=db;
try{
 db.exec('CREATE TABLE paper_accounts(user_id TEXT PRIMARY KEY,data TEXT,version INTEGER);CREATE TABLE market_accounts(key TEXT PRIMARY KEY,user_id TEXT,market TEXT,currency TEXT,data TEXT,version INTEGER);');
 writeFileSync(join(temp,'store.mjs'),`export function database(){return {prepare(sql){return {bind(...args){const st=globalThis.__marketTestDb.prepare(sql);return {first:async()=>st.get(...args),run:async()=>({meta:{changes:st.run(...args).changes}})}}}}}}`);
 for(const name of ['markets','market','paper','accounts-store','exchange-feed','research-packet','portfolio-outlook']){
  let js=ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  js=js.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'").replaceAll("'@/db/store'","'./store.mjs'");writeFileSync(join(temp,name+'.mjs'),js);
 }
 const {accountScope}=await import(join(temp,'markets.mjs'));
 const {newAccount,executeTrade,totals,fees}=await import(join(temp,'paper.mjs'));
 const {readAccount,saveAccount}=await import(join(temp,'accounts-store.mjs'));
 const {parseFeed,fetchExchange}=await import(join(temp,'exchange-feed.mjs'));
 const {stockResearchPacket}=await import(join(temp,'research-packet.mjs'));
 const now=new Date('2026-09-26T20:00:00Z');
 const row=(symbol,currency='EGP',close=20)=>({s:'EGX:'+symbol,d:[symbol,'Company '+symbol,'EGX',currency,close,2,0.4,100,1790233200,'Finance','delayed_streaming_900']});
 const egypt=parseFeed([row('ONE'),row('TWO','USD'),row('NOPRICE','EGP',null)],'egx',3,now);
 assert.equal(egypt.quotes.length,3);assert.equal(egypt.quotes[1].currency,'USD');assert.equal(egypt.quotes[2].price,0);assert.equal(egypt.date,'2026-09-24');
 const a=newAccount('egx');assert.equal(a.currency,'EGP');
 const q=egypt.quotes[0],input={id:'test-buy',side:'buy',qty:10,broker:'alramz',note:'',customFees:{percent:.1,fixed:2}};
 const bought=executeTrade(a,q,egypt,input,now);assert.equal(bought.cash,9797.8);assert.equal(bought.trades[0].fee,2.2);assert.equal(bought.trades[0].currency,'EGP');
 assert.equal(totals(bought,egypt).net,-4.4);
 assert.throws(()=>executeTrade(a,egypt.quotes[1],egypt,input,now));
 assert.throws(()=>executeTrade(newAccount('adx'),q,egypt,input,now));
 assert.throws(()=>executeTrade(a,egypt.quotes[2],egypt,input,now));
 assert.equal(fees(1000,'alramz').total,13.36);assert.equal(fees(1000,'alramz','us').total,0);
 db.prepare('INSERT INTO paper_accounts VALUES(?,?,?)').run('owner',JSON.stringify({...newAccount(),cash:4321}),7);
 const legacy=await readAccount('owner','dfm','AED');assert.equal(legacy.account.cash,4321);assert.equal(legacy.version,7);
 const egp=await readAccount('owner','egx','EGP'),usd=await readAccount('owner','egx','USD'),us=await readAccount('owner','us','USD');
 assert.equal(egp.account.cash,10000);assert.equal(usd.account.currency,'USD');assert.notEqual(accountScope('owner','egx','USD'),accountScope('owner','us','USD'));
 assert.equal((await saveAccount('owner','egx','EGP',bought,egp.version)).meta.changes,1);
 assert.equal((await readAccount('owner','egx','EGP')).account.cash,9797.8);assert.equal((await readAccount('owner','egx','USD')).account.cash,10000);assert.equal((await readAccount('other','egx','EGP')).account.cash,10000);
 assert.equal((await saveAccount('owner','egx','EGP',bought,0)).meta.changes,0);
 const packet=stockResearchPacket({...q,priceKind:'delayed'},egypt.date,[],[],'egx');assert.equal(packet.sessionCount,0);assert.equal(packet.currency,'EGP');
 // Exercise the HTTP boundary too: the market/currency sent by the UI must route to its own wallet.
 writeFileSync(join(temp,'market-server.mjs'),`export const marketData=async id=>({market:{...globalThis.__routeMarket,id},connection:'ok'});`);
 let route=ts.transpileModule(readFileSync('app/api/paper/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 route=route.replace(/'@\/lib\/([^']+)'/g,"'./$1.mjs'").replaceAll("'zod'",JSON.stringify(import.meta.resolve('zod')));
 writeFileSync(join(temp,'paper-route.mjs'),route);const {POST}=await import(join(temp,'paper-route.mjs'));
 const today=new Date().toISOString().slice(0,10);globalThis.__routeMarket={...egypt,date:today,quotes:egypt.quotes.map(q=>({...q,lastTrade:today}))};
 const payload={id:'31072e4c-3385-4bbb-900d-c8fb28fbb11a',version:0,marketId:'egx',currency:'EGP',symbol:q.symbol,side:'buy',qty:2,price:q.price,quoteDate:today,broker:'alramz',note:'',customFees:{percent:.1,fixed:2}};
 const req=(body,headers={})=>new Request('https://test.invalid/api/paper',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'api-test',origin:'https://test.invalid',...headers},body:JSON.stringify(body)});
 assert.equal((await POST(req(payload,{'oai-authenticated-user-id':''}))).status,401);
 assert.equal((await POST(req(payload,{origin:'https://other.invalid'}))).status,403);
 assert.equal((await POST(req({...payload,currency:'USD'}))).status,503);
 const accepted=await POST(req(payload));assert.equal(accepted.status,200);assert.equal((await accepted.json()).account.currency,'EGP');
 assert.equal((await readAccount('api-test','egx','EGP')).account.cash,9957.96);assert.equal((await readAccount('api-test','egx','USD')).account.cash,10000);
 let requests=0;
 globalThis.fetch=async (_url,options)=>{requests++;const body=JSON.parse(options.body),start=body.range[0],length=start===0?5000:1;return Response.json({totalCount:5001,data:Array.from({length},(_,i)=>({...row('S'+(start+i)),s:'NYSE:S'+(start+i),d:['S'+(start+i),'Company','NYSE','USD',20,2,.4,100,1790352000,'Finance','delayed_streaming_900']}))})};
 const paged=await fetchExchange('us');assert.equal(requests,2);assert.equal(paged.quotes.length,5001);
 for(const id of ['egx','adx','us']){const path='/tmp/tradelens-'+id+'-feed.json';if(!existsSync(path))continue;const raw=JSON.parse(readFileSync(path,'utf8')),parsed=parseFeed(raw.data,id,raw.totalCount,now);assert.equal(parsed.quotes.length,raw.totalCount);assert.equal(new Set(parsed.quotes.map(q=>q.symbol)).size,raw.totalCount);console.log('Verified fetched catalog:',id,parsed.quotes.length,'securities, date',parsed.date);}
 console.log('PASS: full pagination, actual currencies, unavailable quotes, account/user/market separation, DFM balance preservation, custom fees, stale-write rejection and intraday-history exclusion.');
}finally{globalThis.fetch=originalFetch;delete globalThis.__marketTestDb;delete globalThis.__routeMarket;db.close();rmSync(temp,{recursive:true,force:true})}
