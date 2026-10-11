import { CheckCheck, Download, FileText, Paperclip, Plus, Printer, ShieldCheck, Upload } from 'lucide-react'
import { currency, totals, type CapitalState } from './model'
import { comparisonYears, officeExample, reconcileWorksheet, rowTotal, worksheetText, type AnnualRow, type Worksheet } from './worksheet'

export function sheetFromState(state: CapitalState): Worksheet {
  const capital = totals(state.lines)
  return {
    capitalSource: 'declaration', previousNet: capital.previousNet, currentNet: capital.currentNet,
    previousDate: state.previousDate, currentDate: state.currentDate,
    rows: state.flows.filter(f => f.id !== 'living').map(f => ({ ...f, values: {}, unallocated: f.amount })),
    living: {}, livingUnallocated: state.flows.find(f => f.id === 'living')?.amount ?? 0,
    livingVerified: state.flows.find(f => f.id === 'living')?.verified ?? false,
    origin: 'נתוני התיק הקיים. סכומים תקופתיים נשמרו ללא שיוך לשנה; לא הומצא פיזור שנתי.',
  }
}
const num = (raw: string) => Math.max(0, Number(raw) || 0)
const plainNumber = (n: number) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(n)
function Cell({ value, label, onChange, signed = false }: { value: number; label: string; onChange: (v: number) => void; signed?: boolean }) {
  return <input type="number" min={signed ? undefined : 0} step="1" className="cp-money" aria-label={label} value={value} onChange={e => onChange(signed ? Number(e.target.value) || 0 : num(e.target.value))} />
}
export function AnnualWorksheet({ state, onChange, onNotice, onAttachDocument, onOpenDocument }: { state: CapitalState; onChange: (sheet: Worksheet, event: string) => void; onNotice: (message: string) => void; onAttachDocument: (rowId: string) => void; onOpenDocument: (documentId: string) => void }) {
  const sheet = state.worksheet ?? sheetFromState(state)
  const capital = totals(state.lines)
  const c = reconcileWorksheet(sheet, capital)
  const expectedYears = comparisonYears(sheet.previousDate, sheet.currentDate)
  const usedYears = [...sheet.rows.flatMap(r => Object.keys(r.values)), ...Object.keys(sheet.living)].map(Number)
  const years = [...new Set([...expectedYears, ...usedYears])].sort((a, b) => b - a)
  const outOfRange = usedYears.filter(y => !expectedYears.includes(y))
  function update(patch: Partial<Worksheet>, event = 'עודכנה השוואת הון לפי שנים') { onChange({ ...sheet, ...patch }, event) }
  function updateRow(id: string, patch: Partial<AnnualRow>) { update({ rows: sheet.rows.map(r => r.id === id ? { ...r, ...patch, verified: patch.verified ?? false } : r) }) }
  function addRow(kind: AnnualRow['kind']) {
    update({ rows: [...sheet.rows, { id: `annual-${Date.now()}`, label: kind === 'use' ? 'שימוש נוסף' : 'מקור נוסף', kind, values: {}, unallocated: 0, verified: false, note: 'נדרשות אסמכתה ובדיקת כפל מול הדיווח, ההון והוצאות המחיה.' }] }, 'נוסף סעיף שנתי להשוואה')
  }
  function download() {
    const blob = new Blob(['\ufeff' + worksheetText(sheet, capital)], { type: 'text/plain;charset=utf-8' })
    const href = URL.createObjectURL(blob), a = document.createElement('a'); a.href = href; a.download = 'capital-annual-comparison.txt'; a.click(); URL.revokeObjectURL(href)
    onNotice('הורדה השוואת הון עם הפירוט לפי שנים ויתרת המחיה.')
  }
  const steps = [
    { label: 'סה״כ רכוש נקי בהצהרה נוכחית', value: c.currentNet, sign: '', date: sheet.currentDate },
    { label: 'סה״כ רכוש נקי בהצהרת הון קודמת', value: c.previousNet, sign: '−', date: sheet.previousDate },
    { label: 'סה״כ גידול בהון הטעון הסבר', value: c.growth, sign: '=', rule: true },
    { label: 'הוסף — סה״כ שימושים', value: c.uses, sign: '+' },
    { label: 'סה״כ הסכום הטעון הסבר, לפני הוצאות מחיה', value: c.requiredBeforeLiving, sign: '=', rule: true },
    { label: 'הפחת — סה״כ מקורות', value: c.sources, sign: '−' },
    { label: 'יתרת הסכום שנשאר להוצאות מחיה', value: c.availableForLiving, sign: '=', rule: true },
    { label: 'הפחת — הוצאות מחיה משוערות', value: c.living, sign: '−' },
  ]
  return <>
    <div className="cp-sheet-toolbar"><div><h2>השוואת הצהרות הון</h2><p>סיכום מדורג ופירוט שנתי לפי דוגמת המשרד</p></div><div className="cp-heading-actions"><button className="cp-btn cp-btn-white" onClick={() => { if (window.confirm('לטעון את מספרי הצילום במקום נתוני ההשוואה הנוכחיים? פירוט ההצהרה והמסמכים לא יוחלפו. מומלץ להוריד גיבוי לפני כן.')) onChange(officeExample(), 'נטענה דוגמת ההשוואה מצילום המשרד; סיכומי הון בלבד') }}><FileText size={15} />טעינת דוגמת המשרד</button><button className="cp-btn cp-btn-white" onClick={download}><Download size={15} />ייצוא השוואה</button><button className="cp-btn cp-btn-white" onClick={() => window.print()}><Printer size={15} />הדפסה</button></div></div>
    <section className="cp-panel cp-sheet-settings"><div className="cp-form-grid"><label className="cp-label">מקור סיכומי ההון<select value={sheet.capitalSource} onChange={e => { const source = e.target.value as Worksheet['capitalSource']; update({ capitalSource: source, previousDate: source === 'declaration' ? state.previousDate : sheet.previousDate, currentDate: source === 'declaration' ? state.currentDate : sheet.currentDate, previousNet: capital.previousNet, currentNet: capital.currentNet }, 'עודכן מקור סיכומי ההון') }}><option value="declaration">פירוט ההצהרה בתיק</option><option value="imported-summary">סיכומים ממסמך חיצוני</option></select></label><label className="cp-label">הצהרה קודמת<input type="date" value={sheet.previousDate} disabled={sheet.capitalSource === 'declaration'} onChange={e => update({ previousDate: e.target.value })} /></label><label className="cp-label">הצהרה נוכחית<input type="date" value={sheet.currentDate} disabled={sheet.capitalSource === 'declaration'} onChange={e => update({ currentDate: e.target.value })} /></label><label className="cp-label">בסיס העבודה<span className="cp-sheet-basis">סכומים מדווחים · בדיקת המשרד</span></label></div>
      {sheet.capitalSource === 'imported-summary' && <><div className="cp-info"><ShieldCheck size={18} /><div><strong>סיכומים ממסמך חיצוני — אין כאן פירוט נכסים.</strong><p>הצילום משמש להשוואה בלבד. שורות ההצהרה בתיק אינן מוחלפות. יש להתאים בין הסיכומים לבין הצהרות ההון המלאות לפני אישור.</p></div></div><div className="cp-form-grid"><label className="cp-label">רכוש נקי בהצהרה קודמת<Cell signed value={sheet.previousNet} label="סיכום הון קודם מהמסמך" onChange={n => update({ previousNet: n })} /></label><label className="cp-label">רכוש נקי בהצהרה נוכחית<Cell signed value={sheet.currentNet} label="סיכום הון נוכחי מהמסמך" onChange={n => update({ currentNet: n })} /></label></div></>}
      {!expectedYears.length && <div className="cp-info">יש לתקן את סדר התאריכים או לבחור תקופה של עד 50 שנים. החישוב אינו מאושר כל עוד התקופה אינה תקינה.</div>}
      {!!outOfRange.length && <div className="cp-info">יש סכומים בשנים מחוץ לתקופה: {[...new Set(outOfRange)].join(', ')}. הם נשארו בטבלה ובסיכום כדי למנוע אובדן נתונים; נדרשת בדיקת השיוך.</div>}
    </section>
    <section className="cp-panel cp-worksheet-summary"><div className="cp-panel-head"><div><h2>סיכום השוואת ההון</h2><p>{sheet.origin}</p></div><span className="cp-badge">₪ · סכומים לתקופה</span></div><div className="cp-equation">{steps.map((step, i) => <div className={`cp-equation-row ${step.rule ? 'subtotal' : ''}`} key={i}><strong>{step.label}</strong><span className="cp-equation-date">{step.date ? `ליום ${step.date.split('-').reverse().join('/')}` : ''}</span><span className="cp-equation-sign">{step.sign}</span><span className="cp-equation-value">{plainNumber(step.value)}</span></div>)}<div className={`cp-equation-result ${c.surplus < 0 ? 'shortfall' : ''}`}><div><strong>{c.surplus >= 0 ? 'סה״כ עודף הון' : 'סה״כ חוסר הון'}</strong><small>{sheet.livingVerified ? 'חישוב לאחר אומדן מחיה מאושר בדגם; יתר האסמכתאות טעונות בדיקה' : 'תוצאה זמנית — אומדן הוצאות המחיה טרם אושר'}</small></div><span data-testid="capital-result">{currency(Math.abs(c.surplus))}</span></div></div></section>
    {(['source', 'use'] as const).map(kind => {
      const rows = sheet.rows.filter(r => r.kind === kind)
      return <section key={kind} className="cp-panel cp-annual-panel"><div className="cp-panel-head"><div><h2>{kind === 'use' ? 'שימושים' : 'מקורות'}</h2><p>לכל שורה אפשר לרשום סכומים, הערה ולצרף את האסמכתאות המתאימות</p></div><span className="cp-badge">שנות ההון להשוואה</span></div><div className="cp-table-wrap"><table className="cp-table cp-annual-table"><thead><tr><th>סעיף והערה</th>{years.map(y => <th key={y}>{y}{!expectedYears.includes(y) ? ' *' : ''}</th>)}<th>ללא שיוך לשנה</th><th>סה״כ</th><th>מסמכים</th><th>בדיקת המשרד</th></tr></thead><tbody>{rows.map(row => { const linkedDocuments = state.docs.filter(document => document.worksheetRowId === row.id); return <tr key={row.id}><td><input aria-label={`תיאור ${row.id}`} value={row.label} onChange={e => updateRow(row.id, { label: e.target.value })} /><input className="cp-row-note-input" aria-label={`הערה ${row.id}`} value={row.note} placeholder="הערה לשורה…" onChange={e => updateRow(row.id, { note: e.target.value })} /></td>{years.map(y => <td key={y}><Cell value={row.values[y] ?? 0} label={`${row.label} ${y}`} onChange={n => updateRow(row.id, { values: { ...row.values, [y]: n } })} /></td>)}<td><Cell value={row.unallocated} label={`${row.label} ללא שיוך לשנה`} onChange={n => updateRow(row.id, { unallocated: n })} /></td><td className="cp-row-total" data-testid={`total-${row.id}`}>{plainNumber(rowTotal(row))}</td><td><div className="cp-row-documents">{linkedDocuments.map(document => <button type="button" className="cp-row-document" key={document.id} title={document.fileName ?? document.title} onClick={() => onOpenDocument(document.id)}><Paperclip size={13}/><span>{document.fileName ?? document.title}</span></button>)}<button type="button" className="cp-attach-row-document" aria-label={`צירוף מסמך לשורה ${row.label}`} onClick={() => onAttachDocument(row.id)}><Upload size={14}/>צירוף מסמך</button></div></td><td><label className="cp-check"><input type="checkbox" checked={row.verified} onChange={e => updateRow(row.id, { verified: e.target.checked })} />אושר</label></td></tr>})}</tbody><tfoot><tr><th>סה״כ {kind === 'use' ? 'שימושים' : 'מקורות'}</th>{years.map(y => <td key={y}>{plainNumber(rows.reduce((a, r) => a + (r.values[y] ?? 0), 0))}</td>)}<td>{plainNumber(rows.reduce((a, r) => a + r.unallocated, 0))}</td><td data-testid={`${kind}-total`}>{plainNumber(kind === 'use' ? c.uses : c.sources)}</td><td /><td /></tr></tfoot></table></div><button className="cp-text-btn cp-add-line" onClick={() => addRow(kind)}><Plus size={15} />הוספת {kind === 'use' ? 'שימוש' : 'מקור'}</button></section>
    })}
    <section className="cp-panel cp-annual-panel"><div className="cp-panel-head"><div><h2>הוצאות מחיה משוערות</h2><p>שלב נפרד אחרי חישוב היתרה למחיה — ללא כפל מול השימושים</p></div><CheckCheck size={20} /></div><div className="cp-table-wrap"><table className="cp-table cp-annual-table"><thead><tr><th>סעיף</th>{years.map(y => <th key={y}>{y}</th>)}<th>ללא שיוך לשנה</th><th>סה״כ</th></tr></thead><tbody><tr><td>אומדן מחיה משפחתי</td>{years.map(y => <td key={y}><Cell value={sheet.living[y] ?? 0} label={`הוצאות מחיה ${y}`} onChange={n => update({ living: { ...sheet.living, [y]: n }, livingVerified: false })} /></td>)}<td><Cell value={sheet.livingUnallocated} label="הוצאות מחיה ללא שיוך לשנה" onChange={n => update({ livingUnallocated: n, livingVerified: false })} /></td><td className="cp-row-total">{plainNumber(c.living)}</td></tr></tbody></table></div><label className="cp-check cp-living-check"><input type="checkbox" checked={sheet.livingVerified} onChange={e => update({ livingVerified: e.target.checked }, 'עודכן אישור אומדן הוצאות המחיה')} />בדקתי את אומדן המחיה, התקופה והרכב המשפחה</label><p className="cp-footnote">בצילום שהתקבל אומדן המחיה הוא אפס. בדגם זהו ערך זמני, ולא קביעה שלא היו הוצאות. הכנסות חייבות אינן בהכרח הכנסות נטו. ביטוח לאומי, מסים, ריבית ותיאומי רכב טעונים בדיקת טיפול וכפל רישום.</p></section>
  </>
}
