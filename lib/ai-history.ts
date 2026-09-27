import type {MarketId} from './markets';
export type AnalysisKind='stock'|'portfolio'|'stock_prompt'|'portfolio_prompt';
export type AnalysisScope={kind:AnalysisKind;market:MarketId;currency:string;subject:string};
export type AnalysisSummary=AnalysisScope&{id:string;model:string;createdAt:string};
export type AnalysisRecord=AnalysisSummary&{prompt:string;result:Record<string,unknown>};
export const analysisScope=(s:AnalysisScope)=>JSON.stringify([s.kind,s.market,s.currency,s.subject]);
export const selectionKey=(user:string,s:AnalysisScope)=>JSON.stringify([user,s.kind,s.market,s.currency,s.subject]);
export function analysisParams(s:AnalysisScope){return new URLSearchParams({...s,mode:'active'}).toString()}
