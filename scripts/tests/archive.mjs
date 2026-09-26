import ts from 'typescript';
import * as XLSX from 'xlsx';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'dfm-archive-'));
try{
 let source=ts.transpileModule(readFileSync('lib/dfm-archive.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 source=source.replaceAll("'@/db/store'","'./store.mjs'").replaceAll("'xlsx'",JSON.stringify(import.meta.resolve('xlsx')));
 writeFileSync(join(dir,'archive.mjs'),source);writeFileSync(join(dir,'store.mjs'),'export const database=()=>({});');
 const {archiveUrl,parseArchive}=await import(join(dir,'archive.mjs'));
 assert.equal(archiveUrl('2026-09-24'),'https://service.dfm.ae/Bulletins/Bulletins/DownloadFullExcel?bdate=Daily_Bulletin_24092026');
 const headings=['Symbol-Security Name','Previous Close','','','','','Current Close','','','','Last Date','','Trade Volume'];
 const companies=['AMAN','DU','UPP','DSI','TECOM','EMPOWER'];
 const rows=[headings,...companies.map((symbol,i)=>{const row=Array(13).fill('');row[0]=`${symbol} - Example`;row[6]=String(i+1);row[10]=i===0?'23/09/2026':'24/09/2026';row[12]='100';return row})];
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'Bulletins');
 const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
 const result=parseArchive(bytes,'2026-09-24',new Set(companies));
 assert.equal(result.prices.AMAN,undefined);assert.equal(result.prices.DU,2);assert.equal(Object.keys(result.prices).length,5);
 assert.throws(()=>parseArchive(bytes,'2026-09-25',new Set(companies)));
 console.log('PASS: archive date URL, symbol allowlist, five active closes, mismatched-date rejection.');
}finally{rmSync(dir,{recursive:true,force:true})}
