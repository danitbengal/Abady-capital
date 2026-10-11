import type { Form1219Entry } from './form1219'

const keywordCodes: { words: string[]; code: number }[] = [
  { words: ['בנק', 'bank', 'עו״ש', 'עוש'], code: 30 },
  { words: ['משכנת', 'mortgage'], code: 130 },
  { words: ['רכב', 'vehicle', 'car'], code: 90 },
  { words: ['ניירות', 'השקעות', 'securities', 'investment'], code: 70 },
  { words: ['דירה', 'נדלן', 'נדל״ן', 'property', 'חוזה'], code: 10 },
  { words: ['מאזן', 'עסק', 'balance'], code: 300 },
]

export function inferForm1219Entry(fileName: string, entries: Form1219Entry[]): Form1219Entry | undefined {
  const normalized = fileName.toLowerCase()
  const match = keywordCodes.find(rule => rule.words.some(word => normalized.includes(word)))
  return match ? entries.find(entry => entry.code === match.code) : undefined
}
