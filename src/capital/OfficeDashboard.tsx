import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileWarning, Search, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { CapitalState } from './model'

type Stage = 'waiting' | 'documents' | 'review' | 'comparison' | 'approval' | 'complete'
interface PortfolioCase {
  id: string
  client: string
  identifier: string
  manager: string
  dueDate: string
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

function demoCases(state: CapitalState): PortfolioCase[] {
  const received = state.docs.filter(d => d.status !== 'missing').length
  const reviewed = state.docs.filter(d => d.status === 'reviewed').length
  const progress = Math.round(((received / Math.max(state.docs.length, 1)) * 60) + ((reviewed / Math.max(state.docs.length, 1)) * 40))
  return [
    { id: 'active', client: state.client, identifier: 'תיק 10482', manager: 'דנית בן גל', dueDate: '2026-12-31', stage: state.worksheet ? 'comparison' : 'documents', progress, received, required: state.docs.length, missing: state.docs.length - received, daysWaiting: 4, lastActivity: 'היום · עודכנה השוואת הון', active: true },
    { id: 'c2', client: 'רונית ויואב כהן', identifier: 'תיק 10195', manager: 'מיכל אברהם', dueDate: '2026-11-30', stage: 'waiting', progress: 24, received: 5, required: 14, missing: 9, daysWaiting: 12, lastActivity: 'לפני 5 ימים · נשלחה תזכורת' },
    { id: 'c3', client: 'חברת אורן ובעלי מניות', identifier: 'תיק 10903', manager: 'דנית בן גל', dueDate: '2026-10-31', stage: 'review', progress: 58, received: 18, required: 22, missing: 4, daysWaiting: 1, lastActivity: 'אתמול · נקראו מסמכי הבנק' },
    { id: 'c4', client: 'משפחת מזרחי', identifier: 'תיק 9877', manager: 'אורית לוי', dueDate: '2026-10-20', stage: 'approval', progress: 88, received: 16, required: 16, missing: 0, daysWaiting: 0, lastActivity: 'היום · ממתין לבקרת מנהלת' },
    { id: 'c5', client: 'אלון שחר', identifier: 'תיק 10641', manager: 'הדס רון', dueDate: '2026-09-30', stage: 'complete', progress: 100, received: 12, required: 12, missing: 0, daysWaiting: 0, lastActivity: 'לפני 3 ימים · התיק הושלם' },
    { id: 'c6', client: 'נועה וגיל פרץ', identifier: 'תיק 11012', manager: 'מיכל אברהם', dueDate: '2026-11-15', stage: 'documents', progress: 41, received: 7, required: 15, missing: 8, daysWaiting: 8, lastActivity: 'לפני יומיים · התקבלו 2 מסמכים' },
  ]
}

export function OfficeDashboard({ state, onOpen, onNotice }: { state: CapitalState; onOpen: () => void; onNotice: (message: string) => void }) {
  const cases = demoCases(state)
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [managerFilter, setManagerFilter] = useState('all')
  const visible = cases.filter(c => `${c.client} ${c.identifier} ${c.manager}`.toLowerCase().includes(query.trim().toLowerCase()) && (stageFilter === 'all' || c.stage === stageFilter) && (managerFilter === 'all' || c.manager === managerFilter))
  const overdue = cases.filter(c => new Date(c.dueDate) < new Date('2026-10-11') && c.stage !== 'complete').length
  const waiting = cases.filter(c => c.stage === 'waiting' || c.daysWaiting >= 7).length
  const average = Math.round(cases.reduce((a, c) => a + c.progress, 0) / cases.length)
  return <>
    <div className="cp-portfolio-stats">
      <PortfolioStat icon={<Users />} value={String(cases.length)} label="תיקי הצהרת הון" note="5 פעילים · 1 הושלם" />
      <PortfolioStat icon={<Clock3 />} value={String(waiting)} label="ממתינים ללקוח" note="נדרשת תזכורת או השלמה" alert />
      <PortfolioStat icon={<FileWarning />} value={String(cases.reduce((a, c) => a + c.missing, 0))} label="מסמכים חסרים" note="בכל התיקים הפעילים" />
      <PortfolioStat icon={<CheckCircle2 />} value={`${average}%`} label="התקדמות ממוצעת" note="לפי מסמכים ושלבי עבודה" />
      <PortfolioStat icon={<AlertTriangle />} value={String(overdue)} label="חריגות מועד" note="לפי תאריך היעד בדגם" alert={overdue > 0} />
    </div>
    <section className="cp-panel cp-portfolio-panel">
      <div className="cp-panel-head"><div><h2>תיקי הצהרות ההון</h2><p>מעקב מרוכז אחר איסוף, בדיקה, השוואה ואישור</p></div><button className="cp-btn cp-btn-primary" onClick={() => onNotice('פתיחת תיק חדש תתווסף במערכת האמיתית. בדגם קיים תיק פעיל אחד לעריכה וחמישה תיקי מעקב לדוגמה.')}><span>+</span>תיק חדש</button></div>
      <div className="cp-portfolio-tools"><label className="cp-search"><Search size={16} /><input aria-label="חיפוש לקוח" placeholder="חיפוש לפי לקוח, תיק או אחראי…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="סינון שלב" value={stageFilter} onChange={e => setStageFilter(e.target.value)}><option value="all">כל השלבים</option>{Object.entries(stageLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="סינון אחראי" value={managerFilter} onChange={e => setManagerFilter(e.target.value)}><option value="all">כל האחראים</option><option>דנית בן גל</option><option>מיכל אברהם</option><option>אורית לוי</option><option>הדס רון</option></select></div>
      <div className="cp-table-wrap"><table className="cp-table cp-portfolio-table"><thead><tr><th>לקוח ותיק</th><th>שלב נוכחי</th><th>התקדמות</th><th>מסמכים</th><th>אחראי</th><th>תאריך יעד</th><th>פעילות אחרונה</th><th /></tr></thead><tbody>{visible.map(c => <tr key={c.id} className={c.active ? 'active-case' : ''}><td><strong>{c.client}</strong><small>{c.identifier}{c.active ? ' · תיק פעיל בדגם' : ' · נתוני מעקב לדוגמה'}</small></td><td><span className={`cp-badge cp-${stageTone[c.stage]}`}>{stageLabel[c.stage]}</span>{c.daysWaiting >= 7 && <small className="cp-waiting-note">ממתין {c.daysWaiting} ימים</small>}</td><td><div className="cp-case-progress"><span><i style={{ width: `${c.progress}%` }} /></span><strong>{c.progress}%</strong></div></td><td><strong>{c.received} / {c.required}</strong><small>{c.missing ? `${c.missing} חסרים` : 'הכול התקבל'}</small></td><td>{c.manager}</td><td><span className={new Date(c.dueDate) < new Date('2026-10-11') && c.stage !== 'complete' ? 'cp-date-risk' : ''}><CalendarDays size={14} />{c.dueDate.split('-').reverse().join('.')}</span></td><td><small>{c.lastActivity}</small></td><td>{c.active ? <button className="cp-open-case" onClick={onOpen}>פתיחת התיק<ArrowLeft size={14} /></button> : <button className="cp-open-case muted" onClick={() => onNotice(`${c.client}: זהו תיק מעקב לדוגמה. בדגם הנוכחי רק תיק משפחת לוי פתוח לעריכה.`)}>תצוגת מעקב</button>}</td></tr>)}</tbody></table>{!visible.length && <div className="cp-empty">לא נמצאו תיקים לפי הסינון שנבחר.</div>}</div>
    </section>
    <div className="cp-overview-grid cp-portfolio-bottom"><section className="cp-panel"><div className="cp-panel-head"><div><h2>עומס לפי שלב</h2><p>איפה התיקים נמצאים עכשיו</p></div></div>{(['waiting','documents','review','comparison','approval','complete'] as Stage[]).map(stage => { const count = cases.filter(c => c.stage === stage).length; return <div className="cp-stage-load" key={stage}><span>{stageLabel[stage]}</span><div><i style={{ width: `${Math.max(8, count / cases.length * 100)}%` }} /></div><strong>{count}</strong></div>})}</section><section className="cp-panel"><div className="cp-panel-head"><div><h2>דורש טיפול</h2><p>חריגים שמנהלת המשרד צריכה לראות</p></div></div>{cases.filter(c => c.missing >= 4 || c.daysWaiting >= 7).map(c => <button className="cp-attention-row" key={c.id} onClick={() => c.active ? onOpen() : onNotice(`${c.client}: ${c.missing} מסמכים חסרים, ממתין ${c.daysWaiting} ימים.`)}><span className="cp-client-avatar">{c.client.split(' ').map(x => x[0]).slice(0,2).join('')}</span><div><strong>{c.client}</strong><small>{c.missing} מסמכים חסרים · {c.daysWaiting ? `ממתין ${c.daysWaiting} ימים` : stageLabel[c.stage]}</small></div><ArrowLeft size={15} /></button>)}</section></div>
  </>
}

function PortfolioStat({ icon, value, label, note, alert = false }: { icon: ReactNode; value: string; label: string; note: string; alert?: boolean }) {
  return <div className={`cp-stat ${alert ? 'cp-stat-alert' : ''}`}><div className="cp-stat-label"><span>{label}</span><span className="cp-stat-icon">{icon}</span></div><strong className="cp-stat-value">{value}</strong><small>{note}</small></div>
}
