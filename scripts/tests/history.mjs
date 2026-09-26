import ts from 'typescript';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'tradelens-history-'));
try{
 const js=ts.transpileModule(readFileSync('lib/history-csv.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 writeFileSync(join(dir,'csv.mjs'),js);
 const {parseCsv,mappedPoints}=await import(join(dir,'csv.mjs'));
 const rows=parseCsv('Date;Symbol;Closing Price\r\n25/09/2026;EMAAR;11.80\r\n24/09/2026;EMAAR;11.50\r\n25/09/2026;DIB;7.50\r\n');
 assert.deepEqual(mappedPoints(rows,0,2,1,'EMAAR'),[{date:'2026-09-24',price:11.5},{date:'2026-09-25',price:11.8}]);
 assert.equal(mappedPoints(rows,0,2,1,'DIB').length,1);
 console.log('PASS: official-style delimited price import, date normalization and symbol filtering.');
}finally{rmSync(dir,{recursive:true,force:true})}
