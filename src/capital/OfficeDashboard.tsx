import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText, FileWarning, Search, Upload, Users, X } from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import type { CapitalState } from './model'

type Stage = 'waiting' | 'documents' | 'review' | 'comparison' | 'approval' | 'complete'
interface PortfolioCase {
  id: string
  client: string
  identifier: string
  manager: string
  declarationDate: string
  filingDate: string
  workSeconds: number
  stage: Stage
  progress: number
  received: number
  required: number
  missing: number
  daysWaiting: number
  lastActivity: string
  active?: boolean
}

const stageLabel: Record<Stage, string> = {
  waiting: 'ממתין ללקוח', documents: 'איסוף מסמכים', review: 'קריאה ובדיקה', comparison: 'השוואת הון', approval: 'בקרת המשרד', complete: 'הושלם',
}
const stageTone: Record<Stage, string> = { waiting: 'amber', documents: 'blue', review: 'blue', comparison: 'mint', approval: 'amber', complete: 'mint' }
const displayDate = (value: string) => value.split('-').reverse().join('.')
const displayWorkTime = (seconds: number) => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`

const newTaxCases = [
  { id: 'tax-1', client: 'יעל ואמיר ברק', identifier: 'תיק 11241', declarationDate: '2025-12-31', filingDate: '2026-12-15', duplicate: false },
  { id: 'tax-2', client: 'משפחת שלו', identifier: 'תיק 11256', declarationDate: '2024-12-31', filingDate: '2026-11-30', duplicate: false },
]

function demoCases(state: CapitalState): PortfolioCase[] {
  const received = state.docs.filter(d => d.status !== 'missing').length
  const reviewed = state.docs.filter(d => d.status === 'reviewed').length
  const progress = Math.round(((received / Math.max(state.docs.length, 1)) * 60) + ((reviewed / Math.max(state.docs.length, 1)) * 40))
  return [
    { id: 'active', client: state.client, identifier: 'תיק 10482', manager: 'דנית בן גל', declarationDate: state.currentDate, filingDate: state.filingDate, workSeconds: state.workSeconds, stage: state.worksheet ? 'comparison' : 'documents', progress, received, required: state.docs.length, missing: state.docs.length - received, daysWaiting: 4, lastActivity: 'היום · עודכנה השוואת הון', active: true },
    { id: 'c2', client: 'רונית ויואב כהן', identifier: 'תיק 10195', manager: 'מיכל אברהם', declarationDate: '2024-12-31', filingDate: '2026-11-30', workSeconds: 8940, stage: 'waiting', progress: 24, received: 5, required: 14, missing: 9, daysWaiting: 12, lastActivity: 'לפני 5 ימים · נשלחה תזכורת' },
    { id: 'c3', client: 'חברת אורן ובעלי מניות', identifier: 'תיק 10903', manager: 'דנית בן גל', declarationDate: '2025-12-31', filingDate: '2026-10-31', workSeconds: 22800, stage: 'review', progress: 58, received: 18, required: 22, missing: 4, daysWaiting: 1, lastActivity: 'אתמול · נקראו מסמכי הבנק' },
    { id: 'c4', client: 'משפחת מזרחי', identifier: 'תיק 9877', manager: 'אורית לוי', declarationDate: '2023-12-31', filingDate: '2026-10-20', workSeconds: 35100, stage: 'approval', progress: 88, received: 16, required: 16, missing: 0, daysWaiting: 0, lastActivity: 'היום · ממתין לבקרת מנהלת' },
    { id: 'c5', client: 'אלון שחר', identifier: 'תיק 10641', manager: 'הדס רון', declarationDate: '2024-12-31', filingDate: '2026-09-30', workSeconds: 41220, stage: 'complete', progress: 100, received: 12, required: 12, missing: 0, daysWaiting: 0, lastActivity: 'לפני 3 ימים · התיק הושלם' },
    { id: 'c6', client: 'נועה וגיל פרץ', identifier: 'תיק 11012', manager: 'מיכל אברהם', declarationDate: '2025-06-30', filingDate: '2026-11-15', workSeconds: 16560, stage: 'documents', progress: 41, received: 7, required: 15, missing: 8, daysWaiting: 8, lastActivity: 'לפני יומיים · התקבלו 2 מסמכים' },
  ]
}

export function OfficeDashboard({ state, onOpen, onNotice, onUpdateDates }: { state: CapitalState; onOpen: (target?: 'overview' | 'personal') => void; onNotice: (message: string) => void; onUpdateDates: (declarationDate: string, filingDate: string) => void }) {
  const [importedCases, setImportedCases] = useState<PortfolioCase[]>([])
  const [pdfName, setPdfName] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const cases = [...demoCases(state), ...importedCases]
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [managerFilter, setManagerFilter] = useState('all')
  const taxPreviewRows = [...newTaxCases, { id: 'tax-existing', client: state.client, identifier: 'תיק 10482', declarationDate: '2026-12-31', filingDate: '2027-03-31', duplicate: true }]
  const visible = cases.filter(c => `${c.client} ${c.identifier} ${c.manager}`.toLowerCase().includes(query.trim().toLowerCase()) && (stageFilter === 'all' || c.stage === stageFilter) && (managerFilter === 'all' || c.manager === managerFilter))
  const overdue = cases.filter(c => new Date(c.filingDate) < new Date('2026-10-11') && c.stage !== 'complete').length
  const waiting = cases.filter(c => c.stage === 'waiting' || c.daysWaiting >= 7).length
  const average = Math.round(cases.reduce((a, c) => a + c.progress, 0) / cases.length)
  function receiveTaxList(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      onNotice('יש לבחור קובץ PDF שהתקבל מרשות המסים.')
      return
    }
    setPdfName(file.name)
  }
  function approveImport() {
    const additions: PortfolioCase[] = taxPreviewRows.filter(row => !row.duplicate).map((row, index) => ({
      ...row, manager: 'טרם שויך', workSeconds: 0, stage: 'waiting', progress: 0, received: 0, required: 12, missing: 12,
      daysWaiting: 0, lastActivity: 'עכשיו · נקלט מרשימת רשות המסים (הדמיה)', id: `import-${Date.now()}-${index}`,
    }))
    setImportedCases(current => current.length ? current : additions)
    const existingClient = taxPreviewRows.find(row => row.duplicate)
    if (existingClient) onUpdateDates(existingClient.declarationDate, existingClient.filingDate)
    setPdfName('')
    onNotice('נקלטו 2 תיקים חדשים ועודכנו רק מועדי ההצהרה וההגשה של הלקוח הקיים. כל המסמכים ונתוני התיק נשמרו ללא שינוי.')
  }
  return <>
    <input ref={importInput} hidden type="file" accept="application/pdf,.pdf" onChange={receiveTaxList} />
    <div className="cp-portfolio-stats">
      <PortfolioStat icon={<Users />} value={String(cases.length)} label="תיקי הצהרת הון" note="5 פעילים · 1 הושלם" />
      <PortfolioStat icon={<Clock3 />} value={String(waiting)} label="ממתינים ללקוח" note="נדרשת תזכורת או השלמה" alert />
      <PortfolioStat icon={<FileWarning />} value={String(cases.reduce((a, c) => a + c.missing, 0))} label="מסמכים חסרים" note="בכל התיקים הפעילים" />
      <PortfolioStat icon={<CheckCircle2 />} value={`${average}%`} label="התקדמות ממוצעת" note="לפי מסמכים ושלבי עבודה" />
      <PortfolioStat icon={<AlertTriangle />} value={String(overdue)} label="חריגות מועד" note="לפי תאריך ההגשה בדגם" alert={overdue > 0} />
    </div>
    {pdfName && <section className="cp-panel cp-import-panel" aria-label="תצוגה מקדימה לקליטת PDF מרשות המסים">
      <div className="cp-panel-head"><div><h2>קליטת רשימה מרשות המסים</h2><p>{pdfName}</p></div><button className="cp-icon-close" aria-label="ביטול קליטה" onClick={() => setPdfName('')}><X size={18} /></button></div>
      <div className="cp-import-warning"><FileText size={20} /><div><strong>הדמיית OCR בדגם</strong><p>תוכן הקובץ לא נקרא ולא נשמר. לקוח קיים יקבל רק את תאריך הצהרת ההון ותאריך ההגשה החדשים; המסמכים וכל יתר נתוני התיק יישמרו ללא שינוי.</p></div></div>
      <div className="cp-table-wrap"><table className="cp-table cp-import-table"><thead><tr><th>לקוח</th><th>מספר תיק</th><th>תאריך הצהרת הון</th><th>תאריך הגשה</th><th>פעולה לאחר אישור</th></tr></thead><tbody>{taxPreviewRows.map(row => <tr key={row.id}><td><strong>{row.client}</strong></td><td>{row.identifier}</td><td>{displayDate(row.declarationDate)}</td><td>{displayDate(row.filingDate)}</td><td><span className={`cp-badge cp-${row.duplicate ? 'blue' : 'mint'}`}>{row.duplicate ? 'לקוח קיים — עדכון תאריכים בלבד' : 'פתיחת תיק חדש'}</span></td></tr>)}</tbody></table></div>
      <div className="cp-import-actions"><span>2 תיקים חדשים · עדכון מועדים ללקוח קיים אחד</span><button className="cp-btn cp-btn-white" onClick={() => setPdfName('')}>ביטול</button><button className="cp-btn cp-btn-primary" onClick={approveImport}><CheckCircle2 size={16} />אישור קליטה ועדכון מועדים</button></div>
    </section>}
    <section className="cp-panel cp-portfolio-panel">
      <div className="cp-panel-head"><div><h2>תיקי הצהרות ההון</h2><p>מעקב מרוכז אחר איסוף, בדיקה, השוואה ואישור</p></div><div className="cp-panel-actions"><button className="cp-btn cp-btn-white" onClick={() => importInput.current?.click()}><Upload size={16} />קליטת רשימה מרשות המסים · PDF</button><button className="cp-btn cp-btn-primary" onClick={() => onNotice('פתיחת תיק חדש תתווסף במערכת האמיתית. בדגם קיים תיק פעיל אחד לעריכה וחמישה תיקי מעקב לדוגמה.')}><span>+</span>תיק חדש</button></div></div>
      <div className="cp-portfolio-tools"><label className="cp-search"><Search size={16} /><input aria-label="חיפוש לקוח" placeholder="חיפוש לפי לקוח, תיק או אחראי…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="סינון שלב" value={stageFilter} onChange={e => setStageFilter(e.target.value)}><option value="all">כל השלבים</option>{Object.entries(stageLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="סינון אחראי" value={managerFilter} onChange={e => setManagerFilter(e.target.value)}><option value="all">כל האחראים</option><option>דנית בן גל</option><option>מיכל אברהם</option><option>אורית לוי</option><option>הדס רון</option></select></div>
      <div className="cp-table-wrap">
        <table className="cp-table cp-portfolio-table">
          <thead><tr><th>לקוח ותיק</th><th>שלב נוכחי</th><th>התקדמות</th><th>מסמכים</th><th>אחראי</th><th>שעות עבודה</th><th>תאריך הצהרת הון</th><th>תאריך הגשה</th><th>פעילות אחרונה</th><th /></tr></thead>
          <tbody>{visible.map(c => <tr key={c.id} className={c.active ? 'active-case' : ''}>
            <td><button className="cp-client-name" onClick={() => c.active ? onOpen('personal') : onNotice(`${c.client}: זהו תיק מעקב לדוגמה. בדגם הנוכחי רק כרטיס משפחת לוי פעיל.`)}>{c.client}</button><small>{c.identifier}{c.active ? ' · לחצי על השם לפתיחת כרטיס הלקוח' : ' · נתוני מעקב לדוגמה'}</small></td>
            <td><span className={`cp-badge cp-${stageTone[c.stage]}`}>{stageLabel[c.stage]}</span>{c.daysWaiting >= 7 && <small className="cp-waiting-note">ממתין {c.daysWaiting} ימים</small>}</td>
            <td><div className="cp-case-progress"><span><i style={{ width: `${c.progress}%` }} /></span><strong>{c.progress}%</strong></div></td>
            <td><strong>{c.received} / {c.required}</strong><small>{c.missing ? `${c.missing} חסרים` : 'הכול התקבל'}</small></td><td>{c.manager}</td><td><strong className="cp-work-time">{displayWorkTime(c.workSeconds)}</strong><small>שעות:דקות</small></td>
            <td><span><CalendarDays size={14} />{displayDate(c.declarationDate)}</span></td><td><span className={new Date(c.filingDate) < new Date('2026-10-11') && c.stage !== 'complete' ? 'cp-date-risk' : ''}><CalendarDays size={14} />{displayDate(c.filingDate)}</span></td>
            <td><small>{c.lastActivity}</small></td><td>{c.active ? <button className="cp-open-case" onClick={() => onOpen('overview')}>פתיחת התיק<ArrowLeft size={14} /></button> : <button className="cp-open-case muted" onClick={() => onNotice(`${c.client}: זהו תיק מעקב לדוגמה. בדגם הנוכחי רק תיק משפחת לוי פתוח לעריכה.`)}>תצוגת מעקב</button>}</td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <div className="cp-empty">לא נמצאו תיקים לפי הסינון שנבחר.</div>}
      </div>
    </section>
    <div className="cp-overview-grid cp-portfolio-bottom"><section className="cp-panel"><div className="cp-panel-head"><div><h2>עומס לפי שלב</h2><p>איפה התיקים נמצאים עכשיו</p></div></div>{(['waiting','documents','review','comparison','approval','complete'] as Stage[]).map(stage => { const count = cases.filter(c => c.stage === stage).length; return <div className="cp-stage-load" key={stage}><span>{stageLabel[stage]}</span><div><i style={{ width: `${Math.max(8, count / cases.length * 100)}%` }} /></div><strong>{count}</strong></div>})}</section><section className="cp-panel"><div className="cp-panel-head"><div><h2>דורש טיפול</h2><p>חריגים שמנהלת המשרד צריכה לראות</p></div></div>{cases.filter(c => c.missing >= 4 || c.daysWaiting >= 7).map(c => <button className="cp-attention-row" key={c.id} onClick={() => c.active ? onOpen() : onNotice(`${c.client}: ${c.missing} מסמכים חסרים, ממתין ${c.daysWaiting} ימים.`)}><span className="cp-client-avatar">{c.client.split(' ').map(x => x[0]).slice(0,2).join('')}</span><div><strong>{c.client}</strong><small>{c.missing} מסמכים חסרים · {c.daysWaiting ? `ממתין ${c.daysWaiting} ימים` : stageLabel[c.stage]}</small></div><ArrowLeft size={15} /></button>)}</section></div>
  </>
}

function PortfolioStat({ icon, value, label, note, alert = false }: { icon: ReactNode; value: string; label: string; note: string; alert?: boolean }) {
  return <div className={`cp-stat ${alert ? 'cp-stat-alert' : ''}`}><div className="cp-stat-label"><span>{label}</span><span className="cp-stat-icon">{icon}</span></div><strong className="cp-stat-value">{value}</strong><small>{note}</small></div>
}
