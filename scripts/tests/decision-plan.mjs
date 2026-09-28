import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'tradelens-decision-'));
try{
 for(const name of ['markets','market','paper','decision-plan','exchange-feed']){
  const js=ts.transpileModule(readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'").replaceAll("'zod'",JSON.stringify(import.meta.resolve('zod')));
  writeFileSync(join(dir,`${name}.mjs`),js);
 }
 const {sizeDecision,decisionSchema}=await import(join(dir,'decision-plan.mjs'));
 const {fees,newAccount}=await import(join(dir,'paper.mjs'));
 const {MARKET_IDS,EXCHANGES,MARKETS}=await import(join(dir,'markets.mjs'));
 const {parseFeed}=await import(join(dir,'exchange-feed.mjs'));
 const decision=decisionSchema.parse({preferenceScore:72,allocationPercent:10,entry:10,stop:9,target:12,basis:'Dated price support and earnings evidence',exitRule:'Review after five sessions or invalidation',eventRisk:'Verify dated earnings and macro exposure'});
 const context={account:newAccount(),marketId:'dfm',currency:'AED',equity:10000,price:10,eligible:true,sharia:true,hasNews:true,horizon:5};
 const result=sizeDecision(decision,context);
 assert.ok(result.quantity>0);assert.ok(result.entryCost<=1000);assert.ok(result.riskAtStop<=100);assert.equal(result.winProbability,null);
 assert.ok(result.quantity*10+fees(result.quantity*10,'alramz').total<=1000);
 assert.ok(result.netTarget>0);
 for(const [change,code] of [[{eligible:false},'history'],[{sharia:false},'sharia'],[{hasNews:false},'news'],[{existingPosition:true},'existing_position']]){const r=sizeDecision(decision,{...context,...change});assert.equal(r.quantity,0);assert.ok(r.blocked.includes(code))}
 assert.equal(sizeDecision(decision,{...context,eligible:false}).preferenceScore,null);
 assert.equal(sizeDecision({...decision,stop:11},context).quantity,0);
 assert.equal(sizeDecision(decision,{...context,remainingCash:1}).quantity,0);
 const custom={...newAccount('us'),broker:'ibkr',customFees:{percent:.1,fixed:2,minimum:3,vatPercent:5,confirmed:true}};
 assert.equal(fees(1000,'ibkr','us',custom.customFees).total,5.25);
 assert.equal(fees(1000,'custom','dfm',custom.customFees).total,5.25);
 assert.equal(sizeDecision(decision,{...context,marketId:'us',account:{...custom,customFees:{...custom.customFees,confirmed:false}}}).quantity,0);
 assert.throws(()=>fees(100,'custom','us',{percent:0,fixed:0,minimum:NaN}));
 for(const id of MARKET_IDS){
  const exchange=EXCHANGES[id]||'NASDAQ',ticker='TEST',row={s:`${exchange}:${ticker}`,d:[ticker,'Example',exchange,MARKETS[id].currency,10,1,.1,1000,1790582400,'Technology','delayed_streaming_900']};
  const m=parseFeed([row],id,1,new Date('2026-09-28T20:00:00Z'));assert.equal(m.id,id);assert.equal(m.quotes[0].symbol,id==='dfm'?ticker:row.s);assert.equal(m.quotes[0].currency,MARKETS[id].currency);
  if(EXCHANGES[id])assert.throws(()=>parseFeed([{...row,d:[ticker,'Wrong','OTHER','USD',10,1,.1,10,1790582400]}],id,1));
 }
 const kw=parseFeed([{s:'KSE:TEST',d:['TEST','Example','KSE','KWF',932,1,10,100,1790575200,'Property','delayed_streaming_900']}],'kuwait',1,new Date('2026-09-28T20:00:00Z'));assert.equal(kw.quotes[0].price,.932);assert.equal(kw.quotes[0].currency,'KWD');assert.equal(kw.quotes[0].delaySeconds,900);assert.ok(Math.abs(kw.quotes[0].previous-.922)<1e-9);
 console.log('PASS: fee minimum/tax, DFM custom profiles, nine exchange identities, risk/cash sizing, missing-data and Sharia gates, invalid stops and existing-position guard.');
}finally{rmSync(dir,{recursive:true,force:true})}
