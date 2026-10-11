import { describe, expect, it } from 'vitest'
import { approvedDraft, compare, findings, makeDraft, seedState, simulateSend, totals } from './model'

describe('capital reconciliation', () => {
  it('subtracts liabilities and explains growth through sources and uses', () => {
    const result = compare(seedState())
    expect(result.previousNet).toBe(1300000)
    expect(result.currentNet).toBe(1980000)
    expect(result.growth).toBe(680000)
    expect(result.sources).toBe(1800000)
    expect(result.uses).toBe(1130000)
    expect(result.gap).toBe(10000)
  })
  it('treats liabilities as a reduction, including negative net worth', () => {
    const lines = seedState().lines.filter(l => l.id === 'bank' || l.id === 'mortgage')
    expect(totals(lines).currentNet).toBe(-525000)
  })
  it('recalculates the gap when a source is added and flags surplus sources', () => {
    const state = seedState()
    state.flows.push({ id: 'new-source', label: 'additional source', kind: 'source', amount: 20000, verified: true, note: '' })
    expect(compare(state).gap).toBe(-10000)
    expect(findings(state).some(i => i.title === 'עודף מקורות מול השימושים')).toBe(true)
  })
  it('does not treat a balanced comparison as professionally verified', () => {
    const state = seedState()
    state.flows[0].amount += 10000
    expect(compare(state).gap).toBe(0)
    expect(findings(state).some(i => i.title.includes('אסמכתה'))).toBe(true)
    expect(findings(state).some(i => i.title === 'בסיס מדידה ואימות טופס')).toBe(true)
  })
  it('flags reversed declaration dates', () => {
    const state = seedState()
    state.currentDate = '2019-12-31'
    expect(findings(state).some(i => i.title === 'סדר תאריכים שגוי')).toBe(true)
  })
  it('flags a filing date before the declaration date', () => {
    const state = seedState()
    state.filingDate = '2025-01-01'
    expect(findings(state).some(i => i.title === 'תאריך הגשה מוקדם מתאריך ההצהרה')).toBe(true)
  })
  it('flags missing personal details, children details and selected annexes', () => {
    const state = seedState()
    state.personal.clientId = ''
    state.children[0].birthDate = ''
    expect(findings(state).some(i => i.title === 'פרטים אישיים חסרים')).toBe(true)
    expect(findings(state).some(i => i.title === 'פרטי ילדים אינם מלאים')).toBe(true)
    expect(findings(state).some(i => i.title === 'נספחים שסומנו ועדיין חסרים')).toBe(true)
  })
})

describe('client correspondence approval', () => {
  it('lists only missing documents in the draft', () => {
    const state = seedState()
    const draft = makeDraft(state, 'email')
    expect(draft.body).toContain('אסמכתה למתנה מההורים')
    expect(draft.body).not.toContain('חוזה רכישת דירת מגורים')
    expect(draft.state).toBe('draft')
  })
  it('rejects sending without approval and after a completed simulation', () => {
    const draft = makeDraft(seedState(), 'whatsapp')
    expect(() => simulateSend(draft)).toThrow('נדרש אישור משרד')
    const approved = approvedDraft(draft)
    expect(approved.approvedAt).toBeTruthy()
    const sent = simulateSend(approved)
    expect(sent.state).toBe('simulated')
    expect(() => simulateSend(sent)).toThrow('נדרש אישור משרד')
  })
})
