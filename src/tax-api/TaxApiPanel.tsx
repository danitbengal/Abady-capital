import type { CapitalState } from '../capital/model'
import { fullSchema, API_VERSION } from './schema'
import { asObject, confirmEmptySections, createApiDraft, draftIssues, readyPayload, type TaxApiDraft } from './payload'
import { ApiFormEditor } from './ApiFormEditor'
import './tax-api.css'

export function TaxApiPanel({state,onChange}:{state:CapitalState;onChange:(update:(state:CapitalState)=>CapitalState,event?:string)=>void}){
  const draft=state.taxApi??createApiDraft(state)
  const issues=draftIssues(state,draft)
  const snapshot=JSON.stringify({payload:draft.payload,source:draft.sourceSnapshot,review:draft.emptyReviewed,directories:draft.directoriesReviewed})
  const approved=draft.approvedSnapshot===snapshot&&issues.length===0
  const update=(patch:Partial<TaxApiDraft>)=>onChange(old=>({...old,taxApi:{...(old.taxApi??createApiDraft(old)),...patch,approvedSnapshot:undefined}}))
  function download(){
    if(!approved)return
    const blob=new Blob([JSON.stringify(readyPayload(state,draft),null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='capital-declaration-api-sandbox.json';anchor.click();URL.revokeObjectURL(url)
  }
  return <section className="cp-panel tax-api-panel"><h2>הכנה לשידור הצהרת הון באמצעות API</h2><p>לפי מסמך רשות המסים {API_VERSION} · הצהרה מלאה</p><div className="cp-info">מכינים את פרטי ההצהרה, בודקים חוסרים ומאשרים לפני הפקת בקשת בדיקות. מסך זה אינו משדר לרשות המסים.</div>
    <p>הערות פנימיות, מסמכים ותחשיב השוואת ההון נשארים בתיק המשרד. נתוני עסקים דורשים פירוט לפי כל עסק; סכום כללי אינו מחליף אותו.</p>
    <div className="cp-heading-actions"><button className="cp-btn cp-btn-white" onClick={()=>{if(window.confirm('לרענן את טיוטת השידור מנתוני ההצהרה? השלמות ה־API ואישור קודם יוחלפו.'))onChange(old=>({...old,taxApi:createApiDraft(old)}),'רועננה טיוטת API מההצהרה')}}>רענון מנתוני ההצהרה</button><button className="cp-btn cp-btn-white" onClick={()=>{if(window.confirm('בדקת שכל הסעיפים שטרם נבדקו אכן אינם קיימים? סעיפים עם פריטים יישארו ללא שינוי.'))update({payload:asObject(confirmEmptySections(draft.payload)),emptyReviewed:true})}}>בדקתי — סעיפים ריקים אינם קיימים</button></div>
    <ApiFormEditor schema={fullSchema} value={draft.payload} onChange={payload=>update({payload:asObject(payload)})}/>
    <label className="cp-check"><input type="checkbox" checked={draft.emptyReviewed} onChange={event=>update({emptyReviewed:event.target.checked})}/>בדקתי את היקף ההצהרה, הפרטים והסעיפים הריקים</label>
    <label className="cp-check"><input type="checkbox" checked={draft.directoriesReviewed} onChange={event=>update({directoriesReviewed:event.target.checked})}/>אימתתי קודי מדינות, בנקים, סניפים, ערים ורחובות מול הרשימות הרשמיות</label>
    <div className="tax-api-validation" role="status"><strong>{issues.length?`${issues.length} פרטים דורשים השלמה ובדיקה`:'בדיקות ההכנה המקומיות עברו'}</strong><ul>{issues.slice(0,40).map((issue,index)=><li key={index}><span dir="ltr">{issue.path}</span> — {issue.message}</li>)}</ul>{issues.length>40&&<p>מוצגים 40 החוסרים הראשונים; לאחר ההשלמה יופיעו השאר.</p>}</div>
    <div className="cp-heading-actions"><button className="cp-btn cp-btn-primary" disabled={issues.length>0||approved} onClick={()=>onChange(old=>({...old,taxApi:{...draft,approvedSnapshot:snapshot}}),'המשרד אישר תוכן בקשת API לבדיקה')}>{approved?'התוכן אושר לבדיקה':'בדקתי ומאשרת את התוכן לבדיקה'}</button><button className="cp-btn cp-btn-white" disabled={!approved} onClick={download}>הורדת בקשת בדיקות מאושרת</button></div><p className="cp-footnote">שינוי בנתוני השידור מבטל אישור. שידור חי מחייב חיבור שרת, הרשאת OAuth2 ובדיקות Sandbox מול הרשות.</p>
  </section>
}
