import { Check, FileText, Landmark, Plus, Trash2, Wallet } from 'lucide-react'
import { calculateForm1219, form1219Lines, valuesFromEntries, type Form1219Entry, type Form1219Owner } from './form1219'
import { currency, type CapitalState } from './model'
import './official1219.css'
import './simple-entries.css'

const parts = [
  { id: 'A', title: 'חלק א׳ — רכוש והתחייבויות פרטיים', note: 'נכסי התא המשפחתי בארץ ובחו״ל, לפי העלות בפועל.' },
  { id: 'B', title: 'חלק ב׳ — עסקים שבהם נערך מאזן', note: 'עסק, שותפות, חברה או תאגיד המדווחים לפי מאזן.' },
  { id: 'C', title: 'חלק ג׳ — עסקים שבהם לא נערך מאזן', note: 'פירוט נכסים והתחייבויות של העסק וחלק הבעלות.' },
] as const

const owners: { value: Form1219Owner; label: string }[] = [
  { value: 'taxpayer', label: 'הנישום/ה' },
  { value: 'spouse', label: 'בן/בת הזוג' },
  { value: 'joint', label: 'בעלות משותפת' },
  { value: 'child', label: 'ילד/ה' },
]

const totalLabels: Record<number, string> = {
  200: 'סך רכוש פרטי', 210: 'סך התחייבויות פרטיות', 220: 'רכוש פרטי נטו',
  340: 'סך בעסקים', 390: 'סך בשותפויות', 440: 'סך בחברות', 460: 'סך עסקים עם מאזן',
  670: 'סך נכסי עסק ללא מאזן', 730: 'סך התחייבויות עסק ללא מאזן', 740: 'הון עסק ללא מאזן',
  750: 'חלק הנישום בעסק', 770: 'סך עסקים ללא מאזן', 800: 'סך הון נקי בטופס',
}

interface Props {
  state: CapitalState
  onChange: (updater: (state: CapitalState) => CapitalState, event?: string) => void
  onOpenDocument: (documentId: string) => void
}

export function OfficialDeclaration1219({ state, onChange, onOpenDocument }: Props) {
  const values = valuesFromEntries(state.form1219Entries)
  const totals = calculateForm1219(values, state.form1219SharePercent)
  const updateEntry = (id: string, patch: Partial<Form1219Entry>) => onChange(s => ({ ...s, form1219Entries: s.form1219Entries.map(entry => entry.id === id ? { ...entry, ...patch } : entry), signature: { ...s.signature, state: 'draft', approvedAt: undefined } }))
  const addEntry = (code: number, label: string) => {
    const stamp = Date.now()
    const entryId = `1219-${code}-${stamp}`
    const documentId = `1219-doc-${code}-${stamp}`
    onChange(s => ({
      ...s,
      form1219Entries: [...s.form1219Entries, { id: entryId, code, description: label, note: '', owner: 'taxpayer', amount: 0, acquiredAt: '', currency: 'ILS', foreignAmount: 0, documentId }],
      docs: [...s.docs, { id: documentId, title: `אסמכתה לסעיף ${code} — ${label}`, category: `טופס 1219 · קוד ${code}`, status: 'missing', source: 'client', sample: false }],
    }), `נוסף פריט ודרישת מסמך לסעיף ${code}`)
  }
  const deleteEntry = (id: string) => onChange(s => ({ ...s, form1219Entries: s.form1219Entries.filter(entry => entry.id !== id) }), 'פריט הוסר מטיוטת טופס 1219')

  return <>
    <div className="cp-info"><FileText size={19}/><div><strong>טיוטת עבודה לפי טופס 1219 · מהדורת 12/2024</strong><p>כל סעיפי הטופס והחישובים המרכזיים ממופים בדגם. הסכומים מוצגים בשקלים שלמים ולפי עלות בפועל; מתנה או ירושה נרשמות בעלות של 1 ₪. לפני שידור תידרש בדיקת רואה חשבון מול הטופס הפעיל.</p></div></div>
    <section className="cp-panel cp-details"><div className="cp-panel-head"><div><h2>מועדי ההצהרה</h2><p>תאריך ההגשה יכול להתעדכן בלי לשנות את תוכן ההצהרה והמסמכים</p></div><span className="cp-badge cp-blue">טופס 1219</span></div><div className="cp-form-grid"><label className="cp-label">מועד הצהרה קודמת<input type="date" value={state.previousDate} onChange={e=>onChange(s=>({...s,previousDate:e.target.value}))}/></label><label className="cp-label">תאריך הצהרת הון<input type="date" value={state.currentDate} onChange={e=>onChange(s=>({...s,currentDate:e.target.value,draft:null}))}/></label><label className="cp-label">תאריך הגשה<input type="date" value={state.filingDate} onChange={e=>onChange(s=>({...s,filingDate:e.target.value,draft:null}))}/></label></div></section>

    {parts.map(part => <section className="cp-panel cp-official-part" key={part.id} data-part={part.id}>
      <div className="cp-panel-head"><div><h2>{part.title}</h2><p>{part.note}</p></div><span className="cp-badge">{form1219Lines.filter(line => line.part === part.id).length} סעיפים רשמיים</span></div>
      <div className="cp-official-codes">{form1219Lines.filter(line => line.part === part.id).map(line => {
        const entries = state.form1219Entries.filter(entry => entry.code === line.code)
        const lineTotal = entries.reduce((sum, entry) => sum + entry.amount, 0)
        return <details className="cp-code-card" key={line.code} open={entries.length > 0}>
          <summary><span className="cp-code-number">{line.code}</span><strong>{line.label}</strong><span>{currency(lineTotal)}</span></summary>
          <div className="cp-code-content">
            {entries.length === 0 ? <p className="cp-code-empty">לא הוזנו פריטים בסעיף זה.</p> : <div className="cp-simple-entries">{entries.map(entry => {
              const linkedDocument = state.docs.find(document => document.id === entry.documentId)
              return <div className="cp-simple-entry" key={entry.id}>
                <div className="cp-entry-main">
                  <label><span>תיאור</span><input aria-label={`תיאור סעיף ${line.code}`} value={entry.description} onChange={e=>updateEntry(entry.id,{description:e.target.value})}/></label>
                  <label className="cp-entry-amount"><span>סכום ₪</span><input className="cp-money" aria-label={`סכום סעיף ${line.code}`} type="number" step="1" value={entry.amount} onChange={e=>updateEntry(entry.id,{amount:Number(e.target.value)||0})}/></label>
                  <label><span>הערה ליד הסכום</span><input aria-label={`הערה לסכום בסעיף ${line.code}`} value={entry.note ?? ''} placeholder="למשל: יתרה לפי אישור הבנק" onChange={e=>updateEntry(entry.id,{note:e.target.value})}/></label>
                  <label className="cp-entry-document"><span>מסמך רלוונטי</span><div><select aria-label={`מסמך רלוונטי לסכום בסעיף ${line.code}`} value={entry.documentId} onChange={e=>updateEntry(entry.id,{documentId:e.target.value})}><option value="">בחירת מסמך מהתיק</option>{state.docs.map(document=><option value={document.id} key={document.id}>{document.title} · {document.status === 'missing' ? 'חסר' : document.status === 'reviewed' ? 'מאושר' : 'התקבל'}</option>)}</select><button className="cp-text-btn" disabled={!entry.documentId} onClick={()=>entry.documentId&&onOpenDocument(entry.documentId)}>{linkedDocument?.status === 'reviewed' ? <Check size={14}/> : <FileText size={14}/>} {linkedDocument?.status === 'missing' ? 'צירוף' : 'פתיחה'}</button></div></label>
                  <button className="cp-icon-button" aria-label={`מחיקת פריט מסעיף ${line.code}`} onClick={()=>deleteEntry(entry.id)}><Trash2 size={15}/></button>
                </div>
                <details className="cp-entry-more"><summary>פרטים נוספים לטופס</summary><div>
                  <label><span>בעלות</span><select aria-label={`בעלות סעיף ${line.code}`} value={entry.owner} onChange={e=>updateEntry(entry.id,{owner:e.target.value as Form1219Owner})}>{owners.map(owner=><option value={owner.value} key={owner.value}>{owner.label}</option>)}</select></label>
                  <label><span>תאריך רכישה</span><input aria-label={`תאריך רכישה סעיף ${line.code}`} type="date" value={entry.acquiredAt} onChange={e=>updateEntry(entry.id,{acquiredAt:e.target.value})}/></label>
                  <label><span>מטבע</span><select aria-label={`מטבע סעיף ${line.code}`} value={entry.currency} onChange={e=>updateEntry(entry.id,{currency:e.target.value})}><option>ILS</option><option>USD</option><option>EUR</option><option>GBP</option><option>אחר</option></select></label>
                  <label><span>סכום במטבע המקור</span><input aria-label={`סכום מטבע מקור סעיף ${line.code}`} type="number" value={entry.foreignAmount} onChange={e=>updateEntry(entry.id,{foreignAmount:Number(e.target.value)||0})}/></label>
                </div></details>
              </div>
            })}</div>}
            <button className="cp-text-btn cp-add-line" onClick={()=>addEntry(line.code,line.label)}><Plus size={15}/>הוספת פריט נפרד לסעיף {line.code}</button>
          </div>
        </details>
      })}</div>
      {part.id === 'A' && <div className="cp-part-totals"><Total code={200} value={totals[200]}/><Total code={210} value={totals[210]}/><Total code={220} value={totals[220]} strong/></div>}
      {part.id === 'B' && <div className="cp-part-totals"><Total code={340} value={totals[340]}/><Total code={390} value={totals[390]}/><Total code={440} value={totals[440]}/><Total code={460} value={totals[460]} strong/></div>}
      {part.id === 'C' && <><div className="cp-share-row"><label className="cp-label">אחוז הבעלות בעסק ללא מאזן<input type="number" min="0" max="100" value={state.form1219SharePercent} onChange={e=>onChange(s=>({...s,form1219SharePercent:Math.min(100,Math.max(0,Number(e.target.value)||0))}))}/></label><small>האחוז מוחל על ההון המחושב בקוד 740 לצורך קוד 750.</small></div><div className="cp-part-totals"><Total code={670} value={totals[670]}/><Total code={730} value={totals[730]}/><Total code={740} value={totals[740]}/><Total code={750} value={totals[750]}/><Total code={770} value={totals[770]} strong/></div></>}
    </section>)}

    <section className="cp-panel cp-details"><div className="cp-panel-head"><div><h2>חלק ד׳ — פרטים והצהרות נוספות</h2><p>כספות, ייפויי כוח, רכוש המוחזק עבור אחרים והצהרה קודמת</p></div><span className="cp-badge">חלק מהטופס הרשמי</span></div><div className="cp-disclosures">
      <Disclosure label="קיימת כספת בארץ או בחו״ל" checked={state.form1219Disclosures.safeDepositBoxes} details={state.form1219Disclosures.safeDepositDetails} onChecked={checked=>onChange(s=>({...s,form1219Disclosures:{...s.form1219Disclosures,safeDepositBoxes:checked}}))} onDetails={details=>onChange(s=>({...s,form1219Disclosures:{...s.form1219Disclosures,safeDepositDetails:details}}))}/>
      <Disclosure label="קיימים ייפויי כוח או זכות חתימה" checked={state.form1219Disclosures.powersOfAttorney} details={state.form1219Disclosures.powersOfAttorneyDetails} onChecked={checked=>onChange(s=>({...s,form1219Disclosures:{...s.form1219Disclosures,powersOfAttorney:checked}}))} onDetails={details=>onChange(s=>({...s,form1219Disclosures:{...s.form1219Disclosures,powersOfAttorneyDetails:details}}))}/>
      <Disclosure label="מוחזק רכוש עבור אדם אחר" checked={state.form1219Disclosures.propertyForOthers} details={state.form1219Disclosures.propertyForOthersDetails} onChecked={checked=>onChange(s=>({...s,form1219Disclosures:{...s.form1219Disclosures,propertyForOthers:checked}}))} onDetails={details=>onChange(s=>({...s,form1219Disclosures:{...s.form1219Disclosures,propertyForOthersDetails:details}}))}/>
      <div className="cp-disclosure"><label><input type="checkbox" checked={state.form1219Disclosures.previousDeclarationFiled} onChange={e=>onChange(s=>({...s,form1219Disclosures:{...s.form1219Disclosures,previousDeclarationFiled:e.target.checked}}))}/><strong>הוגשה הצהרת הון קודמת</strong></label>{state.form1219Disclosures.previousDeclarationFiled&&<input aria-label="תאריך הצהרה קודמת בחלק ד" type="date" value={state.form1219Disclosures.previousDeclarationDate} onChange={e=>onChange(s=>({...s,form1219Disclosures:{...s.form1219Disclosures,previousDeclarationDate:e.target.value}}))}/>}</div>
    </div></section>

    <div className="cp-stats cp-official-summary"><div className="cp-stat"><div className="cp-stat-label"><span>רכוש פרטי נטו · קוד 220</span><span className="cp-stat-icon"><Landmark/></span></div><strong className="cp-stat-value">{currency(totals[220])}</strong><small>קוד 200 פחות קוד 210</small></div><div className="cp-stat"><div className="cp-stat-label"><span>עסקים · קודים 460 + 770</span><span className="cp-stat-icon"><Wallet/></span></div><strong className="cp-stat-value">{currency(totals[460]+totals[770])}</strong><small>עסקים עם מאזן וללא מאזן</small></div><div className="cp-stat cp-total-800"><div className="cp-stat-label"><span>סך הון נקי · קוד 800</span><span className="cp-stat-icon"><Check/></span></div><strong className="cp-stat-value">{currency(totals[800])}</strong><small>מחושב אוטומטית לפי נוסחאות הטופס</small></div></div>
  </>
}

function Total({ code, value, strong = false }: { code: keyof ReturnType<typeof calculateForm1219>; value: number; strong?: boolean }) {
  return <div className={strong ? 'strong' : ''}><span>{totalLabels[code]} · קוד {code}</span><b>{currency(value)}</b></div>
}

function Disclosure({ label, checked, details, onChecked, onDetails }: { label: string; checked: boolean; details: string; onChecked: (value: boolean) => void; onDetails: (value: string) => void }) {
  return <div className="cp-disclosure"><label><input type="checkbox" checked={checked} onChange={e=>onChecked(e.target.checked)}/><strong>{label}</strong></label>{checked&&<textarea rows={2} value={details} placeholder="פירוט מלא לצורך הטופס והנספח…" onChange={e=>onDetails(e.target.value)}/>}</div>
}
