import { comparisonYears, reconcileWorksheet, type Worksheet } from './worksheet'

export type Section = 'property' | 'bank' | 'investments' | 'business' | 'movables' | 'liability'
export type DocStatus = 'missing' | 'uploaded' | 'extracted' | 'reviewed'
export interface CapitalLine { id: string; section: Section; label: string; owner: string; previous: number; current: number; docId: string; note: string }
export interface CapitalDocument { id: string; title: string; category: string; status: DocStatus; source: 'office' | 'client'; fileName?: string; confidence?: number; extracted?: number; targetId?: string; sample: boolean }
export interface FlowLine { id: string; label: string; kind: 'source' | 'use'; amount: number; verified: boolean; note: string }
export interface Draft { subject: string; body: string; channel: 'email' | 'whatsapp'; state: 'draft' | 'approved' | 'simulated'; approvedAt?: string }
export interface PersonalDetails { clientId: string; birthDate: string; maritalStatus: 'married' | 'single' | 'divorced' | 'widowed' | 'separated'; phone: string; address: string; spouseName: string; spouseId: string; spouseBirthDate: string }
export interface ChildDetails { id: string; name: string; identityNumber: string; birthDate: string }
export interface AnnexItem { id: string; label: string; selected: boolean; included: boolean }
export interface SignaturePackage { acknowledgementFileName: string; state: 'draft' | 'approved' | 'simulated'; approvedAt?: string }
export interface CapitalState { version: 1; client: string; email: string; previousDate: string; currentDate: string; filingDate: string; personal: PersonalDetails; children: ChildDetails[]; officeNotes: string; annexes: AnnexItem[]; signature: SignaturePackage; lines: CapitalLine[]; docs: CapitalDocument[]; flows: FlowLine[]; worksheet?: Worksheet; draft: Draft | null; log: string[] }
export const sections: Record<Section, string> = { property: 'נדל״ן', bank: 'בנקים ומזומנים', investments: 'חסכונות והשקעות', business: 'נכסים בעסק', movables: 'רכב ותכולה', liability: 'התחייבויות' }
export const statusLabels: Record<DocStatus, string> = { missing: 'חסר', uploaded: 'ממתין לקריאה', extracted: 'ממתין לבדיקה', reviewed: 'נבדק ואושר' }
export const currency = (n: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)
export function totals(lines: CapitalLine[]) {
  const sum = (date: 'previous' | 'current', liabilities: boolean) => lines.filter(l => (l.section === 'liability') === liabilities).reduce((a, l) => a + l[date], 0)
  const previousAssets = sum('previous', false), currentAssets = sum('current', false)
  const previousLiabilities = sum('previous', true), currentLiabilities = sum('current', true)
  const previousNet = previousAssets - previousLiabilities, currentNet = currentAssets - currentLiabilities
  return { previousAssets, currentAssets, previousLiabilities, currentLiabilities, previousNet, currentNet, growth: currentNet - previousNet }
}
export function compare(state: Pick<CapitalState, 'lines' | 'flows' | 'worksheet'>) {
  const t = totals(state.lines)
  if (state.worksheet) {
    const w = reconcileWorksheet(state.worksheet, t)
    return { ...t, ...w, uses: w.uses + w.living, available: w.sources - w.uses - w.living }
  }
  const sources = state.flows.filter(f => f.kind === 'source').reduce((a, f) => a + f.amount, 0)
  const uses = state.flows.filter(f => f.kind === 'use').reduce((a, f) => a + f.amount, 0)
  return { ...t, sources, uses, available: sources - uses, gap: t.growth + uses - sources }
}
export function findings(state: CapitalState) {
  const result: { title: string; detail: string; level: 'high' | 'medium' | 'info' }[] = []
  const c = compare(state)
  if (state.worksheet?.capitalSource === 'imported-summary') result.push({ title: 'סיכומי הון מצילום — ללא פירוט נכסים', detail: 'ההשוואה משתמשת בסיכומים שהוזנו מהמסמך, ולא בשורות ההצהרה שבדגם. יש להתאים לסיכומי ההצהרות המלאות לפני סגירת התיק.', level: 'medium' })
  if (state.worksheet && !state.worksheet.livingVerified) result.push({ title: 'אומדן הוצאות מחיה לא אושר', detail: 'היתרה למחיה אינה עודף סופי לפני בדיקת הוצאות המחיה. גם סכום אפס טעון הסבר ואישור.', level: 'high' })
  if (state.worksheet) {
    const years = comparisonYears(state.worksheet.previousDate, state.worksheet.currentDate)
    if (!years.length) result.push({ title: 'תקופת ההשוואה אינה תקינה', detail: 'יש לתקן תאריכים או תקופה ארוכה מ־50 שנים לפני אישור נייר העבודה.', level: 'high' })
    const outside = state.worksheet.rows.some(r => Object.entries(r.values).some(([y, n]) => n !== 0 && !years.includes(Number(y)))) || Object.entries(state.worksheet.living).some(([y, n]) => n !== 0 && !years.includes(Number(y)))
    if (outside) result.push({ title: 'סכומים משויכים לשנים מחוץ לתקופה', detail: 'הסכומים נשמרו בחישוב אך נדרשת בדיקת שיוך לפני אישור.', level: 'high' })
    if (state.worksheet.rows.some(r => r.unallocated !== 0) || state.worksheet.livingUnallocated !== 0) result.push({ title: 'סכומים ללא שיוך לשנת מס', detail: 'הסכומים התקופתיים נשמרו במלואם; יש להשלים פיזור לפי אסמכתאות ולא באופן אוטומטי.', level: 'medium' })
  }
  if (c.gap > 0) result.push({ title: 'גידול הון שטרם הוסבר', detail: `${currency(c.gap)}: יש לבדוק מקורות נוספים, הוצאות והשוואת בסיסי המדידה.`, level: 'high' })
  if (c.gap < 0) result.push({ title: 'עודף מקורות מול השימושים', detail: `${currency(-c.gap)}: יש לבדוק נכסים או שימושים שלא נכללו.`, level: 'medium' })
  state.docs.filter(d => d.status === 'missing').forEach(d => result.push({ title: d.title, detail: 'לא התקבל מסמך תומך. יש להשלים מול הלקוח לפני סגירת התיק.', level: 'high' }))
  state.docs.filter(d => d.status === 'extracted').forEach(d => result.push({ title: `בדיקת חילוץ: ${d.title}`, detail: 'הסכום המוצע טרם אושר בידי המשרד. חילוץ הדגם הוא סימולציה.', level: 'medium' }))
  const checkedRows = state.worksheet?.rows ?? state.flows
  checkedRows.filter(f => !f.verified).forEach(f => result.push({ title: `אסמכתה: ${f.label}`, detail: 'סכום נכלל בהשוואה כנתון זמני ללא אסמכתה מאושרת.', level: 'medium' }))
  if (state.currentDate <= state.previousDate) result.push({ title: 'סדר תאריכים שגוי', detail: 'תאריך ההצהרה הנוכחית חייב להיות מאוחר מקודמתה.', level: 'high' })
  if (state.filingDate && state.filingDate < state.currentDate) result.push({ title: 'תאריך הגשה מוקדם מתאריך ההצהרה', detail: 'יש לבדוק את תאריך ההצהרה ואת תאריך ההגשה לפני סגירת התיק.', level: 'high' })
  if (!state.personal.clientId || !state.personal.birthDate) result.push({ title: 'פרטים אישיים חסרים', detail: 'יש להשלים מספר זהות ותאריך לידה לפני הכנת חבילת החתימה.', level: 'high' })
  if (state.children.some(child => !child.name || !child.identityNumber || !child.birthDate)) result.push({ title: 'פרטי ילדים אינם מלאים', detail: 'יש להשלים שם, מספר זהות ותאריך לידה לכל ילד המופיע בתיק.', level: 'high' })
  const missingAnnexes = state.annexes.filter(item => item.selected && !item.included)
  if (missingAnnexes.length) result.push({ title: 'נספחים שסומנו ועדיין חסרים', detail: `${missingAnnexes.length} נספחים נבחרו לחבילת החתימה אך טרם סומנו כמוכנים.`, level: 'high' })
  result.push({ title: 'בסיס מדידה ואימות טופס', detail: 'הסכומים בדגם על בסיס עלות מדווחת; אין החלפה אוטומטית בשווי שוק. יש לאמת את מיפוי סעיפי טופס 1219 ואת כללי הדיווח לפני הגשה.', level: 'info' })
  return result
}
export function makeDraft(state: CapitalState, channel: Draft['channel']): Draft {
  const missing = state.docs.filter(d => d.status === 'missing')
  return { channel, state: 'draft', subject: `השלמת מסמכים להצהרת הון — ${state.client}`, body: `שלום ${state.client},\n\nלקראת הכנת הצהרת ההון ליום ${state.currentDate}, נבקש להשלים את המסמכים הבאים:\n${missing.length ? missing.map(d => `• ${d.title}`).join('\n') : '• הבהרות ואסמכתאות למקורות ולשימושים שטרם אושרו.'}\n\nאנא צרפו מסמכים המתייחסים למועד ההצהרה, לרבות נתוני בן/בת הזוג והילדים הרלוונטיים. ניתן לצרף דרך פורטל איסוף המסמכים של המשרד.\n\nתודה,\nעבדי בן גל — רואי חשבון` }
}
export function approvedDraft(draft: Draft): Draft { return { ...draft, state: 'approved', approvedAt: new Date().toISOString() } }
export function simulateSend(draft: Draft): Draft {
  if (draft.state !== 'approved') throw new Error('נדרש אישור משרד לפני הדמיית שליחה')
  return { ...draft, state: 'simulated' }
}
export function seedState(): CapitalState {
  return { version: 1, client: 'דניאל ומאיה לוי', email: 'client@example.com', previousDate: '2020-12-31', currentDate: '2025-12-31', filingDate: '2026-12-31',
    personal: { clientId: '012345678', birthDate: '1981-04-18', maritalStatus: 'married', phone: '050-0000000', address: 'רחוב הדוגמה 12, תל אביב', spouseName: 'מאיה לוי', spouseId: '987654321', spouseBirthDate: '1983-09-07' },
    children: [
      { id: 'child-1', name: 'עומר לוי', identityNumber: '000000001', birthDate: '2012-03-14' },
      { id: 'child-2', name: 'נועה לוי', identityNumber: '000000002', birthDate: '2017-11-02' },
    ],
    officeNotes: 'יש לעבור עם הלקוח על יתרות הבנק, עלות ניירות הערך והמתנה מההורים לפני הפקת החבילה הסופית.',
    annexes: [
      { id: 'annex-bank', label: 'אישורי יתרות בנקים ומזומנים ליום ההצהרה', selected: true, included: true },
      { id: 'annex-securities', label: 'אישורי ניירות ערך, חסכונות וקופות', selected: true, included: false },
      { id: 'annex-property', label: 'חוזי רכישה, אישורי זכויות ומסמכי נדל״ן', selected: true, included: true },
      { id: 'annex-loans', label: 'אישורי יתרות משכנתאות והלוואות', selected: true, included: false },
      { id: 'annex-vehicles', label: 'רישיונות רכב ומסמכי רכישה או מכירה', selected: true, included: false },
      { id: 'annex-business', label: 'מאזן, ספרי העסק וכרטסת הון בעלים', selected: true, included: true },
      { id: 'annex-insurance', label: 'פוליסות ביטוח וחיסכון בעלות ערך', selected: false, included: false },
      { id: 'annex-sources', label: 'אסמכתאות למתנות, ירושות ומקורות מיוחדים', selected: true, included: false },
      { id: 'annex-previous', label: 'הצהרת ההון הקודמת והנספחים הרלוונטיים', selected: true, included: true },
    ],
    signature: { acknowledgementFileName: 'file4_3203.pdf', state: 'draft' },
    lines: [
      { id: 'home', section: 'property', label: 'דירת מגורים · תל אביב', owner: 'בני הזוג', previous: 1850000, current: 1850000, docId: 'deed', note: 'עלות רכישה מדווחת; לא שווי שוק' },
      { id: 'bank', section: 'bank', label: 'חשבון עו״ש · בנק לדוגמה', owner: 'דניאל לוי', previous: 85000, current: 165000, docId: 'bankdoc', note: 'יתרה ליום ההצהרה' },
      { id: 'investment', section: 'investments', label: 'תיק השקעות וחסכונות', owner: 'מאיה לוי', previous: 140000, current: 325000, docId: 'investmentdoc', note: 'יש לאמת עלות ובסיס דיווח' },
      { id: 'business', section: 'business', label: 'הון בעסק · סטודיו לוי', owner: 'דניאל לוי', previous: 95000, current: 210000, docId: 'books', note: 'מאזן וספרי העסק; למנוע כפל מול נכסים פרטיים' },
      { id: 'car', section: 'movables', label: 'רכב משפחתי ותכולה', owner: 'בני הזוג', previous: 110000, current: 155000, docId: 'car-doc', note: 'עלות, לאחר התאמות ותיעוד רכישה ומכירה' },
      { id: 'mortgage', section: 'liability', label: 'יתרת משכנתה', owner: 'בני הזוג', previous: 920000, current: 690000, docId: 'mortgagedoc', note: 'יתרת קרן במועד ההצהרה' },
      { id: 'loan', section: 'liability', label: 'הלוואה בנקאית', owner: 'דניאל לוי', previous: 60000, current: 35000, docId: 'loandoc', note: 'יתרה, ללא כפל הוצאות או שימושים' },
    ],
    docs: [
      { id: 'deed', title: 'חוזה רכישת דירת מגורים', category: 'נדל״ן', status: 'reviewed', source: 'office', fileName: 'חוזה_רכישה_דוגמה.pdf', sample: true },
      { id: 'bankdoc', title: 'אישור יתרות בנק ליום ההצהרה', category: 'בנקים', status: 'uploaded', source: 'client', fileName: 'אישור_בנק_דוגמה.pdf', extracted: 165000, targetId: 'bank', confidence: 97, sample: true },
      { id: 'investmentdoc', title: 'אישור עלות ניירות ערך וחסכונות', category: 'השקעות', status: 'missing', source: 'client', sample: true },
      { id: 'books', title: 'מאזן בוחן וכרטסת הון בעלים', category: 'ספרי העסק', status: 'uploaded', source: 'office', fileName: 'מאזן_בוחן_דוגמה.xlsx', extracted: 210000, targetId: 'business', confidence: 86, sample: true },
      { id: 'car-doc', title: 'מסמכי רכישה ומכירה של הרכב', category: 'רכב', status: 'missing', source: 'client', sample: true },
      { id: 'mortgagedoc', title: 'אישור יתרת קרן משכנתה', category: 'התחייבויות', status: 'reviewed', source: 'client', fileName: 'משכנתה_דוגמה.pdf', sample: true },
      { id: 'loandoc', title: 'אישור יתרת הלוואה', category: 'התחייבויות', status: 'missing', source: 'client', sample: true },
      { id: 'gift', title: 'אסמכתה למתנה מההורים', category: 'מקורות הון', status: 'missing', source: 'client', sample: true },
    ],
    flows: [
      { id: 'income', label: 'הכנסות נטו מדווחות בתקופה', kind: 'source', amount: 1650000, verified: true, note: 'דוגמה: לאחר מסים; למנוע ניכוי כפול של המס' },
      { id: 'giftflow', label: 'מתנה מההורים', kind: 'source', amount: 150000, verified: false, note: 'נדרשים תיעוד העברה והסבר מקור' },
      { id: 'living', label: 'הוצאות מחיה משפחתיות', kind: 'use', amount: 970000, verified: false, note: 'אומדן זמני; יש להתאים להרכב המשפחה ולתקופה' },
      { id: 'other', label: 'הוצאות נוספות שאינן מגולמות בהון', kind: 'use', amount: 160000, verified: true, note: 'דוגמה בלבד: נסיעות, תמיכות והוצאות מיוחדות; ללא כפל עם מחיה' },
    ], draft: null, log: ['נפתח תיק הדגמה • לא מחובר לנתוני לקוחות אמיתיים'] }
}
export const STORAGE_KEY = 'abady-capital-prototype-v1'
export function loadState(): CapitalState {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (s?.version === 1 && Array.isArray(s.lines) && Array.isArray(s.docs) && Array.isArray(s.flows)) {
      const defaults = seedState()
      return { ...defaults, ...s, filingDate: s.filingDate ?? defaults.filingDate, personal: { ...defaults.personal, ...s.personal }, children: Array.isArray(s.children) ? s.children : defaults.children, annexes: Array.isArray(s.annexes) ? s.annexes : defaults.annexes, signature: { ...defaults.signature, ...s.signature }, officeNotes: s.officeNotes ?? defaults.officeNotes }
    }
  } catch { /* fall back to demo */ }
  return seedState()
}

