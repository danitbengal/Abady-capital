export const form1219Lines = [
  { code: 10, part: 'A', label: 'נדל״ן בארץ' },
  { code: 20, part: 'A', label: 'נדל״ן בחו״ל' },
  { code: 30, part: 'A', label: 'חשבונות בבנקים ובמוסדות כספיים' },
  { code: 40, part: 'A', label: 'נכסים דיגיטליים' },
  { code: 50, part: 'A', label: 'מזומנים' },
  { code: 60, part: 'A', label: 'ביטוח חיים, קופות ותכניות חיסכון' },
  { code: 70, part: 'A', label: 'ניירות ערך וקרנות נאמנות' },
  { code: 80, part: 'A', label: 'חייבים והלוואות שנתתי' },
  { code: 90, part: 'A', label: 'כלי תחבורה' },
  { code: 100, part: 'A', label: 'תכשיטים, זהב, יהלומים, אספנות ואמנות' },
  { code: 110, part: 'A', label: 'תכולת בית' },
  { code: 120, part: 'A', label: 'רכוש אחר' },
  { code: 130, part: 'A', label: 'התחייבויות לבנקים ומוסדות כספיים' },
  { code: 140, part: 'A', label: 'הלוואות שלקחתי מאחרים' },
  { code: 300, part: 'B', label: 'יתרת הון בעסק' },
  { code: 310, part: 'B', label: 'יתרת חו״ז בעסק' },
  { code: 320, part: 'B', label: 'הלוואות שנתתי לעסק' },
  { code: 330, part: 'B', label: 'הלוואות שלקחתי מהעסק' },
  { code: 350, part: 'B', label: 'יתרת הון בשותפות' },
  { code: 360, part: 'B', label: 'יתרת חו״ז בשותפות' },
  { code: 370, part: 'B', label: 'הלוואות שנתתי לשותפות' },
  { code: 380, part: 'B', label: 'הלוואות שלקחתי מהשותפות' },
  { code: 400, part: 'B', label: 'יתרת הון בחברה או תאגיד' },
  { code: 410, part: 'B', label: 'יתרת חו״ז בחברה או תאגיד' },
  { code: 420, part: 'B', label: 'הלוואות לחברה ותשלום על מניות' },
  { code: 430, part: 'B', label: 'הלוואות שלקחתי מהחברה' },
  { code: 450, part: 'B', label: 'השקעות נוספות לפי נספחים' },
  { code: 500, part: 'C', label: 'מזומנים והמחאות בקופה' },
  { code: 510, part: 'C', label: 'שטרות והמחאות לקבל' },
  { code: 520, part: 'C', label: 'כרטיסי אשראי' },
  { code: 530, part: 'C', label: 'לקוחות' },
  { code: 550, part: 'C', label: 'מלאי' },
  { code: 560, part: 'C', label: 'רכוש שוטף אחר' },
  { code: 570, part: 'C', label: 'בנקים ומוסדות כספיים' },
  { code: 580, part: 'C', label: 'ניירות ערך וקרנות נאמנות' },
  { code: 590, part: 'C', label: 'הלוואות שנתן העסק וחייבים אחרים' },
  { code: 600, part: 'C', label: 'נכסים דיגיטליים בעסק' },
  { code: 610, part: 'C', label: 'נדל״ן בארץ בעסק' },
  { code: 620, part: 'C', label: 'נדל״ן בחו״ל בעסק' },
  { code: 630, part: 'C', label: 'כלי תחבורה וציוד כבד' },
  { code: 640, part: 'C', label: 'מכונות, ציוד, מכשירים וריהוט' },
  { code: 650, part: 'C', label: 'רכוש קבוע אחר' },
  { code: 660, part: 'C', label: 'תשלומים על חשבון רכוש קבוע' },
  { code: 680, part: 'C', label: 'חובות לספקים' },
  { code: 690, part: 'C', label: 'שטרות והמחאות לפירעון' },
  { code: 710, part: 'C', label: 'הלוואות מבנקים ומוסדות כספיים' },
  { code: 720, part: 'C', label: 'הלוואות מאחרים והתחייבויות אחרות' },
  { code: 760, part: 'C', label: 'חלקי בעסקים נוספים ללא מאזן' },
] as const

export type Form1219Input = Partial<Record<number, number>>
export type Form1219Owner = 'taxpayer' | 'spouse' | 'joint' | 'child'
export interface Form1219Entry {
  id: string
  code: number
  description: string
  owner: Form1219Owner
  amount: number
  acquiredAt: string
  currency: string
  foreignAmount: number
  documentId: string
}
export interface Form1219Disclosures {
  safeDepositBoxes: boolean
  safeDepositDetails: string
  powersOfAttorney: boolean
  powersOfAttorneyDetails: string
  propertyForOthers: boolean
  propertyForOthersDetails: string
  previousDeclarationFiled: boolean
  previousDeclarationDate: string
}
export type Form1219Totals = Record<200 | 210 | 220 | 340 | 390 | 440 | 460 | 540 | 670 | 700 | 730 | 740 | 750 | 770 | 800, number>

const sum = (values: Form1219Input, codes: readonly number[]) => codes.reduce((total, code) => total + (values[code] ?? 0), 0)

export function calculateForm1219(values: Form1219Input, sharePercent = 100): Form1219Totals {
  const total200 = sum(values, [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120])
  const total210 = sum(values, [130, 140])
  const total340 = sum(values, [300, 310, 320]) - (values[330] ?? 0)
  const total390 = sum(values, [350, 360, 370]) - (values[380] ?? 0)
  const total440 = sum(values, [400, 410, 420]) - (values[430] ?? 0)
  const total540 = sum(values, [500, 510, 520, 530])
  const total670 = total540 + sum(values, [550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660])
  const total700 = sum(values, [680, 690])
  const total730 = total700 + sum(values, [710, 720])
  const total740 = total670 - total730
  const safeShare = Math.min(100, Math.max(0, sharePercent))
  const total750 = total740 * safeShare / 100
  const total460 = total340 + total390 + total440 + (values[450] ?? 0)
  const total770 = total750 + (values[760] ?? 0)
  return {
    200: total200,
    210: total210,
    220: total200 - total210,
    340: total340,
    390: total390,
    440: total440,
    460: total460,
    540: total540,
    670: total670,
    700: total700,
    730: total730,
    740: total740,
    750: total750,
    770: total770,
    800: total200 - total210 + total460 + total770,
  }
}

export function valuesFromEntries(entries: Form1219Entry[]): Form1219Input {
  return entries.reduce<Form1219Input>((values, entry) => {
    values[entry.code] = (values[entry.code] ?? 0) + entry.amount
    return values
  }, {})
}
