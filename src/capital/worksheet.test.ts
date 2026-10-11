import { describe, expect, it } from 'vitest'
import { comparisonYears, officeExample, reconcileWorksheet, rowTotal, worksheetText } from './worksheet'

describe('office comparison worksheet', () => {
  const unrelatedDeclaration = { previousNet: 1300000, currentNet: 1980000 }
  it('reproduces every subtotal and the positive surplus in the supplied image', () => {
    const result = reconcileWorksheet(officeExample(), unrelatedDeclaration)
    expect(result.previousNet).toBe(881976)
    expect(result.currentNet).toBe(1079828)
    expect(result.growth).toBe(197852)
    expect(result.uses).toBe(190310)
    expect(result.requiredBeforeLiving).toBe(388162)
    expect(result.sources).toBe(529789)
    expect(result.availableForLiving).toBe(141627)
    expect(result.living).toBe(0)
    expect(result.surplus).toBe(141627)
    expect(result.gap).toBe(-141627)
  })
  it('reproduces the annual row totals', () => {
    expect(officeExample().rows.map(rowTotal)).toEqual([12765, 27697, 45224, 104624, 386668, 103500, 39621])
  })
  it('recalculates row totals and surplus after editing a single year', () => {
    const sheet = officeExample()
    sheet.rows[0].values[2015] += 1000
    expect(rowTotal(sheet.rows[0])).toBe(13765)
    expect(reconcileWorksheet(sheet, unrelatedDeclaration).surplus).toBe(140627)
  })
  it('deducts living separately and reports a shortfall with the correct sign', () => {
    const sheet = officeExample()
    sheet.living[2012] = 150000
    const result = reconcileWorksheet(sheet, unrelatedDeclaration)
    expect(result.availableForLiving).toBe(141627)
    expect(result.surplus).toBe(-8373)
    expect(result.gap).toBe(8373)
  })
  it('uses declaration totals only when that source is explicitly selected', () => {
    const sheet = officeExample()
    sheet.capitalSource = 'declaration'
    expect(reconcileWorksheet(sheet, unrelatedDeclaration).growth).toBe(680000)
  })
  it('includes unallocated and out-of-range amounts without losing them', () => {
    const sheet = officeExample()
    sheet.rows[0].unallocated = 100
    sheet.rows[0].values[2016] = 300
    expect(reconcileWorksheet(sheet, unrelatedDeclaration).uses).toBe(190710)
  })
  it('selects the years after the opening year-end and handles partial years', () => {
    expect(comparisonYears('2011-12-31', '2015-12-31')).toEqual([2012, 2013, 2014, 2015])
    expect(comparisonYears('2011-06-30', '2012-03-31')).toEqual([2011, 2012])
    expect(comparisonYears('2015-12-31', '2011-12-31')).toEqual([])
  })
  it('exports annual rows and the correct surplus rather than a positive shortfall', () => {
    const report = worksheetText(officeExample(), unrelatedDeclaration)
    expect(report).toContain('עודף הון: 141627')
    expect(report).toContain('שימוש: ביטוח לאומי בעל ששולם | 4203 | 2588 | 3321 | 2653 | 0 | 12765')
    expect(report).toContain('מחיה בסכום אפס אינה מוכיחה שלא היו הוצאות')
  })
})
