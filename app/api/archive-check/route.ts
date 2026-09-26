import * as XLSX from 'xlsx';
import {archiveUrl} from '@/lib/dfm-archive';
export const dynamic='force-dynamic';
export async function GET(){try{const r=await fetch(archiveUrl('2026-09-24'),{signal:AbortSignal.timeout(12000)});const bytes=new Uint8Array(await r.arrayBuffer());const book=XLSX.read(bytes,{type:'array'});return Response.json({status:r.status,contentType:r.headers.get('content-type'),bytes:bytes.length,sheets:book.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name],{header:1,raw:false}).slice(0,6).map(row=>row.slice(0,15))}))})}catch(e){return Response.json({error:e instanceof Error?e.message:'error'},{status:502})}}
