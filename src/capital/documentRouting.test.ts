import { describe, expect, it } from 'vitest'
import { inferForm1219Entry } from './documentRouting'
import type { Form1219Entry } from './form1219'

const entry = (id: string, code: number): Form1219Entry => ({ id, code, description: id, note: '', owner: 'taxpayer', amount: 0, acquiredAt: '', currency: 'ILS', foreignAmount: 0, documentId: '' })
const entries = [entry('bank-row', 30), entry('car-row', 90), entry('business-row', 300)]

describe('automatic document routing', () => {
  it('routes recognizable client filenames to the matching declaration row', () => {
    expect(inferForm1219Entry('אישור_בנק_2025.pdf', entries)?.id).toBe('bank-row')
    expect(inferForm1219Entry('car-license.pdf', entries)?.id).toBe('car-row')
    expect(inferForm1219Entry('מאזן_בוחן.xlsx', entries)?.id).toBe('business-row')
  })

  it('leaves an unknown filename for office review', () => {
    expect(inferForm1219Entry('scan-001.pdf', entries)).toBeUndefined()
  })
})
