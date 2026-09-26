import type {Settings} from './settings';

export function normalizeOpenAIModelId(value:string){
 const name=value.trim().toLowerCase().replace(/[\s_]+/g,'-');
 const aliases:Record<string,string>={
  'gpt-6-astra':'gpt-6-astra',
  'gpt6-astra':'gpt-6-astra',
  'gpt-6-sol':'gpt-6-sol',
  'gpt6-sol':'gpt-6-sol',
  'gpt-6-luna':'gpt-6-luna',
  'gpt6-luna':'gpt-6-luna',
  'gpt-6-لون':'gpt-6-luna',
  'gpt-6-لونا':'gpt-6-luna',
 };
 return aliases[name]??value.trim();
}

export class ModelProviderError extends Error{
 constructor(message:string,readonly status:number){super(message)}
}

function safeProviderMessage(raw:string,key:string){
 try{
  const parsed=JSON.parse(raw) as {error?:{message?:unknown;code?:unknown;param?:unknown}|string;message?:unknown};
  const error=parsed.error;
  const detail=typeof error==='string'?error:typeof error?.message==='string'?error.message:typeof parsed.message==='string'?parsed.message:'';
  const cleaned=detail.replaceAll(key,'[redacted]').replace(/sk-[\w-]{8,}/gi,'[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/[\r\n]+/g,' ').slice(0,400);
  return cleaned;
 }catch{return ''}
}

export type Citation={url:string;title:string;startIndex?:number;endIndex?:number};
export async function requestModel(settings:Settings,prompt:string,maxOutputTokens:number,signal:AbortSignal,options:{webSearch?:boolean}={}){
 const model=settings.provider==='openai'?normalizeOpenAIModelId(settings.model):settings.model.trim();
 let url:string,headers:Record<string,string>,body:object;
 if(settings.provider==='anthropic'){
  url='https://api.anthropic.com/v1/messages';
  headers={'content-type':'application/json','x-api-key':settings.apiKey,'anthropic-version':'2023-06-01'};
  body={model,max_tokens:maxOutputTokens,messages:[{role:'user',content:prompt}]};
 }else if(settings.provider==='gemini'){
  url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  headers={'content-type':'application/json','x-goog-api-key':settings.apiKey};
  body={contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens}};
 }else if(settings.provider==='openai'){
  url='https://api.openai.com/v1/responses';
  headers={'content-type':'application/json',Authorization:`Bearer ${settings.apiKey}`};
  body={model,input:prompt,max_output_tokens:maxOutputTokens,...(model.startsWith('gpt-6-')?{reasoning:{effort:'low'}}:{}),
   ...(options.webSearch?{tools:[{type:'web_search',search_context_size:'medium'}],tool_choice:'required',include:['web_search_call.action.sources']}: {})};
 }else{
  url=settings.provider==='openrouter'?'https://openrouter.ai/api/v1/chat/completions':settings.endpoint;
  headers={'content-type':'application/json',Authorization:`Bearer ${settings.apiKey}`};
  body={model,max_tokens:maxOutputTokens,messages:[{role:'user',content:prompt}]};
 }
 const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal,redirect:'manual'});
 if(!response.ok){
  const detail=safeProviderMessage((await response.text()).slice(0,4096),settings.apiKey);
  throw new ModelProviderError(`رفض ${settings.provider==='openai'?'OpenAI':settings.provider} الطلب (${response.status})${detail?`: ${detail}`:'. راجع Model ID وصلاحية المفتاح وحدود الحساب.'}`,502);
 }
 const data=await response.json() as {
  output_text?:string;
  output?:{type?:string;content?:{type?:string;text?:string;annotations?:{type?:string;url?:string;title?:string;start_index?:number;end_index?:number}[]}[];action?:{sources?:{url?:string;title?:string}[]}}[];
  status?:string;incomplete_details?:{reason?:string};
  choices?:{message?:{content?:string}}[];
  content?:{type?:string;text?:string}[];
  candidates?:{content?:{parts?:{text?:string}[]}}[];
 };
 const text=settings.provider==='openai'
  ?data.output_text||data.output?.flatMap(item=>item.type==='message'?item.content??[]:[]).filter(part=>part.type==='output_text').map(part=>part.text??'').join('')
  :settings.provider==='anthropic'?data.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n')
  :settings.provider==='gemini'?data.candidates?.[0]?.content?.parts?.map(x=>x.text).join('\n')
  :data.choices?.[0]?.message?.content;
 if(!text)throw new ModelProviderError(data.status==='incomplete'?'انتهى حد التوكنز قبل اكتمال الرد. جرّب نموذجًا آخر أو أعد المحاولة.':'لم يُرجع النموذج نصًا. راجع اسم النموذج وحاول مجددًا.',502);
 const sources: Citation[]=[];
 if(settings.provider==='openai'){
  for(const item of data.output??[]){
   for(const part of item.content??[])for(const annotation of part.annotations??[]){
    if(annotation.type==='url_citation'&&annotation.url)sources.push({url:annotation.url,title:annotation.title||annotation.url,startIndex:annotation.start_index,endIndex:annotation.end_index});
   }
   for(const source of item.action?.sources??[])if(source.url)sources.push({url:source.url,title:source.title||source.url});
  }
 }
 const unique=new Map<string,Citation>();
 for(const source of sources){
  try{if(new URL(source.url).protocol!=='https:')continue}catch{continue}
  if(!unique.has(source.url)||source.startIndex!==undefined)unique.set(source.url,source);
 }
 const citations=[...unique.values()].slice(0,20);
 return {text,model,citations,webSearchUsed:settings.provider==='openai'&&!!data.output?.some(item=>item.type==='web_search_call')};
}
