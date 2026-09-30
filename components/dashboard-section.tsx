'use client';
import {useEffect,useId,useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
/** Collapsing keeps inputs and AI results mounted. */
export default function DashboardSection({id,title,summary,children,defaultOpen=false,language='ar',className=''}:{id:string;title:ReactNode;summary?:ReactNode;children:ReactNode;defaultOpen?:boolean;language?:string;className?:string}){
 const [open,setOpen]=useState(defaultOpen),region=useId();
 useEffect(()=>{try{const saved=localStorage.getItem('tradelens-section:'+id);setOpen(saved===null?defaultOpen:saved==='true')}catch{}},[id,defaultOpen]);
 function toggle(){const next=!open;setOpen(next);try{localStorage.setItem('tradelens-section:'+id,String(next))}catch{}}
 return <section className={`dashboard-section ${className}`} data-open={open}><h2 className="section-heading"><button type="button" className="section-toggle" aria-expanded={open} aria-controls={region} onClick={toggle}><span className="section-title">{title}</span><span className="section-summary">{summary}</span><span className="section-toggle-label">{language==='ar'?(open?'طيّ':'عرض'):(open?'Collapse':'Expand')}</span><ChevronDown size={18} aria-hidden="true"/></button></h2><div id={region} hidden={!open} className="section-body">{children}</div></section>;
}
