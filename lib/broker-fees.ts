import type {FeeConfig} from './paper';
export type FeeBreakdown={commission:number;fixed:number;vat:number;total:number;lines:{label:string;amount:number}[]};
export const TARIFFS={
 manual:{name:'تعريفة حسابي / Manual',source:'',markets:['dfm','nasdaqdubai','adx','egx','us','saudi','qatar','kuwait','bahrain'],note:'أدخل جميع البنود حسب كشف حسابك؛ الصفر يحتاج تأكيدًا.'},
 'enbd-adx':{name:'Emirates NBD · ADX',source:'https://www.emiratesnbdsecurities.com/en/schedule-of-fees',markets:['adx'],note:'0.15% + ضريبة 5% على الرسوم؛ التعريفة القياسية.'},
 'ibkr-fixed':{name:'IBKR Pro Fixed · US',source:'https://www.interactivebrokers.com/en/pricing/commissions-stocks.php',markets:['us'],note:'0.005$ للسهم، حد أدنى 1$ وحد أقصى 1%؛ رسوم التنظيم للبيع وCAT إضافية. حساب Fixed فقط. هذه لقطة لتعريفة 28 سبتمبر 2026، وليست تحديثًا آليًا للرسوم التنظيمية.'},
 sarwa:{name:'Sarwa Trade · US',source:'https://help.sarwa.co/hc/en-us/articles/4410507627281-What-are-the-fees-for-Sarwa-Trade',markets:['us'],note:'الأكبر من 1$ أو 0.25%. أضف أي رسوم تنظيمية يفرضها كشف حسابك في البنود الإضافية.'},
 'thndr-egx':{name:'Thndr · EGX',source:'https://support.thndr.app/en/articles/638558-thndr-order-fees',markets:['egx'],note:'الخطة العادية: 2 ج + 0.1%، ورسوم البورصة والمقاصة والرقابة والتأمين والدمغة 0.05%. يفترض تنفيذًا واحدًا؛ استرداد دمغة T0 غير محسوب. الحفظ السنوي 0.01% من قيمة الأسهم في 31 ديسمبر يسجل كمصروف عند استحقاقه.'},
 'thndr-us':{name:'Thndr · US',source:'https://support.thndr.app/en/articles/638558-thndr-order-fees',markets:['us'],note:'0.20$ + 0.1% + 0.0015$ للسهم، وأطراف ثالثة 0.000199$ للسهم؛ دون اشتراك.'},
 'thndr-uae':{name:'Thndr · UAE',source:'https://support.thndr.app/en/articles/638558-thndr-order-fees',markets:['adx','dfm'],note:'0.49 درهم + 0.1%، وأطراف ثالثة 0.03125% وضريبة 0.00125% من قيمة الأمر. راجع إتاحة السوق لحسابك.'},
 'qatar-standard':{name:'Qatar Exchange · عمولة السوق القياسية',source:'https://www.qe.com.qa/web/guest/displaynewsdetails?ImgURL=&InfoID=42478',markets:['qatar'],note:'0.275% دون حد أدنى وفق تعديل 16 مارس 2025؛ راجع أي خدمات إضافية للوسيط.'}
} as const;
export type Tariff=keyof typeof TARIFFS;
export const TARIFF_CURRENCY:Partial<Record<Tariff,string>>={'enbd-adx':'AED','ibkr-fixed':'USD',sarwa:'USD','thndr-egx':'EGP','thndr-us':'USD','thndr-uae':'AED','qatar-standard':'QAR'};
export function validateTariffCurrency(c:FeeConfig|undefined,currency:string){if(c?.tariff&&TARIFF_CURRENCY[c.tariff]&&TARIFF_CURRENCY[c.tariff]!==currency)throw new Error('عملة التعريفة لا تطابق عملة المحفظة.');}
export const DIRECTORIES:Record<string,{url:string;names:string}>={
 dfm:{url:'https://www.dfm.ae/members/brokers-directory',names:'DFM · دليل الوسطاء الرسمي'},nasdaqdubai:{url:'https://www.nasdaqdubai.com/members/list-of-members',names:'Nasdaq Dubai · الأعضاء'},adx:{url:'https://www.adx.ae/members-and-participants/members/trading-members-directory',names:'ADX · أعضاء التداول'},egx:{url:'https://www.egx.com.eg/',names:'EGX · شركات السمسرة'},us:{url:'https://brokercheck.finra.org/',names:'FINRA BrokerCheck · الوسطاء المسجلون'},saudi:{url:'https://www.saudiexchange.sa/wps/portal/saudiexchange/trading/participants-directory/members-directory?locale=en',names:'تداول السعودية · الأعضاء'},qatar:{url:'https://www.qe.com.qa/en/broker-contact-information',names:'The Group · Dlala · QSC · Wasata · QNB FS · CBFS · Ahli'},kuwait:{url:'https://www.boursakuwait.com.kw/',names:'بورصة الكويت · الوسطاء'},bahrain:{url:'https://bahrainbourse.com/en/Brokers/MemberInformation/member-firm-directory',names:'بورصة البحرين · الأعضاء'}};
const r=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
export function calculateFees(value:number,broker:string,market:string='dfm',c:FeeConfig={percent:0,fixed:0},qty=0,side:'buy'|'sell'='buy'):FeeBreakdown{
 if(!Number.isFinite(value)||value<0||!Number.isFinite(qty)||qty<0)throw new Error('Invalid fee input');
 for(const key of ['percent','fixed','minimum','vatPercent','perShare','sellPercent','sellPerShare','fxPercent','extraFixed'] as const){const n=c[key]??0;if(!Number.isFinite(n)||n<0||n>10000)throw new Error('Invalid fee input')}
 const lines:FeeBreakdown['lines']=[];let commission=0,fixed=0,vat=0;
 const add=(label:string,n:number)=>{if(n)lines.push({label,amount:r(n)})};
 const tariff=c.tariff||'manual';if(tariff!=='manual'&&(!(tariff in TARIFFS)||!(TARIFFS[tariff].markets as readonly string[]).includes(market)))throw new Error('تعريفة لا تناسب السوق.');
 if(tariff==='manual'&&market==='dfm'&&['alramz','enbd'].includes(broker)){commission=value*.00275;fixed=10;vat=(value*.00225+fixed)*.05;}
 else if(tariff==='enbd-adx'){commission=value*.0015;vat=commission*.05;}
 else if(tariff==='ibkr-fixed'){commission=Math.min(Math.max(qty*.005,1),value*.01);add('CAT',qty*.000003);if(side==='sell'){add('SEC',Math.ceil(value*.0000206*100)/100);add('FINRA TAF (حد أقصى $9.79)',Math.min(9.79,Math.ceil(qty*.000195*100)/100));}}
 else if(tariff==='sarwa'){commission=Math.max(1,value*.0025);}
 else if(tariff==='thndr-egx'){commission=value*.001;fixed=2;add('EGX',Math.min(5000,value*.0001));add('MCDR',Math.min(5000,value*.0001));add('FRA · تنفيذ واحد',Math.min(250,Math.max(1,value*.00005)));add('صندوق التأمين',Math.min(5000,value*.00005));add('دمغة T1 / T2',value*.0005);}
 else if(tariff==='thndr-us'){commission=value*.001+qty*.0015;fixed=.2;add('أطراف ثالثة',qty*.000199);}
 else if(tariff==='thndr-uae'){commission=value*.001;fixed=.49;add('أطراف ثالثة',value*.0003125);vat=value*.0000125;}
 else if(tariff==='qatar-standard'){commission=value*.00275;}
 else{commission=Math.max(value*c.percent/100+qty*(c.perShare||0),c.minimum||0);fixed=c.fixed;vat=(commission+fixed)*(c.vatPercent||0)/100;}
 add('عمولة الوسيط والسوق',commission);add('رسم ثابت',fixed);add('ضريبة على الرسوم',vat);
 if(side==='sell')add('رسوم / ضريبة بيع إضافية',value*(c.sellPercent||0)/100+qty*(c.sellPerShare||0));
 add('تكلفة تحويل العملة',value*(c.fxPercent||0)/100);add('مصاريف إضافية لكل أمر',c.extraFixed||0);
 return {commission:r(commission),fixed:r(fixed),vat:r(vat),total:r(lines.reduce((s,l)=>s+l.amount,0)),lines};
}
