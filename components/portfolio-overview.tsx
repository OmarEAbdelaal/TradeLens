'use client';
import {useMemo} from 'react';
import {totals,type Account} from '@/lib/paper';
import {holdingViews} from '@/lib/holding-view';
import type {Market} from '@/lib/market';
import DashboardSection from './dashboard-section';
export const number=(v:number|null,digits=2)=>v===null||!Number.isFinite(v)?'—':v.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const direction=(v:number|null)=>v===null||v===0?'neutral':v>0?'positive':'negative';
export const signedNumber=(v:number|null)=>v===null?'—':`${v>0?'+':''}${number(v)}`;
export default function PortfolioOverview({account,market,language}:{account:Account|null;market:Market|null;language:string}){
 const t=(a:string,e:string)=>language==='ar'?a:e,c=account?.currency||'AED',s=useMemo(()=>account?totals(account,market):null,[account,market]),held=useMemo(()=>account?holdingViews(account,market).filter(p=>p.qty>0):[],[account,market]);
 const pnl=s?.complete&&account?s.equity-account.initial:null,invested=account?held.reduce((n,p)=>n+p.cost,0):null,day=account&&held.every(p=>p.day!==null&&p.q?.lastTrade===market?.date)?held.reduce((n,p)=>n+p.day!,0):null;
 const wins=held.filter(p=>(p.pnl??0)>0).length,losses=held.filter(p=>(p.pnl??0)<0).length,unknown=held.filter(p=>p.pnl===null).length;
 return <DashboardSection id="overview" title={t('ملخص المحفظة','Portfolio overview')} language={language} defaultOpen summary={<span dir="ltr">{number(s?.complete?s.equity:null)} {c} · {signedNumber(pnl)}</span>}><div className="overview-grid">
 <article className="equity-metric"><span>{t('إجمالي المحفظة','Portfolio value')}</span><strong dir="ltr">{number(s?.complete?s.equity:null)} <small>{c}</small></strong><small>{t('النقد + الأسهم بالأسعار المتاحة','Cash + holdings at available prices')}</small></article>
 <article><span>{t('إجمالي الربح / الخسارة','Total profit / loss')}</span><strong dir="ltr" className={direction(pnl)}>{pnl===null?'':pnl>0?'↗ ':pnl<0?'↘ ':'＝ '}{signedNumber(pnl)}</strong><small dir="ltr">{account&&account.initial>0&&pnl!==null?`${signedNumber(pnl/account.initial*100)}% · `:''}{t('بعد المصاريف المدفوعة','After paid costs')}</small></article>
 <article><span>{t('النقد المتاح','Available cash')}</span><strong dir="ltr">{number(account?.cash??null)}</strong><small>{c}</small></article>
 <article><span>{t('المبلغ المستثمر','Invested amount')}</span><strong dir="ltr">{number(invested)}</strong><small>{t('تكلفة المتبقي مع رسوم الشراء','Remaining cost incl. buy fees')}</small></article>
 <article><span>{t('تغيّر اليوم','Day change')}</span><strong dir="ltr" className={direction(day)}>{day===null?'':day>0?'↗ ':day<0?'↘ ':'＝ '}{signedNumber(day)}</strong><small>{t('تغيّر أسعار الكميات الحالية','Price change on current quantities')}</small></article></div>
 <div className="portfolio-pulse"><span>{t('أسهمك الآن','Your holdings')} <b>{held.length}</b></span><span className="positive">↗ {wins} {t('رابحة','winning')}</span><span className="negative">↘ {losses} {t('خاسرة','losing')}</span><span>＝ {held.length-wins-losses-unknown} {t('متعادل','flat')}</span>{unknown>0&&<span>{unknown} {t('بسعر غير متاح','without a price')}</span>}<small>{t('بحسب الربح غير المحقق بعد رسوم الشراء','Unrealized P/L includes buy fees')}</small></div></DashboardSection>;
}
