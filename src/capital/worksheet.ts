export interface AnnualRow {
  id: string
  label: string
  kind: 'source' | 'use'
  values: Record<string, number>
  unallocated: number
  verified: boolean
  note: string
}
export interface Worksheet {
  capitalSource: 'declaration' | 'imported-summary'
  previousNet: number
  currentNet: number
  previousDate: string
  currentDate: string
  rows: AnnualRow[]
  living: Record<string, number>
  livingUnallocated: number
  livingVerified: boolean
  origin: string
}
export function comparisonYears(previousDate: string, currentDate: string): number[] {
  const start = Number(previousDate.slice(0, 4)), end = Number(currentDate.slice(0, 4))
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1900 || end < start || end - start > 50 || previousDate >= currentDate) return []
  // Include a partial opening year unless the opening declaration is at year end.
  const first = previousDate.endsWith('-12-31') ? start + 1 : start
  return Array.from({ length: end - first + 1 }, (_, i) => first + i)
}
export const rowTotal = (row: AnnualRow) => Object.values(row.values).reduce((a, n) => a + n, row.unallocated)
export function reconcileWorksheet(sheet: Worksheet, declaration: { previousNet: number; currentNet: number }) {
  const previousNet = sheet.capitalSource === 'declaration' ? declaration.previousNet : sheet.previousNet
  const currentNet = sheet.capitalSource === 'declaration' ? declaration.currentNet : sheet.currentNet
  const growth = currentNet - previousNet
  const uses = sheet.rows.filter(r => r.kind === 'use').reduce((a, r) => a + rowTotal(r), 0)
  const sources = sheet.rows.filter(r => r.kind === 'source').reduce((a, r) => a + rowTotal(r), 0)
  const requiredBeforeLiving = growth + uses
  const availableForLiving = sources - requiredBeforeLiving
  const living = Object.values(sheet.living).reduce((a, n) => a + n, sheet.livingUnallocated)
  const surplus = availableForLiving - living
  return { previousNet, currentNet, growth, uses, sources, requiredBeforeLiving, availableForLiving, living, surplus, gap: -surplus }
}
export function officeExample(): Worksheet {
  const row = (id: string, label: string, kind: AnnualRow['kind'], values: number[], note: string): AnnualRow => ({ id, label, kind, values: Object.fromEntries([2012, 2013, 2014, 2015].map((y, i) => [y, values[i]])), unallocated: 0, verified: false, note })
  return {
    capitalSource: 'imported-summary', previousNet: 881976, currentNet: 1079828,
    previousDate: '2011-12-31', currentDate: '2015-12-31',
    origin: 'הועתק ידנית מצילום השוואת ההון שצורף. סיכומי הון בלבד; אין בצילום פירוט נכסים והתחייבויות.',
    rows: [
      row('ni-husband', 'ביטוח לאומי בעל ששולם', 'use', [4203, 2588, 3321, 2653], 'יש לבדוק מול אישורים ולמנוע כפל מול ההכנסה המדווחת.'),
      row('ni-wife', 'ביטוח לאומי אשה ששולם', 'use', [11132, 4538, 6900, 5127], 'יש לבדוק אם הסכום נוכה כבר בחישוב ההכנסה.'),
      row('car-adjustment', 'תיאום רכב', 'use', [15174, 7043, 11464, 11543], 'התווסף כשימוש בהתאם למסמך המצורף; הטיפול והכפל דורשים בדיקת המשרד.'),
      row('mortgage-interest', 'ריבית משכנתא', 'use', [26000, 26000, 26000, 26624], 'ריבית בלבד בהתאם לצילום; אין להוסיף שוב החזר קרן המגולם בשינוי ההון.'),
      row('reported-income', 'הכנסות חייבות במס כפי שדווחו בדוחות', 'source', [106338, 93254, 94514, 92562], 'הכנסה חייבת כפי שמופיעה בצילום, לא הומרה להכנסה נטו. יש לבדוק מסים והתאמות.'),
      row('disability', 'קצבת נכות ב״ל', 'source', [0, 0, 49500, 54000], 'תאים ריקים בצילום הוזנו כאפס לחישוב הדוגמה בלבד; יש לאמת מול האישורים.'),
      row('children', 'קצבת ילדים (4 ילדים + מענק)', 'source', [13476, 11473, 6720, 7952], 'הסכומים הועתקו מהצילום; נוסח ההערה דורש אימות מול המקור.'),
    ], living: { 2012: 0, 2013: 0, 2014: 0, 2015: 0 }, livingUnallocated: 0, livingVerified: false,
  }
}
export function worksheetText(sheet: Worksheet, declaration: { previousNet: number; currentNet: number }): string {
  const c = reconcileWorksheet(sheet, declaration)
  const years = comparisonYears(sheet.previousDate, sheet.currentDate)
  const orderedRows = [...sheet.rows].sort((a, b) => Number(b.kind === 'source') - Number(a.kind === 'source'))
  return `השוואת הצהרות הון — דגם בלבד\n${sheet.previousDate} — ${sheet.currentDate}\nמקור: ${sheet.origin}\n\nרכוש נקי נוכחי: ${c.currentNet}\nרכוש נקי קודם: ${c.previousNet}\nגידול בהון: ${c.growth}\nהוסף שימושים: ${c.uses}\nסכום הטעון הסבר לפני הוצאות מחיה: ${c.requiredBeforeLiving}\nהפחת מקורות: ${c.sources}\nיתרה שנשארה להוצאות מחיה: ${c.availableForLiving}\nהפחת הוצאות מחיה משוערות: ${c.living}\n${c.surplus >= 0 ? 'עודף הון' : 'חוסר הון'}: ${Math.abs(c.surplus)}\n\nפירוט שנתי — מקורות לפני שימושים:\nסעיף | ${years.join(' | ')} | ללא שיוך לשנה | סה״כ\n${orderedRows.map(r => `${r.kind === 'use' ? 'שימוש' : 'מקור'}: ${r.label} | ${years.map(y => r.values[y] ?? 0).join(' | ')} | ${r.unallocated} | ${rowTotal(r)}`).join('\n')}\nמחיה | ${years.map(y => sheet.living[y] ?? 0).join(' | ')} | ${sheet.livingUnallocated} | ${c.living}\n\nהסכומים והאסמכתאות טעונים בדיקת המשרד. אין זו הצהרה רשמית או אישור מקצועי. מחיה בסכום אפס אינה מוכיחה שלא היו הוצאות. סיכומים שהועתקו מצילום אינם מחליפים פירוט נכסים.\n`
}
