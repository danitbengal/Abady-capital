import { useEffect,useState } from 'react'
import { requireCapitalSupabase } from '../lib/supabase'
import { ApiFormEditor } from '../tax-api/ApiFormEditor'
import { asObject,confirmEmptySections,payloadHash,projectPayload,validatePayload,type JsonObject } from '../tax-api/payload'
import { fullSchema,emptyValue } from '../tax-api/schema'
import '../tax-api/tax-api.css'

type Job={id:string;payload:JsonObject;payload_hash:string;status:string;environment:'sandbox'|'production';created_at:string;authority_error_id:string|null}
const statuses:Record<string,string>={draft:'טיוטה לבדיקה',approved:'אושרה במשרד',sending:'ניסיון שידור בתהליך — אין לשדר שוב',succeeded:'התקבל אישור הצלחה מהשירות',rejected:'נדחתה — נדרש תיקון',unknown:'תוצאה אינה ידועה — נדרש בירור לפני ניסיון נוסף'}
export function CaseTaxApiPanel({caseId,taxIdentifier,date}:{caseId:string;taxIdentifier:string;date:string}){
  const [payload,setPayload]=useState<JsonObject>(()=>{
    const value=asObject(emptyValue(fullSchema));Object.assign(asObject(value.details),{tikNumber:/^\d{1,9}$/.test(taxIdentifier)?Number(taxIdentifier):'',dochToDayDate:`${date}T00:00:00Z`});return value
  })
  const [jobs,setJobs]=useState<Job[]>([]);const [selectedId,setSelectedId]=useState('');const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('');const [reviewed,setReviewed]=useState(false);const [environment,setEnvironment]=useState<'sandbox'|'production'>('sandbox')
  const [hash,setHash]=useState('')
  const issues=validatePayload(payload);const currentJob=jobs.find(job=>job.id===selectedId)
  const matches=Boolean(currentJob&&hash&&hash===currentJob.payload_hash&&currentJob.environment===environment)
  useEffect(()=>{let active=true;setHash('');void payloadHash(projectPayload(payload)).then(value=>{if(active)setHash(value)});return ()=>{active=false}},[payload])
  useEffect(()=>{void reload()},[caseId])
  async function reload(){
    const {data,error}=await requireCapitalSupabase().from('tax_api_submissions').select('id,payload,payload_hash,status,environment,created_at,authority_error_id').eq('case_id',caseId).order('created_at',{ascending:false})
    if(error)setMessage('שמירת השידורים טרם זמינה. נדרשת הפעלת מיגרציית API ופריסת שירות השרת.')
    else setJobs(data??[])
  }
  async function action(kind:'prepare'|'approve'|'send'){
    if(busy||issues.length||!reviewed)return
    if(kind!=='prepare'&&!matches)return
    if(kind==='send'&&!window.confirm(environment==='production'?'אישור סופי: לשדר את ההצהרה המאושרת לסביבת הייצור של רשות המסים? המפרט מציין שדיווח טיוטה קודם עשוי להיות מוחלף.':'לשלוח את הבקשה המאושרת לסביבת הבדיקות של רשות המסים?'))return
    setBusy(true);setMessage('')
    try{
      const {data,error}=await requireCapitalSupabase().functions.invoke('tax-api',{body:kind==='prepare'?{action:kind,caseId,environment,payload:projectPayload(payload)}:{action:kind,id:selectedId}})
      if(error){setMessage('הפעולה לא הושלמה. בדקי את מצב הבקשה ברשימה לפני ניסיון נוסף. ייתכן ששירות השידור או הרשאותיו טרם הוגדרו.');await reload();return}
      if(data.id)setSelectedId(data.id)
      setMessage(kind==='send'?`${environment==='sandbox'?'תוצאת בדיקות בלבד: ':''}${statuses[data.status]??'יש לבדוק את התוצאה'}${data.errorId?` · מספר בירור ${data.errorId}`:''}`:kind==='prepare'?'נשמרה בקשת שידור בשרת. בדקי ואשרי את התוכן לפני שליחה.':'התוכן אושר במשרד. טרם בוצע שידור.')
      await reload()
    }catch{setMessage('התקשורת נותקה. יש לבדוק את מצב הבקשה לפני ניסיון נוסף.')}finally{setBusy(false)}
  }
  return <section className="prod-panel tax-api-panel"><h2>שידור הצהרת הון לרשות המסים</h2><p>בקשת הצהרה מלאה לפי מפרט 05.2025. יש להשלים פירוט נכסים ועסקים; פרטי קובץ או סכום כללי אינם מספיקים לשידור.</p><p>הערות משרד, קבצים והשוואת הון אינם נשלחים בשירות זה. השלמות הטופס נשמרות בשרת בעת שמירת בקשת שידור תקינה.</p>
    <label className="tax-api-field">סביבת שידור<select value={environment} onChange={event=>{setEnvironment(event.target.value as 'sandbox'|'production');setReviewed(false)}}><option value="sandbox">בדיקות — Sandbox</option><option value="production">ייצור — נדרשת הפעלה נפרדת בשרת</option></select></label>
    <button className="cp-btn cp-btn-white" disabled={busy} onClick={()=>{if(window.confirm('בדקת שסעיפים ללא פירוט אכן אינם קיימים?')){setPayload(asObject(confirmEmptySections(payload)));setReviewed(false)}}}>סימון סעיפים ריקים כאינם קיימים לאחר בדיקה</button>
    <ApiFormEditor schema={fullSchema} value={payload} onChange={next=>{setPayload(asObject(next));setReviewed(false)}}/>
    <label className="cp-check"><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/>בדקתי את כל פרטי ההצהרה, הסעיפים הריקים וקודי הרשימות הרשמיות</label>
    <div className="tax-api-validation"><strong>{issues.length?`${issues.length} חוסרים ושגיאות לפני שמירה`:'בדיקת המבנה המקומית עברה'}</strong><ul>{issues.slice(0,20).map((issue,index)=><li key={index}><span dir="ltr">{issue.path}</span> — {issue.message}</li>)}</ul></div>
    <div className="cp-heading-actions"><button className="cp-btn cp-btn-white" disabled={busy||issues.length>0||!reviewed} onClick={()=>void action('prepare')}>שמירת בקשת שידור לבדיקה</button><button className="cp-btn cp-btn-white" disabled={busy||issues.length>0||!reviewed||!matches||currentJob?.status!=='draft'} onClick={()=>void action('approve')}>אישור תוכן במשרד</button><button className="cp-btn cp-btn-primary" disabled={busy||issues.length>0||!reviewed||!matches||currentJob?.status!=='approved'} onClick={()=>void action('send')}>שידור בקשה מאושרת — {environment==='sandbox'?'בדיקות':'ייצור'}</button></div>
    {message&&<div role="status" className="prod-error">{message}</div>}
    <h3>היסטוריית בקשות שידור</h3>{jobs.map(job=><div key={job.id} className="tax-api-validation"><strong>{job.environment==='sandbox'?'בדיקות':'ייצור'} · {statuses[job.status]}</strong><p>{new Date(job.created_at).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})}{job.authority_error_id?` · מספר בירור: ${job.authority_error_id}`:''}</p><button className="cp-btn cp-btn-white" onClick={()=>{setPayload(job.payload);setSelectedId(job.id);setEnvironment(job.environment);setReviewed(false)}}>פתיחת התוכן שנשמר</button></div>)}
  </section>
}
