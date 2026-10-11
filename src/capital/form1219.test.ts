import { describe, expect, it } from 'vitest'
import { calculateForm1219, form1219Lines, valuesFromEntries, type Form1219Entry } from './form1219'

describe('official Form 1219 calculation map', () => {
  it('contains every editable amount code needed by totals 200 through 800', () => {
    expect(form1219Lines.map(line => line.code)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140,
      300, 310, 320, 330, 350, 360, 370, 380, 400, 410, 420, 430, 450,
      500, 510, 520, 530, 550, 560, 570, 580, 590, 600, 610, 620, 630,
      640, 650, 660, 680, 690, 710, 720, 760,
    ])
  })

  it('calculates the official private and balanced-business totals', () => {
    const totals = calculateForm1219({
      10: 100, 20: 20, 30: 30, 40: 40, 50: 50, 60: 60, 70: 70, 80: 80, 90: 90, 100: 10, 110: 11, 120: 12,
      130: 25, 140: 15,
      300: 100, 310: 20, 320: 30, 330: 10,
      350: 50, 360: 10, 370: 20, 380: 5,
      400: 200, 410: 40, 420: 30, 430: 20, 450: 7,
    })
    expect(totals[200]).toBe(573)
    expect(totals[210]).toBe(40)
    expect(totals[220]).toBe(533)
    expect(totals[340]).toBe(140)
    expect(totals[390]).toBe(75)
    expect(totals[440]).toBe(250)
    expect(totals[460]).toBe(472)
  })

  it('calculates unbalanced business, ownership share and total net property', () => {
    const totals = calculateForm1219({
      10: 1000, 130: 200,
      300: 100,
      500: 10, 510: 20, 520: 30, 530: 40,
      550: 50, 560: 60, 570: -20, 580: 80, 590: 90, 600: 100,
      610: 110, 620: 120, 630: 130, 640: 140, 650: 150, 660: 160,
      680: 30, 690: 20, 710: 100, 720: 50, 760: 25,
    }, 50)
    expect(totals[540]).toBe(100)
    expect(totals[670]).toBe(1270)
    expect(totals[700]).toBe(50)
    expect(totals[730]).toBe(200)
    expect(totals[740]).toBe(1070)
    expect(totals[750]).toBe(535)
    expect(totals[770]).toBe(560)
    expect(totals[800]).toBe(1460)
  })

  it('combines separate items that belong to the same official code', () => {
    const entry = (id: string, code: number, amount: number): Form1219Entry => ({ id, code, amount, description: id, note: '', owner: 'taxpayer', acquiredAt: '', currency: 'ILS', foreignAmount: 0, documentId: '' })
    expect(valuesFromEntries([entry('account-1', 30, 120), entry('account-2', 30, 80), entry('car', 90, 50)])).toEqual({ 30: 200, 90: 50 })
  })
})
