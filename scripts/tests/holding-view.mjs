import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const temp=mkdtempSync(join(tmpdir(),'holding-view-'));
try{
 for(const name of ['broker-fees','markets','paper','holding-view'])writeFileSync(join(temp,name+'.mjs'),ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'"));
 const {holdingViews,holdingSeries}=await import(pathToFileURL(join(temp,'holding-view.mjs')));
 const trade=(side,qty,price,fee=0,voided=false)=>({symbol:'TEST',name:'Test',side,qty,price,fee,voided});
 const base={initial:10000,cash:9000,currency:'AED',broker:'alramz',trades:[trade('buy',1000,.695,10)]};
 const market={date:'2026-09-30',quotes:[{symbol:'TEST',price:.742,previous:.73,currency:'AED',lastTrade:'2026-09-30'}]};
 const p=holdingViews(base,market)[0];assert.equal(p.average,.695);assert.equal(p.pnl,37);assert.equal(p.pricePct.toFixed(2),'6.76');assert.equal(p.pct.toFixed(2),'5.25');assert.ok(Math.abs(p.day-12)<1e-6);
 const partial={...base,trades:[trade('buy',100,10,5),trade('buy',100,20,5),trade('sell',50,22,2)]};
 const q=holdingViews(partial,{...market,quotes:[{...market.quotes[0],price:14}]})[0];assert.equal(q.qty,150);assert.equal(q.average,15);assert.equal(q.cost,2257.5);assert.equal(q.pnl,-157.5);
 const feeLoss=holdingViews({...base,trades:[trade('buy',10,10,5)]},{...market,quotes:[{...market.quotes[0],price:10.1}]})[0];assert.ok(feeLoss.pricePct>0);assert.ok(feeLoss.pnl<0);
 assert.equal(holdingViews({...base,trades:[...base.trades,trade('buy',500,5,0,true)]},market)[0].average,.695);
 assert.equal(holdingViews(base,null)[0].pnl,null);assert.equal(holdingViews(base,{...market,quotes:[{...market.quotes[0],currency:'USD'}]})[0].pnl,null);
 assert.equal(holdingViews(base,{...market,quotes:[{...market.quotes[0],previous:0}]})[0].day,null);
 const reset=holdingViews({...base,trades:[trade('buy',100,10),trade('sell',100,12),trade('buy',50,8)]},market)[0];assert.equal(reset.average,8);assert.equal(reset.realized,200);
 const closed=holdingViews({...base,trades:[trade('buy',100,10),trade('sell',100,12)]},null)[0];assert.equal(closed.qty,0);assert.equal(closed.value,0);assert.equal(closed.average,null);
 assert.deepEqual(holdingSeries([{date:'2026-09-29',prices:{TEST:0}},{date:'2026-09-30',prices:{TEST:.742}},{date:'2026-09-28',prices:{TEST:.695}}],'TEST'),[{date:'2026-09-28',price:.695},{date:'2026-09-30',price:.742}]);
 console.log('PASS: per-holding gain/loss, gross average vs fee-inclusive P/L, partial sales, rebuy, voided trades, missing/cross-currency quotes and real history only.');
}finally{rmSync(temp,{recursive:true,force:true})}
