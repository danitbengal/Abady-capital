import { CheckCheck, FileCheck2, FileText, Sparkles } from 'lucide-react'
import { documentDestination, documentDestinations, proposedDocumentAmount, type DocumentDestination } from './documentApproval'
import type { CapitalDocument, CapitalState } from './model'

const amount = (raw: string) => Math.max(0, Number(raw) || 0)
const normalize = (value: string) => value.toLowerCase().replace(/[״׳"']/g, '').replace(/\s+/g, ' ').trim()

function destinationFromInstruction(instruction: string, destinations: DocumentDestination[]) {
  const query = normalize(instruction)
  if (!query) return undefined
  const code = query.match(/(?:קוד\s*)?(\d{1,3})/)?.[1]
  return destinations.find(destination => {
    const label = normalize(destination.label)
    if (query.includes(label) || label.includes(query)) return true
    if (code && destination.group === 'declaration' && label.includes(`קוד ${code}`)) return true
    const meaningful = label.split(' · ').at(-1) ?? label
    return meaningful.length > 3 && query.includes(meaningful)
  })
}

export function DocumentAgentQueue({ state, onDestination, onAmount, onNote, onApprove, onApproveAll, onOpen, onNotice }: {
  state: CapitalState
  onDestination: (documentId: string, destination: string) => void
  onAmount: (documentId: string, amount: number) => void
  onNote: (documentId: string, note: string) => void
  onApprove: (documentId: string) => void
  onApproveAll: () => void
  onOpen: (documentId: string) => void
  onNotice: (message: string) => void
}) {
  const received = state.docs.filter(document => document.status !== 'missing')
  const pending = received.filter(document => document.status !== 'reviewed')
  const destinations = documentDestinations(state)

  function applyInstruction(document: CapitalDocument, input: HTMLInputElement) {
    const target = destinationFromInstruction(input.value, destinations)
    if (!target) { onNotice('לא נמצא יעד מתאים בהוראה. אפשר לבחור יעד מהרשימה או לכתוב את שם הסעיף המדויק.'); return }
    onDestination(document.id, target.value)
    input.value = ''
  }

  return <section className="cp-panel cp-agent-queue">
    <div className="cp-panel-head"><div><h2>מסמכים שהתקבלו · הצעות הסוכן</h2><p>בדקי לכל מסמך את הסיווג והסכום לפני העברה להצהרת ההון או להשוואת ההון</p></div><button className="cp-btn cp-btn-primary" disabled={!pending.length} onClick={onApproveAll}><CheckCheck size={16}/>אישור כל ההצעות התקינות</button></div>
    <div className="cp-agent-queue-head"><span>מסמך</span><span>לאן לסווג</span><span>סכום להעברה</span><span>אישור</span></div>
    <div className="cp-agent-queue-list">{received.map(document => {
      const destination = documentDestination(document)
      const confirmed = document.status === 'reviewed' && document.routingState === 'confirmed'
      return <article className={`cp-agent-document ${confirmed ? 'confirmed' : ''}`} key={document.id}>
        <div className="cp-agent-document-info"><button className="cp-agent-document-name" onClick={() => onOpen(document.id)}><span className="cp-file-icon">{confirmed ? <FileCheck2 size={18}/> : <FileText size={18}/>}</span><span><strong>{document.fileName ?? document.title}</strong><small>{document.source === 'client' ? 'התקבל מהלקוח' : 'צורף במשרד'} · {confirmed ? 'אושר והועבר' : 'ממתין לאישור'}</small></span></button><label className="cp-agent-document-note">הערה פנימית למשרד<input aria-label={`הערה פנימית למסמך ${document.fileName ?? document.title}`} value={document.officeNote ?? ''} placeholder="הערה לנייר העבודה בלבד…" onChange={event => onNote(document.id, event.target.value)}/><small>נשארת במשרד ואינה מועברת לרשות המסים או ללקוח</small></label></div>
        <div className="cp-agent-destination"><label>הצעת הסוכן<select aria-label={`יעד סיווג ${document.fileName ?? document.title}`} value={destination} onChange={event => onDestination(document.id, event.target.value)}><option value="">לא נמצא סיווג — לבדיקה</option><optgroup label="הצהרת הון">{destinations.filter(item => item.group === 'declaration').map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</optgroup><optgroup label="השוואת הון — מקורות ושימושים">{destinations.filter(item => item.group === 'comparison').map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</optgroup></select></label><div className="cp-agent-instruction"><input aria-label={`הוראת שינוי ${document.fileName ?? document.title}`} placeholder="למשל: להעביר למתנה מההורים" onKeyDown={event => { if (event.key === 'Enter') applyInstruction(document, event.currentTarget) }}/><button onClick={event => { const input = event.currentTarget.previousElementSibling as HTMLInputElement; applyInstruction(document, input) }}><Sparkles size={13}/>שינוי לפי הוראה</button></div></div>
        <label className="cp-agent-amount">סכום<input type="number" min="0" step="1" aria-label={`סכום מסמך ${document.fileName ?? document.title}`} value={proposedDocumentAmount(state, document)} onChange={event => onAmount(document.id, amount(event.target.value))}/><small>₪ · ניתן לתיקון לפני אישור</small></label>
        <div className="cp-agent-approve">{confirmed ? <span className="cp-agent-approved"><CheckCheck size={16}/>אושר</span> : <button className="cp-btn cp-btn-white" disabled={!destination} onClick={() => onApprove(document.id)}><CheckCheck size={15}/>אישור והעברה</button>}</div>
      </article>
    })}</div>
    {!received.length && <div className="cp-empty"><FileText size={30}/><strong>עדיין לא התקבלו מסמכים</strong></div>}
    <p className="cp-footnote">בדגם הצעת הסוכן מבוססת על השיוך הקיים ושם הקובץ. האישור נדרש לפני עדכון סכום. קובץ אמיתי אינו נשמר ואינו נקרא.</p>
  </section>
}
