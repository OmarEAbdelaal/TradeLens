import {env} from 'cloudflare:workers';
import {database} from '@/db/store';

export type Provider='openai'|'anthropic'|'gemini'|'openrouter'|'compatible';
export type Preferences={defaultSharia:'all'|'approved'|'unmarked';refreshMinutes:0|1|5|15;compactRows:boolean};
export type Settings={provider:Provider;model:string;endpoint:string;apiKey:string;preferences:Preferences};
export const defaults:Settings={provider:'openai',model:'gpt-6-luna',endpoint:'',apiKey:'',preferences:{defaultSharia:'all',refreshMinutes:1,compactRows:false}};
type Stored=Omit<Settings,'apiKey'>&{secret?:string};
const bytes=new TextEncoder();
function encryptionKey(){const raw=env.TRADELENS_ENCRYPTION_KEY;if(!raw)throw new Error('Secret configuration unavailable');return crypto.subtle.importKey('raw',Uint8Array.from(atob(raw),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt','decrypt']);}
const encode=(a:Uint8Array)=>btoa(String.fromCharCode(...a));
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function seal(value:string,user:string){const iv=crypto.getRandomValues(new Uint8Array(12));const result=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes.encode(user)},await encryptionKey(),bytes.encode(value));return `${encode(iv)}.${encode(new Uint8Array(result))}`;}
async function unseal(value:string,user:string){const [nonce,cipher]=value.split('.');if(!nonce||!cipher)throw new Error('Invalid secret');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(nonce),additionalData:bytes.encode(user)},await encryptionKey(),decode(cipher)));}
export async function loadSettings(user:string):Promise<Settings>{const row=await database().prepare('SELECT data FROM user_settings WHERE user_id=?').bind(user).first<{data:string}>();if(!row)return structuredClone(defaults);const record=JSON.parse(row.data) as Stored;return {...defaults,...record,apiKey:record.secret?await unseal(record.secret,user):'',preferences:{...defaults.preferences,...record.preferences,refreshMinutes:1}};}
export async function saveSettings(user:string,input:Settings){const {apiKey,...rest}=input;const record:Stored={...rest,secret:apiKey?await seal(apiKey,user):undefined};await database().prepare('INSERT INTO user_settings(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(user,JSON.stringify(record),new Date().toISOString()).run();}
export function publicSettings(s:Settings){const {apiKey,...rest}=s;return {...rest,configured:!!apiKey};}
export function validEndpoint(value:string){try{const u=new URL(value);const host=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search&&!u.port&&host.includes('.')&&!/^(localhost|.*\.(localhost|local|internal|test))$/.test(host)&&!/^\d+\.\d+\.\d+\.\d+$/.test(host)&&!host.includes(':')&&value.length<=300}catch{return false}}
