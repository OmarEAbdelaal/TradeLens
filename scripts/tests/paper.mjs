import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const temp=mkdtempSync(join(tmpdir(),'tradelens-test-'));
try{
 for(const name of ['market','paper'])writeFileSync(join(temp,name+'.mjs'),ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText);
 const {parseBulletin,canTrade}=await import(join(temp,'market.mjs'));
 const {fees,newAccount,executeTrade,totals,positions}=await import(join(temp,'paper.mjs'));
 // A fixture assembled from the official column contract exercises false-positive Sharia titles.
 const row=(symbol,approved)=>`<tr class="Data ${symbol}"><td title="Shari’a Compliance">${approved?'<img src="Green_Crescent_Icon_Samll.png">':''}</td><td><b>${symbol}</b>- Company ${symbol}</td>${[10,10,10,11,9,10,0,0,10,'25/09/2026',10,100,1000,10,11,12,8,100000,''].map(v=>`<td>${v}</td>`).join('')}</tr>`;
 const html='Daily Bulletins as of 25-Sep-2026<table id="tblDailyBulletins"><tr class="sector"><td>Financials <span>Index</span></td></tr>'+Array.from({length:22},(_,i)=>row('S'+i,i%2===0)).join('')+'<tr class="sector"><td>Futures</td></tr>'+row('FUTURES',true)+'</table>';
 const market=parseBulletin(html,new Date('2026-09-26T10:00:00Z'));assert.equal(market.quotes.length,22);assert.equal(market.quotes[0].sharia,true);assert.equal(market.quotes[1].sharia,false);assert.equal(market.quotes[0].lastTrade,'2026-09-25');
 assert.throws(()=>parseBulletin('<html>maintenance</html>'));
 const q=market.quotes[0];const now=new Date('2026-09-26T10:00:00Z');assert.equal(canTrade(market,q,'ok','buy',+now),'');assert.equal(canTrade(market,market.quotes[1],'ok','buy',+now),'');assert.equal(canTrade(market,market.quotes[1],'ok','sell',+now),'');assert.ok(canTrade(market,q,'cached','buy',+now));assert.ok(canTrade(market,q,'ok','buy',+now+7*86400000));assert.ok(canTrade(market,{...q,lastTrade:'2026-09-24'},'ok','buy',+now));
 assert.equal(fees(1000,'alramz').total,13.36);assert.equal(fees(1000,'enbd').total,13.36);
 const buy=(a,id,qty,p=10)=>executeTrade(a,{...q,price:p},market,{id,side:'buy',qty,broker:'alramz',note:''},now);
 let a=buy(newAccount(),'one',100);assert.equal(a.cash,8986.64);assert.equal(totals(a,market).net,-26.72);assert.equal(positions(a)[0].cost,1013.36);
 assert.throws(()=>buy(a,'one',1));assert.throws(()=>buy(a,'fraction',1.5));assert.throws(()=>buy(a,'expensive',100000));
 a=executeTrade(a,{...q,price:12},market,{id:'two',side:'sell',qty:40,broker:'alramz',note:''},now);assert.equal(positions(a)[0].qty,60);assert.ok(Math.abs(positions(a)[0].cost-608.016)<.0001);assert.equal(a.cash,9454.77);
 a=executeTrade(a,{...q,price:12},market,{id:'three',side:'sell',qty:60,broker:'alramz',note:''},now);assert.equal(positions(a)[0].qty,0);assert.equal(totals(a,market).net,162.21);assert.equal(totals(a,market).realized,162.21);assert.throws(()=>executeTrade(a,q,market,{id:'short',side:'sell',qty:1,broker:'alramz',note:''},now));
 assert.equal(totals(buy(newAccount(),'missing',1),null).complete,false);
 if(process.env.BULLETIN_FIXTURE){const actual=parseBulletin(readFileSync(process.env.BULLETIN_FIXTURE,'utf8'));console.log('Official bulletin:',actual.date,actual.quotes.length,'securities,',actual.quotes.filter(q=>q.sharia).length,'marked compliant');console.log(actual.quotes.map(q=>q.symbol).join(', '));assert.equal(actual.quotes.find(q=>q.symbol==='DIB').sharia,true);assert.equal(actual.quotes.find(q=>q.symbol==='ALANSARI').sharia,false);assert.ok(!actual.quotes.some(q=>q.sector==='Futures'));}
 console.log('PASS: source validation, Sharia badges, stale-price blocks, fees, partial sales, realized and unrealized P&L, duplicate and invalid orders.');
}finally{rmSync(temp,{recursive:true,force:true})}
