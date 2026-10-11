import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowUpLeft, Check, CheckCheck, ChevronLeft, CircleHelp, ClipboardList, Clock3, Download, FileCheck2, FileSignature, FileText, FolderOpen, Landmark, LayoutDashboard, Mail, MessageCircle, Plus, ScanLine, Search, ShieldCheck, Sparkles, Trash2, Upload, Users, Wallet, X } from 'lucide-react'
import { approvedDraft, compare, currency, findings, loadState, makeDraft, sections, seedState, simulateSend, statusLabels, STORAGE_KEY, totals, type CapitalDocument, type CapitalState } from './model'
import { AnnualWorksheet } from './AnnualWorksheet'
import { OfficeDashboard } from './OfficeDashboard'
import { OfficialDeclaration1219 } from './OfficialDeclaration1219'
import { worksheetText } from './worksheet'
import { canAccessClient, type OfficeUser } from './access'
import { inferForm1219Entry } from './documentRouting'
import { approveAllDocumentProposals, approveDocumentProposal, setDocumentAmount, setDocumentDestination } from './documentApproval'
import { DocumentAgentQueue } from './DocumentAgentQueue'
import './capital.css'
import './client-access.css'
import './client-select.css'
import './document-routing.css'

type Tab = 'clients' | 'clientSelect' | 'personal' | 'overview' | 'documents' | 'declaration' | 'comparison' | 'agent' | 'signature' | 'portal'
const nav: { id: Tab; label: string; icon: ReactNode; sub: string }[] = [
  { id: 'clients', label: 'כל תיקי ההון', icon: <Users />, sub: 'לקוחות, סטטוסים וקצב התקדמות' },
  { id: 'clientSelect', label: 'בחירת לקוח', icon: <Search />, sub: 'חיפוש ופתיחת כרטיס לקוח מורשה' },
  { id: 'personal', label: 'כרטיס לקוח', icon: <Users />, sub: 'פרטים אישיים, משפחה ופרטי קשר' },
  { id: 'overview', label: 'תמונת מצב', icon: <LayoutDashboard />, sub: 'כל התיק, במקום אחד' },
  { id: 'documents', label: 'מסמכים וקריאה', icon: <FolderOpen />, sub: 'איסוף, חילוץ ובקרה' },
  { id: 'declaration', label: 'הצהרת הון', icon: <Landmark />, sub: 'נכסים והתחייבויות' },
  { id: 'comparison', label: 'השוואת הון', icon: <Wallet />, sub: 'מקורות מול שימושים' },
  { id: 'agent', label: 'סוכן הבדיקה', icon: <Sparkles />, sub: 'ממצאים וטיוטות ללקוח' },
  { id: 'signature', label: 'חבילת חתימה', icon: <FileSignature />, sub: 'הצהרה, נספחים ואישור הלקוח' },
  { id: 'portal', label: 'פורטל הלקוח', icon: <Users />, sub: 'כך זה נראה מהצד שלו' },
]
const currentUser: OfficeUser = { name: 'דנית בן גל', role: 'administrator' }
const demoClientProfiles = [
  { id: 'c2', client: 'רונית ויואב כהן', identifier: 'תיק 10195', phone: '052-555-0195', email: 'cohen@example.com', manager: 'מיכל אברהם', status: 'ממתין ללקוח' },
  { id: 'c3', client: 'חברת אורן ובעלי מניות', identifier: 'תיק 10903', phone: '03-555-0903', email: 'oren@example.com', manager: 'דנית בן גל', status: 'קריאה ובדיקה' },
  { id: 'c4', client: 'משפחת מזרחי', identifier: 'תיק 9877', phone: '050-555-9877', email: 'mizrahi@example.com', manager: 'אורית לוי', status: 'בקרת המשרד' },
  { id: 'c5', client: 'אלון שחר', identifier: 'תיק 10641', phone: '054-555-0641', email: 'alon@example.com', manager: 'הדס רון', status: 'הושלם' },
  { id: 'c6', client: 'נועה וגיל פרץ', identifier: 'תיק 11012', phone: '052-555-1012', email: 'peretz@example.com', manager: 'מיכל אברהם', status: 'איסוף מסמכים' },
]
const amount = (raw: string) => Math.max(0, Number(raw) || 0)
const workTime = (seconds: number) => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
function MoneyInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) { return <input className="cp-money" type="number" min="0" step="1" aria-label={label} value={value} onChange={e => onChange(amount(e.target.value))} /> }
function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`cp-badge cp-${tone}`}>{children}</span> }

export function CapitalPrototype() {
  const [state, setState] = useState<CapitalState>(loadState)
  const [tab, setTab] = useState<Tab>('clients')
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [search, setSearch] = useState('')
  const [clientLookup, setClientLookup] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [pendingTab, setPendingTab] = useState<Tab>('personal')
  const [selected, setSelected] = useState('bankdoc')
  const [filter, setFilter] = useState('all')
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)
  const [uploadWorksheetRowId, setUploadWorksheetRowId] = useState<string | null>(null)
  const [uploadSource, setUploadSource] = useState<'office' | 'client'>('office')
  const [agentRun, setAgentRun] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const signatureInput = useRef<HTMLInputElement>(null)
  const c = compare(state)
  const declarationTotals = totals(state.lines)
  const issues = findings(state)
  const complete = state.docs.filter(d => d.status === 'reviewed').length
  const received = state.docs.filter(d => d.status !== 'missing').length
  const missing = state.docs.filter(d => d.status === 'missing')
  const doc = state.docs.find(d => d.id === selected)
  const title = nav.find(n => n.id === tab)!
  const clientDirectory = [{ id: 'active', client: state.client, identifier: 'תיק 10482', phone: state.personal.phone, email: state.email, manager: currentUser.name, status: 'תיק פעיל לעריכה' }, ...demoClientProfiles].filter(profile => canAccessClient(currentUser, profile))
  const visibleClientProfiles = clientDirectory.filter(profile => `${profile.client} ${profile.identifier} ${profile.phone} ${profile.email}`.toLowerCase().includes(clientLookup.trim().toLowerCase()))
  const viewedProfile = clientDirectory.find(profile => profile.id === selectedProfile) ?? clientDirectory[0]
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setStorageError(false) } catch { setStorageError(true) } }, [state])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer) }, [notice])
  useEffect(() => {
    if (tab === 'clients' || tab === 'clientSelect') return
    let lastTick = Date.now()
    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') {
        const elapsed = Math.min(5, Math.floor((now - lastTick) / 1000))
        if (elapsed > 0) setState(s => ({ ...s, workSeconds: s.workSeconds + elapsed }))
      }
      lastTick = now
    }
    const resetTick = () => { lastTick = Date.now() }
    const timer = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', resetTick)
    return () => { tick(); window.clearInterval(timer); document.removeEventListener('visibilitychange', resetTick) }
  }, [tab])
  function change(update: (s: CapitalState) => CapitalState, event?: string) {
    setState(s => {
      const next = update(s)
      if (next.worksheet?.capitalSource === 'declaration' && (next.currentDate !== s.currentDate || next.previousDate !== s.previousDate)) next.worksheet = { ...next.worksheet, previousDate: next.previousDate, currentDate: next.currentDate }
      const dataChanged = next.lines !== s.lines || next.form1219Entries !== s.form1219Entries || next.form1219SharePercent !== s.form1219SharePercent || next.form1219Disclosures !== s.form1219Disclosures || next.docs !== s.docs || next.flows !== s.flows || next.worksheet !== s.worksheet || next.currentDate !== s.currentDate || next.previousDate !== s.previousDate || next.filingDate !== s.filingDate || next.personal !== s.personal || next.children !== s.children || next.officeNotes !== s.officeNotes || next.annexes !== s.annexes
      const draft = dataChanged && next.draft ? { ...next.draft, state: 'draft' as const, approvedAt: undefined } : next.draft
      const signature = dataChanged && next.signature.state !== 'draft' ? { ...next.signature, state: 'draft' as const, approvedAt: undefined } : next.signature
      return { ...next, draft, signature, log: event ? [`${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} • ${event}`, ...s.log].slice(0, 40) : next.log }
    })
    setAgentRun(false)
  }
  function openClientProfile(profileId: string) {
    setSelectedProfile(profileId)
    setClientLookup('')
    setTab(profileId === 'active' ? pendingTab : 'personal')
  }
  function openTab(target: Tab) {
    if (target === 'clients') {
      setSelectedProfile(null)
      setClientLookup('')
      setTab('clients')
      return
    }
    if (target === 'clientSelect') {
      setPendingTab('personal')
      setSelectedProfile(null)
      setClientLookup('')
      setTab('clientSelect')
      return
    }
    if (!selectedProfile) {
      setPendingTab(target)
      setClientLookup('')
      setTab('clientSelect')
      return
    }
    if (selectedProfile !== 'active' && target !== 'personal') {
      setPendingTab(target)
      setSelectedProfile(null)
      setClientLookup('')
      setTab('clientSelect')
      return
    }
    setTab(target)
  }
  function chooseClientFor(target: Tab) {
    setPendingTab(target)
    setSelectedProfile(null)
    setClientLookup('')
    setTab('clientSelect')
  }
  function upload(id: string | null, source: 'office' | 'client', worksheetRowId: string | null = null) { setUploadTarget(id); setUploadWorksheetRowId(worksheetRowId); setUploadSource(source); fileInput.current?.click() }
  function receive(files: FileList | null) {
    if (!files?.length) return
    const allowed = Array.from(files).filter(f => /\.(pdf|png|jpe?g|xlsx?|csv)$/i.test(f.name) && f.size <= 20 * 1024 * 1024)
    if (!allowed.length) { setNotice('אפשר לצרף PDF, תמונה, Excel או CSV עד 20MB לקובץ.'); return }
    change(s => {
      const docs = [...s.docs]
      allowed.forEach((f, i) => {
        const target = i === 0 && uploadTarget ? docs.findIndex(d => d.id === uploadTarget) : -1
        if (target >= 0) {
          const expectedEntry = docs[target].form1219EntryId ?? s.form1219Entries.find(entry => entry.documentId === docs[target].id)?.id
          docs[target] = { ...docs[target], fileName: f.name, source: uploadSource, status: 'uploaded', form1219EntryId: expectedEntry, routingState: uploadSource === 'client' ? 'suggested' : 'confirmed', routingNote: uploadSource === 'client' ? 'המסמך הגיע מדרישה המקושרת לשורה; הסוכן סימן את שם הקובץ והמיקום לבדיקה.' : 'צורף ואושר במשרד.', sample: false, confidence: undefined, extracted: undefined }
        } else {
          const suggestedEntry = inferForm1219Entry(f.name, s.form1219Entries)
          docs.push({ id: `upload-${Date.now()}-${i}`, title: f.name, fileName: f.name, category: uploadWorksheetRowId ? 'אסמכתה למקורות ושימושים' : suggestedEntry ? `שיוך אוטומטי · קוד ${suggestedEntry.code}` : 'לסיווג המשרד', source: uploadSource, status: 'uploaded', worksheetRowId: uploadWorksheetRowId ?? undefined, form1219EntryId: uploadWorksheetRowId ? undefined : suggestedEntry?.id, routingState: uploadWorksheetRowId ? 'confirmed' : suggestedEntry ? 'suggested' : 'unassigned', routingNote: uploadWorksheetRowId ? 'המסמך צורף ישירות לשורה שנבחרה במקורות ובשימושים.' : suggestedEntry ? `הסוכן הציע את השורה לפי שם הקובץ: ${f.name}` : 'הסוכן לא זיהה שורת יעד לפי שם הקובץ.', sample: false })
        }
      })
      return { ...s, docs }
    }, `נרשמו ${allowed.length} קבצים מ${uploadSource === 'client' ? 'פורטל הלקוח' : 'המשרד'} בדגם`)
    setNotice(uploadWorksheetRowId ? 'המסמך צורף לשורה במקורות ובשימושים. בדגם נשמר שם הקובץ בלבד.' : 'המסמכים נותבו לשורות לפי הדרישה או שם הקובץ. יש לבדוק את השיוך במסך המסמכים; תוכן הקבצים אינו נשמר בדגם.')
    setUploadWorksheetRowId(null)
    if (fileInput.current) fileInput.current.value = ''
  }
  function receiveSignatureFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (!/\.pdf$/i.test(file.name)) { setNotice('יש לבחור קובץ PDF של אישור הלקוח.'); return }
    change(s => ({ ...s, signature: { acknowledgementFileName: file.name, state: 'draft' } }), 'צורף אישור נכונות הפרטים לחבילת החתימה')
    setNotice('שם קובץ האישור נרשם בדגם. תוכן הקובץ לא נשמר ולא הועלה לשרת.')
    if (signatureInput.current) signatureInput.current.value = ''
  }
  function resizeChildren(count: number) {
    const safeCount = Math.min(20, Math.max(0, count))
    change(s => ({ ...s, children: Array.from({ length: safeCount }, (_, index) => s.children[index] ?? { id: `child-${Date.now()}-${index}`, name: '', identityNumber: '', birthDate: '' }) }), 'עודכן מספר הילדים בתיק')
  }
  function extract(target: CapitalDocument) {
    if (!target.sample || target.extracted === undefined) { setNotice('קריאת קבצים אמיתיים אינה מחוברת בדגם. אפשר לבדוק חילוץ במסמכי הדוגמה.'); return }
    change(s => ({ ...s, docs: s.docs.map(d => d.id === target.id ? { ...d, status: 'extracted' } : d) }), `הודגם חילוץ נתונים: ${target.title}`)
    setSelected(target.id)
    setNotice('הודגם חילוץ. הסכום לא ישויך להצהרה עד לאישור המשרד.')
  }
  function approveDoc(target: CapitalDocument) {
    if (target.status === 'missing' || target.status === 'uploaded') return
    change(s => ({ ...s, docs: s.docs.map(d => d.id === target.id ? { ...d, status: 'reviewed', routingState: d.form1219EntryId ? 'confirmed' : d.routingState } : d), lines: s.lines.map(l => l.id === target.targetId && target.extracted !== undefined ? { ...l, current: target.extracted } : l), form1219Entries: s.form1219Entries.map(entry => (entry.id === target.form1219EntryId || entry.documentId === target.id) && target.extracted !== undefined ? { ...entry, amount: target.extracted } : entry) }), `אושר מסמך ושיוך: ${target.title}`)
    setNotice('הסכום אושר ושויך לשורת ההצהרה. ההשוואה עודכנה.')
  }
  function confirmDocumentRoute(documentId: string) {
    change(s => ({ ...s, docs: s.docs.map(d => d.id === documentId ? { ...d, routingState: d.form1219EntryId || d.worksheetRowId ? 'confirmed' : 'unassigned', routingNote: d.form1219EntryId || d.worksheetRowId ? 'המשרד בדק ואישר את שם המסמך ואת מיקומו.' : d.routingNote } : d) }), 'המשרד אישר את מיקום המסמך')
    setNotice('שם המסמך והמיקום שלו נבדקו ואושרו.')
  }
  function moveDocument(documentId: string, entryId: string) {
    const targetEntry = state.form1219Entries.find(entry => entry.id === entryId)
    change(s => ({ ...s, docs: s.docs.map(d => d.id === documentId ? { ...d, form1219EntryId: entryId || undefined, worksheetRowId: undefined, targetId: undefined, routingState: entryId ? 'confirmed' : 'unassigned', category: targetEntry ? `טופס 1219 · קוד ${targetEntry.code}` : 'לסיווג המשרד', routingNote: targetEntry ? `המשרד העביר אוטומטית לשורה: קוד ${targetEntry.code} · ${targetEntry.description}` : 'המסמך הוסר מהשורה וממתין לסיווג.' } : d) }), targetEntry ? `המסמך הועבר לשורה ${targetEntry.code} — ${targetEntry.description}` : 'המסמך הוסר מהשורה')
    setNotice(targetEntry ? `המסמך עבר אוטומטית לקוד ${targetEntry.code} — ${targetEntry.description}.` : 'המסמך ממתין כעת לסיווג מחדש.')
  }
  function approveAgentProposal(documentId: string) {
    const target = state.docs.find(document => document.id === documentId)
    if (!target) return
    change(s => approveDocumentProposal(s, documentId), `אושר סיווג המסמך והסכום: ${target.fileName ?? target.title}`)
    setNotice('המסמך והסכום הועברו ליעד שאושר.')
  }
  function approveAllAgentProposals() {
    const result = approveAllDocumentProposals(state)
    change(() => result.state, `אושרו ${result.approved} הצעות סיווג מסמכים יחד`)
    setNotice(result.skipped ? `${result.approved} מסמכים אושרו והועברו. ${result.skipped} מסמכים נשארו לבדיקה כי אין להם יעד.` : `${result.approved} מסמכים אושרו והועברו להצהרת ההון או להשוואת ההון.`)
  }
  function exportFile(kind: 'json' | 'report') {
    const report = `דגם בלבד — לא להגשה\nהצהרת הון: ${state.client}\n${state.previousDate} — ${state.currentDate}\nתאריך הגשה: ${state.filingDate}\n\n${state.lines.map(l => `${sections[l.section]} | ${l.label} | קודם: ${l.previous} | נוכחי: ${l.current} | ${l.note}`).join('\n')}\n\nהון קודם: ${c.previousNet}\nהון נוכחי: ${c.currentNet}\nגידול הון: ${c.growth}\nמקורות: ${c.sources}\nשימושים: ${c.uses}\nפער: ${c.gap}\n\nממצאים:\n${issues.map(i => `${i.title}: ${i.detail}`).join('\n')}\n\nהסכומים דורשים בדיקה מקצועית; טופס 1219 הרשמי לא אומת. אין בדגם הגשה לרשות המסים.`
    const fullReport = state.worksheet ? worksheetText(state.worksheet, declarationTotals) + '\nממצאים:\n' + issues.map(i => `${i.title}: ${i.detail}`).join('\n') : report
    const blob = new Blob([kind === 'json' ? JSON.stringify(state, null, 2) : '\ufeff' + fullReport], { type: kind === 'json' ? 'application/json' : 'text/plain;charset=utf-8' })
    const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = kind === 'json' ? 'capital-demo-backup.json' : 'capital-working-paper.txt'; a.click(); URL.revokeObjectURL(href)
    setNotice(kind === 'json' ? 'הורד גיבוי של נתוני הדגם, ללא תוכן מסמכים.' : 'הורד נייר עבודה עם הסכומים והממצאים. לא טופס להגשה.')
  }
  function downloadSignatureManifest() {
    const selectedAnnexes = state.annexes.filter(a => a.selected)
    const text = `חבילת חתימה — דגם בלבד\nלקוח: ${state.client}\nתעודת זהות: ${state.personal.clientId}\nתאריך הצהרת הון: ${state.currentDate}\nתאריך הגשה: ${state.filingDate}\n\nמסמכים בחבילה:\n1. הצהרת הון והנספחים שנבחרו\n2. אישור נכונות הפרטים: ${state.signature.acknowledgementFileName || 'טרם צורף'}\n\nנספחים שסומנו:\n${selectedAnnexes.map(a => `• ${a.label} — ${a.included ? 'נכלל' : 'עדיין חסר'}`).join('\n')}\n\nילדים: ${state.children.length}\n${state.children.map(c => `• ${c.name || 'ללא שם'} | ${c.identityNumber || 'ללא ת״ז'} | ${c.birthDate || 'ללא תאריך לידה'}`).join('\n')}\n\nהערות בסוף הקובץ:\n${state.officeNotes || 'אין הערות'}\n\nאין זה קובץ חתימה ממשי. יש לבדוק את כל המסמכים לפני שליחה.`
    const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' }), href = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = href; a.download = 'signature-package-manifest.txt'; a.click(); URL.revokeObjectURL(href)
    setNotice('הורד סיכום חבילת החתימה לבדיקה. לא נשלח דבר ללקוח.')
  }
  return <div className="cp-app" dir="rtl">
    <input ref={fileInput} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv" hidden onChange={e => receive(e.target.files)} />
    <input ref={signatureInput} type="file" accept=".pdf,application/pdf" hidden onChange={e => receiveSignatureFile(e.target.files)} />
    <aside className="cp-sidebar">
      <a className="cp-brand" href="/"><span className="cp-brandmark"><Landmark /></span><div><strong>הון<span className="cp-brand-dot">.</span></strong><small>עבדי בן גל · רואי חשבון</small></div></a>
      <div className="cp-workspace"><span className="cp-office-avatar">אב</span><div><strong>מרחב העבודה של המשרד</strong><small>הצהרות הון והשוואות</small></div><ChevronLeft size={15} /></div>
      <p className="cp-nav-label">ניהול המשרד</p>
      <nav>{nav.map(n => <button key={n.id} className={`cp-nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => openTab(n.id)}>{n.icon}<span>{n.label}</span>{n.id === 'agent' && <span className="cp-nav-dot" />}{n.id === 'documents' && <em>{missing.length}</em>}</button>)}</nav>
      <div className="cp-sidebar-bottom"><div className="cp-demo-card"><ShieldCheck size={20} /><strong>סביבת הדגמה</strong><p>נתונים לדוגמה. אין שליחת הודעות ואין הגשה לרשות המסים.</p></div><a href="/" className="cp-back"><ArrowLeft size={15} />מרחב הצהרות ההון</a><div className="cp-user"><span>דב</span><div><strong>דנית בן גל</strong><small>תפקיד לדוגמה · מנהלת המשרד</small></div></div></div>
    </aside>
    <div className="cp-workarea">
      <header className="cp-topbar"><div>הצהרות הון <ChevronLeft size={14} /><strong>{tab === 'clients' ? 'מרכז שליטה למשרד' : `תיק · ${state.client}`}</strong></div><div className="cp-top-actions"><span className="cp-save-dot" /><small>{storageError ? 'השמירה המקומית נכשלה — הורידו גיבוי' : 'הדגם נשמר בדפדפן זה'}</small><button aria-label="הסבר על הדגם" onClick={() => setNotice('זהו דגם אינטראקטיבי. OCR, קבלת מייל/וואטסאפ ושליחה הם הדמיה. אין חיבור לנתוני CRM או למסד Supabase.')}><CircleHelp size={19} /></button></div></header>
      <main className="cp-main">
        <div className="cp-page-heading"><div><div className="cp-eyebrow">CAPITAL WORKSPACE <span /> {title.sub}</div><h1>{title.label}</h1><p>{tab === 'clients' ? 'כל תיקי הצהרות ההון, קצב ההתקדמות והחריגים במקום אחד.' : tab === 'clientSelect' ? 'לא נבחר לקוח מראש. בחרי לקוח מורשה כדי להמשיך למסך המבוקש.' : 'מהמסמך הראשון ועד לתמונה המלאה של ההון.'}</p></div>{tab !== 'clients' && tab !== 'clientSelect' && <div className="cp-heading-actions"><button className="cp-btn cp-btn-white" onClick={() => chooseClientFor(tab)}><Users size={16}/>בחירת לקוח</button>{selectedProfile==='active'&&<><button className="cp-btn cp-btn-white" onClick={() => exportFile('report')}><Download size={16} />נייר עבודה</button><button className="cp-btn cp-btn-primary" onClick={() => { setTab('documents'); upload(null, 'office') }}><Plus size={17} />צירוף מסמכים</button></>}</div>}</div>
        {tab !== 'clients' && tab !== 'clientSelect' && selectedProfile && <div className="cp-case-bar"><button className="cp-return-clients" onClick={() => openTab('clients')}><Users size={15} />כל התיקים</button><button className="cp-return-clients" onClick={() => chooseClientFor(tab)}><Search size={15}/>בחירת לקוח</button><span className="cp-client-avatar">{viewedProfile.client.split(' ').map(word=>word[0]).slice(0,2).join('')}</span><button className="cp-case-title cp-case-title-button" onClick={()=>setTab('personal')}><strong>{viewedProfile.client}</strong><small>הלקוח שנבחר · לחצי לפתיחת הכרטיס</small></button><div className="cp-case-date"><small>הצהרה קודמת</small><strong>{state.previousDate.split('-').reverse().join('.')}</strong></div><ChevronLeft size={18} className="cp-date-arrow" /><div className="cp-case-date"><small>תאריך הצהרת הון</small><strong>{state.currentDate.split('-').reverse().join('.')}</strong></div><div className="cp-case-date cp-filing-date"><small>תאריך הגשה</small><strong>{state.filingDate.split('-').reverse().join('.')}</strong></div><div className="cp-case-date cp-work-counter"><small><Clock3 size={13}/>זמן עבודה · מודד כעת</small><strong>{workTime(state.workSeconds)}</strong></div><Badge tone="amber">בהכנה · נדרשת בדיקה</Badge></div>}

        {tab === 'clients' && <OfficeDashboard state={state} currentUser={currentUser} onOpen={(target='overview') => {setSelectedProfile('active');setTab(target)}} onNotice={setNotice} onUpdateDates={(currentDate,filingDate)=>change(s=>({...s,currentDate,filingDate}),'עודכנו תאריך הצהרת ההון ותאריך ההגשה מקליטת רשות המסים; יתר נתוני התיק נשמרו')} />}

        {tab === 'clientSelect' && <section className="cp-panel cp-client-picker cp-client-picker-page"><div className="cp-panel-head"><div><h2>חיפוש ובחירת לקוח</h2><p>לאחר הבחירה ייפתח כרטיס הלקוח במסך נפרד</p></div><Badge tone="mint">{currentUser.role==='administrator'?'כל לקוחות המשרד':'הלקוחות שלי בלבד'}</Badge></div><label className="cp-search"><Search size={17}/><input autoFocus aria-label="חיפוש ובחירת לקוח" placeholder="חיפוש לפי שם, מספר תיק, טלפון או מייל…" value={clientLookup} onChange={e=>setClientLookup(e.target.value)}/></label><div className="cp-client-results">{visibleClientProfiles.map(profile=><button className={selectedProfile===profile.id?'selected':''} key={profile.id} onClick={()=>openClientProfile(profile.id)}><span className="cp-client-avatar">{profile.client.split(' ').map(word=>word[0]).slice(0,2).join('')}</span><span><strong>{profile.client}</strong><small>{profile.identifier} · {profile.status}</small></span><span className="cp-open-client-label">פתיחת הכרטיס <ArrowLeft size={14}/></span></button>)}{!visibleClientProfiles.length&&<div className="cp-empty">לא נמצא לקוח מורשה לפי החיפוש.</div>}</div><div className="cp-permission-note"><ShieldCheck size={16}/><span>מנהל מערכת רואה את כל הלקוחות. עובד רואה לקוחות משויכים, ומנהלת חשבונות רואה רק תיקים שקיבלה אליהם הרשאה מפורשת.</span></div></section>}

        {state.worksheet?.capitalSource === 'imported-summary' && tab !== 'comparison' && <div className="cp-info"><FileText size={18}/><div><strong>השוואת ההון משתמשת בסיכומים ממסמך חיצוני.</strong><p>תאריכי ההשוואה: {state.worksheet.previousDate} — {state.worksheet.currentDate}. פירוט ההצהרה והמסמכים לדוגמה לא הוחלפו בסיכומי הצילום.</p></div></div>}

        {tab === 'personal' && <>
          <div className="cp-info"><Users size={19}/><div><strong>כרטיס הלקוח</strong><p>מסך נפרד לפרטים אישיים, פרטי קשר והרכב המשפחה. הנתונים משמשים את ההצהרה ואת חבילת החתימה, אך אינם נערכים בתוך מסך הצהרת ההון.</p></div></div>
          {selectedProfile === 'active' ? <>
          <section className="cp-panel cp-details"><div className="cp-panel-head"><div><h2>פרטי לקוח ופרטי קשר</h2><p>לחיצה על שם הלקוח ברשימת התיקים פותחת מסך זה</p></div><Badge>כרטיס לקוח</Badge></div><div className="cp-form-grid cp-personal-grid"><label className="cp-label">שם הלקוח / המשפחה<input value={state.client} onChange={e=>change(s=>({...s,client:e.target.value,draft:null}))}/></label><label className="cp-label">מספר זהות<input inputMode="numeric" value={state.personal.clientId} onChange={e=>change(s=>({...s,personal:{...s.personal,clientId:e.target.value}}))}/></label><label className="cp-label">תאריך לידה<input type="date" value={state.personal.birthDate} onChange={e=>change(s=>({...s,personal:{...s.personal,birthDate:e.target.value}}))}/></label><label className="cp-label">מצב משפחתי<select value={state.personal.maritalStatus} onChange={e=>change(s=>({...s,personal:{...s.personal,maritalStatus:e.target.value as CapitalState['personal']['maritalStatus']}}))}><option value="married">נשוי/אה</option><option value="single">רווק/ה</option><option value="divorced">גרוש/ה</option><option value="widowed">אלמן/ה</option><option value="separated">פרוד/ה</option></select></label><label className="cp-label">מייל הלקוח<input type="email" value={state.email} onChange={e=>change(s=>({...s,email:e.target.value,draft:null}))}/></label><label className="cp-label">טלפון<input type="tel" value={state.personal.phone} onChange={e=>change(s=>({...s,personal:{...s.personal,phone:e.target.value}}))}/></label><label className="cp-label cp-wide-label">כתובת מלאה<input value={state.personal.address} onChange={e=>change(s=>({...s,personal:{...s.personal,address:e.target.value}}))}/></label></div></section>
          <section className="cp-panel cp-details"><div className="cp-panel-head"><div><h2>בן או בת הזוג</h2><p>פרטים משפחתיים המשמשים להכנת ההצהרה</p></div></div><div className="cp-form-grid cp-personal-grid"><label className="cp-label">שם בן/בת הזוג<input value={state.personal.spouseName} onChange={e=>change(s=>({...s,personal:{...s.personal,spouseName:e.target.value}}))}/></label><label className="cp-label">ת״ז בן/בת הזוג<input inputMode="numeric" value={state.personal.spouseId} onChange={e=>change(s=>({...s,personal:{...s.personal,spouseId:e.target.value}}))}/></label><label className="cp-label">תאריך לידת בן/בת הזוג<input type="date" value={state.personal.spouseBirthDate} onChange={e=>change(s=>({...s,personal:{...s.personal,spouseBirthDate:e.target.value}}))}/></label></div></section>
          <section className="cp-panel cp-details">
            <div className="cp-panel-head"><div><h2>ילדים</h2><p>הפרטים נדרשים לבדיקת נכסים והתחייבויות של ילדים שטרם מלאו להם 18</p></div><label className="cp-child-count">מספר ילדים<input aria-label="מספר ילדים" type="number" min="0" max="20" value={state.children.length} onChange={e=>resizeChildren(Number(e.target.value))}/></label></div>
            <div className="cp-table-wrap"><table className="cp-table cp-children-table"><thead><tr><th>שם מלא</th><th>מספר זהות</th><th>תאריך לידה</th><th /></tr></thead><tbody>{state.children.map((child,index)=><tr key={child.id}><td><input aria-label={`שם ילד ${index+1}`} value={child.name} onChange={e=>change(s=>({...s,children:s.children.map(c=>c.id===child.id?{...c,name:e.target.value}:c)}))}/></td><td><input aria-label={`תעודת זהות ילד ${index+1}`} inputMode="numeric" value={child.identityNumber} onChange={e=>change(s=>({...s,children:s.children.map(c=>c.id===child.id?{...c,identityNumber:e.target.value}:c)}))}/></td><td><input aria-label={`תאריך לידה ילד ${index+1}`} type="date" value={child.birthDate} onChange={e=>change(s=>({...s,children:s.children.map(c=>c.id===child.id?{...c,birthDate:e.target.value}:c)}))}/></td><td><button className="cp-icon-close" aria-label={`מחיקת ילד ${index+1}`} onClick={()=>change(s=>({...s,children:s.children.filter(c=>c.id!==child.id)}),'נמחק ילד מרשימת הפרטים')}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
            <button className="cp-text-btn cp-add-line" onClick={()=>resizeChildren(state.children.length+1)}><Plus size={15}/>הוספת ילד</button>
          </section></> : <section className="cp-panel cp-details cp-readonly-client"><div className="cp-panel-head"><div><h2>{viewedProfile.client}</h2><p>{viewedProfile.identifier} · כרטיס מעקב מורשה</p></div><Badge tone="blue">קריאה בלבד בדגם</Badge></div><div className="cp-form-grid cp-personal-grid"><label className="cp-label">שם הלקוח<input value={viewedProfile.client} readOnly/></label><label className="cp-label">מספר תיק<input value={viewedProfile.identifier} readOnly/></label><label className="cp-label">טלפון<input value={viewedProfile.phone} readOnly/></label><label className="cp-label">מייל<input value={viewedProfile.email} readOnly/></label><label className="cp-label">עובד אחראי<input value={viewedProfile.manager} readOnly/></label><label className="cp-label">מצב התיק<input value={viewedProfile.status} readOnly/></label></div><p className="cp-footnote">זהו כרטיס מעקב לדוגמה. במערכת המלאה ייטענו רק נתוני התיק שנבחר ורק בהתאם להרשאות העובד.</p></section>}
        </>}

        {tab === 'overview' && <>
          <div className="cp-stats"><Stat label="הון נקי נוכחי" value={currency(c.currentNet)} note="נכסים בניכוי התחייבויות" icon={<Landmark />} /><Stat label="גידול בהון" value={currency(c.growth)} note="ביחס להצהרה הקודמת" icon={<ArrowUpLeft />} /><Stat label="מסמכים שהתקבלו" value={`${received} / ${state.docs.length}`} note={`${complete} נבדקו ואושרו על ידי המשרד`} icon={<FileCheck2 />} /><Stat label={c.gap >= 0 ? 'פער שטרם הוסבר' : 'עודף מקורות לבדיקה'} value={currency(Math.abs(c.gap))} note="חישוב ראשוני · לפני השלמת אסמכתאות" icon={<ScanLine />} alert={c.gap !== 0} /></div>
          <div className="cp-overview-grid"><section className="cp-panel cp-journey"><div className="cp-panel-head"><div><h2>הדרך להצהרה מוכנה</h2><p>כל שלב נשען על בדיקה ואישור של המשרד</p></div><Badge>תהליך עבודה</Badge></div><div className="cp-steps">{[{title:'פתיחת התיק',note:'פרטי המשפחה ומועדי ההצהרה',done:true,to:'declaration'},{title:'איסוף מסמכים',note:`${missing.length} מסמכים עדיין חסרים`,done:false,to:'documents'},{title:'קריאה ובדיקת נתונים',note:'חילוץ, התאמה ואישור לכל סעיף',done:false,to:'documents'},{title:'השוואת הון',note:'הסבר הגידול ומקורות המימון',done:false,to:'comparison'},{title:'בקרת המשרד',note:'נייר עבודה והשלמות ללקוח',done:false,to:'agent'},{title:'חתימה דיגיטלית',note:'הצהרה, נספחים ואישור נכונות הפרטים',done:false,to:'signature'}].map((s,i)=><button key={s.title} className={`cp-step ${s.done?'done':''}`} onClick={()=>setTab(s.to as Tab)}><span className="cp-step-number">{s.done?<Check size={17}/>:i+1}</span><div><strong>{s.title}</strong><small>{s.note}</small></div><ChevronLeft size={16}/></button>)}</div><div className="cp-progress-caption"><span>התקדמות בדיקת מסמכים</span><strong>{Math.round(complete/state.docs.length*100)}%</strong></div><div className="cp-progress"><span style={{width:`${complete/state.docs.length*100}%`}}/></div></section>
          <section className="cp-agent-card"><div className="cp-agent-orb"><Sparkles size={26}/></div><Badge tone="mint">סוכן בדיקה · דגם</Badge><h2>התמונה מתחילה להתבהר.</h2><p>הסוכן מרכז חוסרים, בודק את השוואת ההון ומכין טיוטת פנייה ללקוח — לעיונך ולאישורך.</p><div className="cp-agent-fact"><span>השלמות מסמכים</span><strong>{missing.length}</strong></div><div className="cp-agent-fact"><span>סעיפים ללא אסמכתה מאושרת</span><strong>{state.flows.filter(f=>!f.verified).length}</strong></div><button className="cp-btn cp-btn-dark" onClick={()=>{setTab('agent');setAgentRun(true)}}><Sparkles size={16}/>הפעלת בדיקת התיק<ArrowLeft size={16}/></button><small>ממצאים מחושבים לפי נתוני הדגם, ללא מודל AI חיצוני.</small></section></div>
          <div className="cp-overview-grid"><section className="cp-panel"><div className="cp-panel-head"><div><h2>מה עדיין חסר?</h2><p>הרשימה שתעבור לבדיקתך לפני פנייה ללקוח</p></div><button className="cp-text-btn" onClick={()=>setTab('documents')}>כל המסמכים<ArrowLeft size={14}/></button></div>{missing.slice(0,4).map(d=><div className="cp-missing-row" key={d.id}><span className="cp-file-icon"><FileText size={18}/></span><div><strong>{d.title}</strong><small>{d.category} · ליום ההצהרה</small></div><Badge tone="amber">חסר</Badge></div>)}{!missing.length&&<div className="cp-empty"><CheckCheck/>כל שמות המסמכים התקבלו. יש להשלים בדיקת תוכן.</div>}</section><section className="cp-panel"><div className="cp-panel-head"><div><h2>פעילות בתיק</h2><p>עקבות העבודה והאישורים בדגם</p></div><ClipboardList size={20}/></div><div className="cp-log">{state.log.slice(0,5).map((l,i)=><div key={`${l}-${i}`}><span/><p>{l}</p></div>)}</div><button className="cp-text-btn" onClick={()=>exportFile('json')}><Download size={15}/>הורדת גיבוי נתוני הדגם</button></section></div>
        </>}

        {tab === 'documents' && <DocumentAgentQueue state={state} onDestination={(documentId,destination)=>change(s=>setDocumentDestination(s,documentId,destination),'עודכנה הצעת סיווג למסמך')} onAmount={(documentId,value)=>change(s=>setDocumentAmount(s,documentId,value),'עודכן סכום מוצע במסמך')} onNote={(documentId,note)=>change(s=>({...s,docs:s.docs.map(document=>document.id===documentId?{...document,officeNote:note}:document)}))} onApprove={approveAgentProposal} onApproveAll={approveAllAgentProposals} onOpen={documentId=>setSelected(documentId)} onNotice={setNotice}/>}

        {tab === 'documents' && <div className="cp-document-grid"><section className="cp-panel"><div className="cp-panel-head"><div><h2>תיק המסמכים</h2><p>קישור בין כל מסמך לסעיף בהצהרה</p></div><Badge>{received} התקבלו</Badge></div><div className="cp-doc-tools"><label className="cp-search"><Search size={16}/><input placeholder="חיפוש מסמך או קטגוריה…" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="סינון מסמכים" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">כל המצבים</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div><div className="cp-doc-list">{state.docs.filter(d=>(filter==='all'||d.status===filter)&&(d.title+d.category).includes(search)).map(d=><button key={d.id} className={`cp-doc-row ${selected===d.id?'selected':''}`} onClick={()=>setSelected(d.id)}><span className="cp-file-icon"><FileText size={20}/></span><div><strong>{d.title}</strong><small>{d.category} · {d.source==='client'?'מהלקוח':'מהמשרד'}{d.sample?' · דוגמה':''}</small></div><Badge tone={d.status==='reviewed'?'mint':d.status==='missing'?'amber':'blue'}>{statusLabels[d.status]}</Badge></button>)}</div><button className="cp-upload-zone" onClick={()=>upload(null,'office')}><Upload/><strong>צירוף מסמכים מהמשרד</strong><small>PDF, תמונות, Excel ו־CSV · עד 20MB לקובץ</small><small>בדגם נשמרים שמות בלבד; אין העלאת תוכן</small></button></section>
          <section className="cp-panel cp-doc-preview">{doc&&<><div className="cp-panel-head"><div><h2>קריאה ובקרה</h2><p>{doc.title}</p></div><ScanLine size={22}/></div><div className="cp-paper"><div className="cp-paper-top">{doc.sample?'מסמך דוגמה · לא מסמך אמיתי':'פרטי קובץ · ללא תצוגת תוכן'}</div><FileText size={42}/><h3>{doc.fileName??'המסמך עדיין לא התקבל'}</h3><p>{doc.sample?'נתוני הדוגמה מובנים מראש לצורך הדמיית קריאה.':'הדגם אינו שומר או קורא את תוכן הקובץ.'}</p>{doc.status==='extracted'||doc.status==='reviewed'?<div className="cp-extraction"><span>סכום שחולץ · הדמיה</span><strong>{doc.extracted!==undefined?currency(doc.extracted):'אישור משרד לדוגמה'}</strong><small>תאריך הצהרה: {state.currentDate}</small></div>:<div className="cp-paper-lines"><span/><span/><span/></div>}</div><div className="cp-routing-box"><div className="cp-routing-head"><strong>בדיקת שם המסמך והמיקום</strong><Badge tone={doc.routingState==='confirmed'?'mint':doc.routingState==='suggested'?'blue':'amber'}>{doc.routingState==='confirmed'?'אושר במשרד':doc.routingState==='suggested'?'הצעת הסוכן':'לא משויך'}</Badge></div><div className="cp-routing-current"><FileText size={15}/><span>{doc.fileName??doc.title}</span></div><div className="cp-routing-controls"><label>לאן להעביר את המסמך?<select aria-label="לאן להעביר את המסמך" value={doc.form1219EntryId??''} onChange={e=>moveDocument(doc.id,e.target.value)}><option value="">ללא שיוך — לבדיקה</option>{state.form1219Entries.map(entry=><option value={entry.id} key={entry.id}>קוד {entry.code} · {entry.description}</option>)}</select></label>{doc.routingState==='suggested'&&doc.form1219EntryId&&<button className="cp-btn cp-btn-white" onClick={()=>confirmDocumentRoute(doc.id)}><CheckCheck size={15}/>המיקום נכון</button>}</div><p className="cp-routing-note">{doc.routingNote??'יש לבדוק את שם הקובץ ואת השורה שאליה שויך. בחירת שורה אחרת מעבירה את המסמך אוטומטית.'}</p></div>
          {doc.status==='missing'?<button className="cp-btn cp-btn-primary cp-full" onClick={()=>upload(doc.id,'office')}><Upload size={17}/>צירוף למסמך החסר</button>:doc.status==='uploaded'?<button className="cp-btn cp-btn-primary cp-full" disabled={!doc.sample||doc.extracted===undefined} onClick={()=>extract(doc)}><ScanLine size={17}/>הדמיית OCR וקריאת ספרים</button>:doc.status==='extracted'?<><div className="cp-info">רמת ביטחון לדוגמה: {doc.confidence}% · יש לבדוק את הסכום, הבעלות, מועד היתרה ובסיס המדידה לפני אישור.</div><label className="cp-label">סכום לאישור<MoneyInput value={doc.extracted??0} label="תיקון סכום שחולץ" onChange={n=>change(s=>({...s,docs:s.docs.map(d=>d.id===doc.id?{...d,extracted:n}:d)}))}/></label><button className="cp-btn cp-btn-primary cp-full" onClick={()=>approveDoc(doc)}><CheckCheck size={17}/>אישור ושיוך להצהרה</button></>:<div className="cp-success"><ShieldCheck size={18}/>מסמך מאושר בדגם</div>}
          <p className="cp-footnote">בדגם אין OCR אמיתי. החילוץ זמין רק לאישור הבנק ולמאזן הבוחן לדוגמה; תוצאה טעונה אישור ולא מחליפה ביקורת.</p></>}</section></div>}

        {tab === 'declaration' && <>
          <OfficialDeclaration1219 state={state} onChange={change} onOpenDocument={documentId=>{setSelected(documentId);setTab('documents')}}/>
          <section className="cp-panel cp-details"><div className="cp-panel-head"><div><h2>נספחים ואישורים לצירוף</h2><p>סמני מה נדרש לחבילת הלקוח ומה כבר מוכן</p></div><Badge>{state.annexes.filter(a=>a.selected).length} נבחרו</Badge></div><div className="cp-annex-list">{state.annexes.map(item=><div className="cp-annex-row" key={item.id}><label><input type="checkbox" checked={item.selected} onChange={e=>change(s=>({...s,annexes:s.annexes.map(a=>a.id===item.id?{...a,selected:e.target.checked}:a)}))}/><span><strong>{item.label}</strong><small>{item.selected?'לצרף לחבילת החתימה':'לא סומן לצירוף'}</small></span></label><label className="cp-annex-included"><input type="checkbox" checked={item.included} disabled={!item.selected} onChange={e=>change(s=>({...s,annexes:s.annexes.map(a=>a.id===item.id?{...a,included:e.target.checked}:a)}))}/>{item.included?'מוכן בחבילה':'עדיין חסר'}</label></div>)}</div><p className="cp-footnote">זוהי רשימת עבודה בדגם. יש להתאים אותה לטופס הרשמי העדכני ולנסיבות הלקוח לפני שליחה.</p></section>
          <section className="cp-panel cp-details cp-final-notes"><div className="cp-panel-head"><div><h2>הערות בסוף הקובץ</h2><p>הטקסט ייכלל בסוף חבילת ההצהרה שתועבר ללקוח</p></div><FileText size={21}/></div><label className="cp-label">הערות המשרד<textarea rows={5} value={state.officeNotes} placeholder="הערות, הסתייגויות או הנחיות ללקוח…" onChange={e=>change(s=>({...s,officeNotes:e.target.value}))}/></label></section>
        </>}

        {tab === 'comparison' && <AnnualWorksheet state={state} onChange={(worksheet, event) => change(s => ({ ...s, worksheet }), event)} onNotice={setNotice} onAttachDocument={rowId => upload(null, 'office', rowId)} onOpenDocument={documentId => { setSelected(documentId); setTab('documents') }} />}

        {tab === 'agent' && <div className="cp-document-grid"><section className="cp-panel"><div className="cp-panel-head"><div><h2>דוח סוכן הבדיקה</h2><p>{agentRun?'הבדיקה הושלמה לפי הנתונים הנוכחיים':'ממצאים מחושבים מתוך התיק · אפשר להריץ בדיקה'}</p></div><button className="cp-btn cp-btn-primary" onClick={()=>{setAgentRun(true);change(s=>s,'הופקה בדיקת חוסרים והשוואת הון');setAgentRun(true);setNotice('בדיקת הדגם הושלמה. יש לעבור על הממצאים לפני פנייה ללקוח.')}}><Sparkles size={16}/>בדיקת התיק</button></div><div className="cp-review-summary"><ShieldCheck/><div><strong>החלטות נשארות אצל המשרד.</strong><p>הסוכן מרכז ממצאים והצעות. הוא אינו מאשר נתונים, שולח הודעות או מגיש הצהרה.</p></div></div>{issues.map((issue,i)=><div className={`cp-finding ${issue.level}`} key={i}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{issue.title}</strong><p>{issue.detail}</p></div><Badge tone={issue.level==='high'?'amber':issue.level==='medium'?'blue':'neutral'}>{issue.level==='high'?'נדרשת השלמה':issue.level==='medium'?'לבדיקה':'בקרה'}</Badge></div>)}</section>
          <section className="cp-panel cp-draft-panel"><div className="cp-panel-head"><div><h2>פנייה ללקוח</h2><p>טיוטה → בדיקה → אישור → הדמיית שליחה</p></div><Mail size={22}/></div><div className="cp-channel-tabs"><button className={state.draft?.channel!=='whatsapp'?'active':''} onClick={()=>change(s=>({...s,draft:makeDraft(s,'email')}),'נוצרה טיוטת מייל לבדיקה')}><Mail size={16}/>מייל</button><button className={state.draft?.channel==='whatsapp'?'active':''} onClick={()=>change(s=>({...s,draft:makeDraft(s,'whatsapp')}),'נוצרה טיוטת וואטסאפ לבדיקה')}><MessageCircle size={16}/>וואטסאפ</button></div>{!state.draft?<div className="cp-empty"><Mail size={32}/><strong>מכינים פנייה, לא שולחים אוטומטית.</strong><p>הטיוטה תכלול את המסמכים החסרים בתיק.</p><button className="cp-btn cp-btn-primary" onClick={()=>change(s=>({...s,draft:makeDraft(s,'email')}),'נוצרה טיוטת השלמות ללקוח')}>הכנת טיוטה ללקוח</button></div>:<><div className="cp-draft-to">{state.draft.channel==='email'?`אל: ${state.email}`:'ערוץ: WhatsApp · מספר טלפון יוגדר במערכת האמיתית'}</div><label className="cp-label">נושא<input value={state.draft.subject} onChange={e=>change(s=>({...s,draft:s.draft?{...s.draft,subject:e.target.value,state:'draft',approvedAt:undefined}:null}))}/></label><label className="cp-label">תוכן ההודעה<textarea rows={12} value={state.draft.body} onChange={e=>change(s=>({...s,draft:s.draft?{...s.draft,body:e.target.value,state:'draft',approvedAt:undefined}:null}))}/></label><div className="cp-approval-status"><Badge tone={state.draft.state==='draft'?'amber':'mint'}>{state.draft.state==='draft'?'ממתינה לאישור שלך':state.draft.state==='approved'?'אושרה במשרד':'הדמיית השליחה הושלמה'}</Badge><small>עריכת ההודעה מבטלת את האישור הקודם.</small></div><button className="cp-btn cp-btn-white cp-full" disabled={state.draft.state!=='draft'||!state.draft.body.trim()||!state.draft.subject.trim()} onClick={()=>change(s=>({...s,draft:s.draft?approvedDraft(s.draft):null}),'המשרד אישר את נוסח הפנייה בדגם')}><ShieldCheck size={17}/>בדקתי ואני מאשרת את הטיוטה</button><button className="cp-btn cp-btn-primary cp-full" disabled={state.draft.state!=='approved'} onClick={()=>{change(s=>({...s,draft:s.draft?simulateSend(s.draft):null}),'בוצעה הדמיית שליחה — לא נשלחה הודעה');setNotice('הדמיית השליחה הושלמה. לא נשלח מייל או וואטסאפ בפועל.')}}><ArrowUpLeft size={17}/>הדמיית שליחה לאחר אישור</button><button className="cp-text-btn" onClick={()=>change(s=>({...s,draft:makeDraft(s,s.draft?.channel??'email')}),'רועננה טיוטה לפי החוסרים הנוכחיים')}>רענון הטיוטה לפי החוסרים בתיק</button></>}<p className="cp-footnote">אין חיבור לספק מייל או WhatsApp בדגם. אישור זה מדגים את התהליך; במערכת האמיתית יידרשו הרשאות משרד ובקרת שרת.</p></section></div>}

        {tab === 'signature' && <div className="cp-signature-layout"><section className="cp-panel"><div className="cp-panel-head"><div><h2>חבילת המסמכים לחתימה</h2><p>כל החומר שיעבור ללקוח במסירה אחת</p></div><Badge tone={state.signature.state==='draft'?'amber':'mint'}>{state.signature.state==='draft'?'בהכנה':state.signature.state==='approved'?'אושרה לשליחה':'השליחה הודגמה'}</Badge></div><div className="cp-package-item"><span className="cp-package-number">1</span><FileSignature size={22}/><div><strong>הצהרת הון ליום {state.currentDate.split('-').reverse().join('.')}</strong><small>פרטים אישיים, ילדים, נכסים, התחייבויות והערות בסוף הקובץ</small></div><Badge tone="mint">מוכן בדגם</Badge></div><div className="cp-package-item"><span className="cp-package-number">2</span><FolderOpen size={22}/><div><strong>נספחים ואישורים שסומנו</strong><small>{state.annexes.filter(a=>a.selected).length} נספחים נבחרו · {state.annexes.filter(a=>a.selected&&!a.included).length} עדיין חסרים</small></div><Badge tone={state.annexes.some(a=>a.selected&&!a.included)?'amber':'mint'}>{state.annexes.some(a=>a.selected&&!a.included)?'נדרשת השלמה':'מוכן'}</Badge></div><div className="cp-package-item"><span className="cp-package-number">3</span><ShieldCheck size={22}/><div><strong>אישור נכונות הפרטים ומסירת המידע</strong><small>{state.signature.acknowledgementFileName||'טרם צורף קובץ PDF'}</small></div><button className="cp-text-btn" onClick={()=>signatureInput.current?.click()}>{state.signature.acknowledgementFileName?'החלפת קובץ':'צירוף PDF'}</button></div><div className="cp-signature-note"><strong>מה נלקח מהקובץ שצירפת?</strong><p>האישור מתייחס להון ולהתחייבויות בארץ ובחו״ל, לבן או בת הזוג ולילדים שטרם מלאו להם 18, ולאחריות הלקוח לנכונות ולשלמות הנתונים. בדגם נשמר שם הקובץ בלבד.</p></div><button className="cp-btn cp-btn-white" onClick={downloadSignatureManifest}><Download size={16}/>הורדת סיכום החבילה לבדיקה</button></section><section className="cp-panel cp-signature-approval"><div className="cp-agent-orb"><FileSignature size={27}/></div><Badge>חתימה דיגיטלית · דגם</Badge><h2>בדיקה ואישור לפני שליחה</h2><div className="cp-signature-recipient"><span>נמען</span><strong>{state.client}</strong><small>{state.email}</small></div><div className="cp-package-checks"><p className={state.signature.acknowledgementFileName?'done':''}><Check size={15}/>אישור נכונות הפרטים צורף</p><p className={!state.annexes.some(a=>a.selected&&!a.included)?'done':''}><Check size={15}/>כל הנספחים שסומנו מוכנים</p><p className={state.personal.clientId&&state.personal.birthDate?'done':''}><Check size={15}/>פרטי הלקוח ותאריך הלידה מולאו</p></div><button className="cp-btn cp-btn-white cp-full" disabled={state.signature.state!=='draft'||!state.signature.acknowledgementFileName||state.annexes.some(a=>a.selected&&!a.included)||!state.personal.clientId||!state.personal.birthDate} onClick={()=>change(s=>({...s,signature:{...s.signature,state:'approved',approvedAt:new Date().toISOString()}}),'המשרד אישר את חבילת החתימה בדגם')}><ShieldCheck size={17}/>בדקתי ואני מאשרת לשלוח לחתימה</button><button className="cp-btn cp-btn-primary cp-full" disabled={state.signature.state!=='approved'} onClick={()=>{change(s=>({...s,signature:{...s.signature,state:'simulated'}}),'בוצעה הדמיית שליחה לחתימה — לא נשלח קובץ');setNotice('הדמיית השליחה לחתימה הושלמה. לא נשלח קובץ ולא נוצרה חתימה אמיתית.')}}><ArrowUpLeft size={17}/>הדמיית שליחה לחתימה דיגיטלית</button><p className="cp-footnote">במערכת האמיתית נחבר ספק חתימה דיגיטלית, נעקוב אחרי סטטוס החתימה ונשמור עותק חתום בתיק. בדגם אין שליחה חיצונית.</p></section></div>}

        {tab === 'portal' && <>
          <div className="cp-info"><Users size={19}/><div><strong>תצוגת לקוח לדוגמה · בתוך סביבת המשרד</strong><p>הלקוח יוכל לצרף מסמכים בפורטל מאובטח. קבלה דרך מייל ו־WhatsApp תתווסף במערכת האמיתית; בדגם אין קישור חיצוני או קבלת הודעות.</p></div></div>
          <section className="cp-portal"><div className="cp-portal-head"><span className="cp-brandmark"><Landmark/></span><small>עבדי בן גל · רואי חשבון</small><h2>שלום, {state.client.split(' ')[0]}.</h2><p>נכין יחד את הצהרת ההון שלך.<br/>כאן אפשר לראות מה צריך ולצרף מסמכים, בקצב שלך.</p><Badge tone="mint">הצהרה ליום {state.currentDate.split('-').reverse().join('.')}</Badge></div><div className="cp-portal-progress"><span>{received} מתוך {state.docs.length} מסמכים התקבלו</span><strong>{Math.round(received/state.docs.length*100)}%</strong><div className="cp-progress"><span style={{width:`${received/state.docs.length*100}%`}}/></div></div><div className="cp-portal-list">{state.docs.map(d=><div className="cp-portal-row" key={d.id}><span className={`cp-file-icon ${d.status!=='missing'?'cp-mint':''}`}>{d.status!=='missing'?<Check size={19}/>:<FileText size={19}/>}</span><div><strong>{d.title}</strong><small>{d.status==='missing'?'יש לצרף מסמך ברור למועד ההצהרה':`נרשם בדגם: ${d.fileName??'מסמך דוגמה'}`}</small></div>{d.status==='missing'?<button className="cp-btn cp-btn-white" onClick={()=>upload(d.id,'client')}><Upload size={15}/>צירוף</button>:<Badge tone="mint">התקבל בדגם</Badge>}</div>)}</div><button className="cp-btn cp-btn-primary cp-full" onClick={()=>upload(null,'client')}><Plus size={17}/>צירוף מסמך נוסף</button><div className="cp-portal-footer"><ShieldCheck size={16}/><span>בדגם נשמרים שמות קבצים בלבד בדפדפן. אין לשלוח כאן מסמכים רגישים.</span></div></section>
        </>}
        <footer className="cp-footer"><span>הון. · דגם אינטראקטיבי למשרד</span><button onClick={()=>{if(window.confirm('לאפס את נתוני הדגם בדפדפן? הגיבוי שהורדת לא יימחק.')){setState(seedState());setSelected('bankdoc');setAgentRun(false);setNotice('הדגם אופס לנתוני הדוגמה.')}}}>איפוס נתוני הדגם</button><span>לא להגשה · ללא שליחה חיצונית</span></footer>
      </main>
    </div>
    {notice&&<div className="cp-toast" role="status"><CheckCheck size={18}/><span>{notice}</span><button aria-label="סגירת הודעה" onClick={()=>setNotice('')}><X size={17}/></button></div>}
  </div>
}

function Stat({ label, value, note, icon, alert = false }: { label: string; value: string; note: string; icon: ReactNode; alert?: boolean }) { return <div className={`cp-stat ${alert?'cp-stat-alert':''}`}><div className="cp-stat-label"><span>{label}</span><span className="cp-stat-icon">{icon}</span></div><strong className="cp-stat-value">{value}</strong><small>{note}</small></div> }
