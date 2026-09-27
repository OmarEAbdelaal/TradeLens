import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const temp=mkdtempSync(join(tmpdir(),'tradelens-provider-history-'));
const originalFetch=globalThis.fetch;
const db=new DatabaseSync(':memory:');
globalThis.__providerHistoryDb=db;
try{
 db.exec(`CREATE TABLE provider_price_history(
  key TEXT PRIMARY KEY, market TEXT NOT NULL, symbol TEXT NOT NULL, currency TEXT NOT NULL,
  provider_id INTEGER NOT NULL, source TEXT NOT NULL, data TEXT NOT NULL,
  fetched_through TEXT NOT NULL, updated_at TEXT NOT NULL
 );`);
 writeFileSync(join(temp,'store.mjs'),`export function database(){return {prepare(sql){return {bind(...args){const statement=globalThis.__providerHistoryDb.prepare(sql);return {first:async()=>statement.get(...args),run:async()=>({meta:{changes:statement.run(...args).changes}})}}}}}}`);
 for(const name of ['markets','provider-history']){
  let js=ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  js=js.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'").replaceAll("'@/db/store'","'./store.mjs'");
  writeFileSync(join(temp,name+'.mjs'),js);
 }
 const {parseInvestingSearch,selectInvestingInstrument,parseInvestingHistory,providerHistory}=await import(join(temp,'provider-history.mjs'));
 const quote=(symbol,name,price,currency='AED')=>({symbol,ticker:symbol,name,price,previous:price-.01,change:.1,volume:1000,sharia:false,sector:'Other',lastTrade:'2026-09-25',currency,priceKind:'close'});
 const html=`<script>window.allResultsQuotesDataArray = ${JSON.stringify([
  {pairId:1,name:'Aldar Europe',link:'/equities/aldar-europe',symbol:'ALDAR',pair_type:'equities',exchange:'Paris',exchangeID:9,countryID:22},
  {pairId:941317,name:'Aldar Properties PJSC',link:'/equities/aldar-properties-pjsc',symbol:'ALDAR',pair_type:'equities',exchange:'Abu Dhabi',exchangeID:100,countryID:4},
  {pairId:12888,name:'Elsewedy Electric',link:'/equities/elsewedy-electric',symbol:'SWDY',pair_type:'equities',exchange:'Egypt',exchangeID:33,countryID:59},
  {pairId:6408,name:'Apple Inc',link:'/equities/apple-computer-inc',symbol:'AAPL',pair_type:'equities',exchange:'NASDAQ',exchangeID:2,countryID:5}
 ])};</script>`;
 const items=parseInvestingSearch(html);
 assert.equal(selectInvestingInstrument(items,quote('ALDAR','Aldar Properties PJSC',8.17),'adx').pairId,941317);
 assert.equal(selectInvestingInstrument(items,quote('SWDY','Elsewedy Electric',60,'EGP'),'egx').pairId,12888);
 assert.equal(selectInvestingInstrument(items,quote('AAPL','Apple Inc',250,'USD'),'us').pairId,6408);
 const rows=Array.from({length:250},(_,i)=>{
  const date=new Date(Date.UTC(2026,8,25-i)).toISOString().slice(0,10);
  return {rowDateTimestamp:date+'T00:00:00Z',last_closeRaw:i===0?'8.17':String(8.17-i/1000),volumeRaw:1000000+i};
 });
 const parsed=parseInvestingHistory({data:rows},quote('ALDAR','Aldar Properties PJSC',8.17),'2026-09-25');
 assert.equal(parsed.length,250);assert.equal(parsed.at(-1).date,'2026-09-25');assert.equal(parsed.at(-1).volume,1000000);
 assert.deepEqual(parseInvestingHistory({data:rows},quote('ALDAR','Aldar Properties PJSC',80),'2026-09-25'),[]);
 let requests=0;
 globalThis.fetch=async url=>{
  requests++;
  if(String(url).includes('/search/'))return new Response(html,{status:200});
  assert.match(String(url),/historical\/941317/);
  return Response.json({data:rows});
 };
 const first=await providerHistory(quote('ALDAR','Aldar Properties PJSC',8.17),'adx','2026-09-25');
 assert.equal(first.points.length,250);assert.equal(first.cached,false);assert.equal(requests,2);
 const cached=await providerHistory(quote('ALDAR','Aldar Properties PJSC',8.17),'adx','2026-09-25');
 assert.equal(cached.points.length,250);assert.equal(cached.cached,true);assert.equal(requests,2);
 assert.equal(db.prepare('SELECT count(*) AS n FROM provider_price_history').get().n,1);
 console.log('PASS: exact ADX/EGX/US instrument matching, one-year close/volume validation and durable provider caching.');
}finally{
 globalThis.fetch=originalFetch;delete globalThis.__providerHistoryDb;db.close();rmSync(temp,{recursive:true,force:true});
}
