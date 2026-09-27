import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const temp=mkdtempSync(join(tmpdir(),'tradelens-ai-history-'));
const db=new DatabaseSync(':memory:');
globalThis.__historyDb=db;
globalThis.__failHistoryBatch=false;
try{
 db.exec(readFileSync('drizzle/0006_worried_starfox.sql','utf8').replaceAll('--> statement-breakpoint',''));
 writeFileSync(join(temp,'store.mjs'),`export function database(){return {prepare(sql){return {bind(...args){const st=globalThis.__historyDb.prepare(sql);return {first:async()=>st.get(...args),run:async()=>({meta:{changes:st.run(...args).changes}}),all:async()=>({results:st.all(...args)})}}}},async batch(items){if(globalThis.__failHistoryBatch)throw new Error('simulated');globalThis.__historyDb.exec('BEGIN');try{const out=[];for(const item of items)out.push(await item.run());globalThis.__historyDb.exec('COMMIT');return out}catch(e){globalThis.__historyDb.exec('ROLLBACK');throw e}}}}`);
 for(const name of ['ai-history','ai-history-store']){
  let js=ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  js=js.replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'").replaceAll("'@/db/store'","'./store.mjs'");
  writeFileSync(join(temp,name+'.mjs'),js);
 }
 const {saveAnalysis,getAnalysis,activeAnalysis,selectAnalysis,listAnalyses,captureAnalysis}=await import(join(temp,'ai-history-store.mjs'));
 const stock={kind:'stock',market:'egx',currency:'EGP',subject:'EGX:TEST'};
 const first=await saveAnalysis('omar',{...stock,model:'model-a',prompt:'first prompt',result:{text:'first result'}});
 const second=await saveAnalysis('omar',{...stock,model:'model-b',prompt:'second prompt',result:{text:'second result'}});
 assert.equal((await activeAnalysis('omar',stock)).id,second.id);
 assert.equal((await getAnalysis('omar',first.id)).prompt,'first prompt');
 assert.equal(await getAnalysis('other-user',first.id),null);
 assert.equal(await selectAnalysis('other-user',first.id),null);
 await selectAnalysis('omar',first.id);
 assert.equal((await activeAnalysis('omar',stock)).id,first.id);
 const portfolio={kind:'portfolio',market:'us',currency:'USD',subject:'month'};
 await saveAnalysis('omar',{...portfolio,model:'model-c',prompt:'portfolio prompt',result:{overview:'saved review'}});
 assert.equal((await activeAnalysis('omar',portfolio)).result.overview,'saved review');
 assert.equal(await activeAnalysis('omar',{...stock,currency:'USD'}),null);
 assert.equal(await activeAnalysis('omar',{...stock,subject:'EGX:OTHER'}),null);
 for(let i=0;i<21;i++)await saveAnalysis('omar',{...stock,subject:'EGX:S'+i,model:'m',prompt:'p'+i,result:{text:'r'+i}});
 const page1=await listAnalyses('omar');assert.equal(page1.items.length,20);assert.ok(page1.nextCursor);
 const page2=await listAnalyses('omar',page1.nextCursor);assert.ok(page2.items.length>=3);
 assert.equal((await listAnalyses('other-user')).items.length,0);
 globalThis.__failHistoryBatch=true;
 const failed=await captureAnalysis('omar',{...stock,model:'failed',prompt:'not stored',result:{text:'not stored'}});
 assert.equal(failed.saved,false);assert.equal((await activeAnalysis('omar',stock)).id,first.id);
 console.log('PASS: immutable AI history, active-version restore, pagination, account/scope isolation and atomic failure behavior.');
}finally{
 db.close();delete globalThis.__historyDb;delete globalThis.__failHistoryBatch;rmSync(temp,{recursive:true,force:true});
}
