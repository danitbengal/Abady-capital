import { useState, type FormEvent } from 'react'
import { requireCapitalSupabase } from '../lib/supabase'
import { CaseTaxApiPanel } from './CaseTaxApiPanel'

type CaseRow = { id: string; declaration_date: string; filing_due_date: string | null; status: string }
export type ClientRow = { id: string; display_name: string; tax_identifier: string; capital_cases?: CaseRow[] }
type DocumentRow = { id: string; original_name: string; storage_path: string; status: string; internal_note: string }

export function SecureWorkspace({ clients, officeId, role, userId, onRefresh }: {
  clients: ClientRow[]; officeId: string; role: string; userId: string; onRefresh: () => Promise<void>
}) {
  const [selected, setSelected] = useState<ClientRow | null>(null)
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [date, setDate] = useState('')
  const [due, setDue] = useState('')
  const canCreate = ['administrator', 'accountant', 'office_staff'].includes(role)
  const canUpload = canCreate || role === 'bookkeeper'

  async function openClient(client: ClientRow) {
    setSelected(client); setSelectedCase(null); setDocuments([]); setMessage(''); setShowNew(false)
  }
  async function openCase(capitalCase: CaseRow) {
    setSelectedCase(capitalCase); setDocuments([]); setBusy(true); setMessage('')
    const { data, error } = await requireCapitalSupabase().from('documents').select('id, original_name, storage_path, status, internal_note').eq('case_id', capitalCase.id).order('created_at', { ascending: false })
    if (error) setMessage('טעינת המסמכים נכשלה. נסי שוב.')
    else setDocuments(data ?? [])
    setBusy(false)
  }
  async function createClient(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await requireCapitalSupabase().from('clients').insert({ office_id: officeId, display_name: name.trim(), tax_identifier: identifier.trim(), assigned_to: userId })
    if (error) setMessage('לא ניתן לשמור את הלקוח. בדקי מספר תיק כפול והרשאות.')
    else { setShowNew(false); setName(''); setIdentifier(''); await onRefresh() }
    setBusy(false)
  }
  async function createCase(event: FormEvent) {
    event.preventDefault(); if (!selected) return
    setBusy(true); setMessage('')
    const { data, error } = await requireCapitalSupabase().from('capital_cases').insert({ client_id: selected.id, declaration_date: date, filing_due_date: due || null }).select('id, declaration_date, filing_due_date, status').single()
    if (error) setMessage('שמירת תיק ההון נכשלה. בדקי תאריכים והרשאות.')
    else if (data) { setSelected({ ...selected, capital_cases: [...selected.capital_cases ?? [], data] }); setDate(''); setDue(''); await openCase(data) }
    setBusy(false)
  }
  async function upload(file: File | undefined) {
    if (!file || !selectedCase) return
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']
    if (!allowed.includes(file.type) || !file.size || file.size > 20 * 1024 * 1024) { setMessage('אפשר לצרף PDF, תמונה, Excel או CSV עד 20MB.'); return }
    const currentCase = selectedCase
    const db = requireCapitalSupabase()
    const path = `${officeId}/${currentCase.id}/${crypto.randomUUID()}`
    setBusy(true); setMessage('')
    const uploaded = await db.storage.from('capital-documents').upload(path, file, { contentType: file.type, upsert: false })
    if (uploaded.error) { setMessage('העלאת הקובץ נכשלה. בדקי חיבור והרשאות.'); setBusy(false); return }
    const saved = await db.from('documents').insert({ case_id: currentCase.id, storage_path: path, original_name: file.name, mime_type: file.type, byte_size: file.size, source: 'office' })
    if (saved.error) {
      // Remove the unregistered object; report failed cleanup instead of pretending it succeeded.
      const cleanup = await db.storage.from('capital-documents').remove([path])
      setMessage(cleanup.error ? 'הרישום נכשל. קובץ לא רשום נשאר באחסון; נדרשת בדיקת מנהל.' : 'רישום המסמך נכשל; הקובץ הוסר מהאחסון.')
    } else { await openCase(currentCase); setMessage('המסמך נשמר באחסון פרטי וממתין לבדיקה.') }
    setBusy(false)
  }
  async function download(document: DocumentRow) {
    const db = requireCapitalSupabase()
    setMessage('')
    const { data, error } = await db.storage.from('capital-documents').createSignedUrl(document.storage_path, 60)
    if (error || !data) { setMessage('לא ניתן להוריד את המסמך.'); return }
    const audit = await db.from('audit_events').insert({ office_id: officeId, case_id: selectedCase?.id, action: 'document.download', entity_type: 'document', entity_id: document.id })
    if (audit.error) { setMessage('לא ניתן לתעד את ההורדה. נסי שוב.'); return }
    const anchor = window.document.createElement('a'); anchor.href = data.signedUrl; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.click()
  }

  return <>
    <div className="prod-title"><div><small>הקמה ובדיקות · נתוני ניסיון בלבד</small><h1>{selected ? selected.display_name : 'לקוחות ותיקי הון'}</h1><p>{selected ? 'התיק נפתח רק לאחר בחירת לקוח.' : 'בחרי לקוח מהרשימה המורשית לך.'}</p></div>{selected ? <button onClick={() => { setSelected(null); setSelectedCase(null); setDocuments([]); void onRefresh() }}>כל הלקוחות</button> : canCreate && <button onClick={() => setShowNew(!showNew)}>פתיחת לקוח חדש</button>}</div>
    {message && <div role="status" className="prod-error">{message}</div>}
    {showNew && <form className="prod-panel prod-form" onSubmit={createClient}><h2>לקוח חדש</h2><label>שם הלקוח<input value={name} onChange={event => setName(event.target.value)} required minLength={2}/></label><label>מספר זהות / תיק<input value={identifier} onChange={event => setIdentifier(event.target.value)}/></label><button disabled={busy}>שמירת לקוח</button></form>}
    {!selected && <section className="prod-panel"><h2>הלקוחות שלי</h2><div className="prod-clients">{clients.map(client => <article key={client.id}><div><strong>{client.display_name}</strong><small>{client.tax_identifier || 'מספר תיק טרם הוזן'}</small></div><span>{client.capital_cases?.length ?? 0} תיקי הון</span><button onClick={() => void openClient(client)}>פתיחת כרטיס לקוח</button></article>)}</div>{!clients.length && <p className="prod-empty">אין עדיין לקוחות מורשים. אפשר לפתוח לקוח ניסיון ראשון.</p>}</section>}
    {selected && <section className="prod-panel"><h2>תיקי הצהרת הון</h2><div className="prod-clients">{selected.capital_cases?.map(capitalCase => <article key={capitalCase.id}><div><strong>הצהרה ליום {capitalCase.declaration_date}</strong><small>מועד הגשה: {capitalCase.filing_due_date ?? 'טרם נקבע'}</small></div><span>{capitalCase.status}</span><button disabled={busy} onClick={() => void openCase(capitalCase)}>פתיחת תיק</button></article>)}</div>{canCreate && <form className="prod-form" onSubmit={createCase}><h3>פתיחת תיק הון חדש</h3><label>תאריך הצהרת הון<input type="date" value={date} onChange={event => setDate(event.target.value)} required/></label><label>תאריך הגשה<input type="date" value={due} onChange={event => setDue(event.target.value)}/></label><button disabled={busy}>שמירת תיק</button></form>}</section>}
    {selectedCase && <section className="prod-panel prod-document-panel"><h2>מסמכים בתיק · {selectedCase.declaration_date}</h2>{canUpload && <label className="prod-upload">צירוף מסמך<input type="file" accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.csv" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }}/></label>}<div className="prod-clients">{documents.map(document => <article key={document.id}><div><strong>{document.original_name}</strong><small>ממתין לבדיקת משרד · {document.status}</small></div><span>אחסון פרטי</span><button onClick={() => void download(document)}>פתיחת מסמך</button></article>)}</div>{!documents.length && <p>אין עדיין מסמכים בתיק.</p>}</section>}
    {selectedCase && selected && ['administrator','accountant'].includes(role) && <CaseTaxApiPanel key={selectedCase.id} caseId={selectedCase.id} taxIdentifier={selected.tax_identifier} date={selectedCase.declaration_date}/>}
  </>
}
