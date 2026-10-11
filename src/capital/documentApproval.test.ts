import { describe, expect, it } from 'vitest'
import { approveAllDocumentProposals, approveDocumentProposal, setDocumentDestination, setDocumentAmount } from './documentApproval'
import { seedState } from './model'

describe('document proposal approval', () => {
  it('moves the approved amount into a Form 1219 entry', () => {
    let state = seedState()
    state = setDocumentAmount(state, 'bankdoc', 171000)
    state = approveDocumentProposal(state, 'bankdoc')
    expect(state.form1219Entries.find(entry => entry.id === '1219-bank')?.amount).toBe(171000)
    expect(state.lines.find(line => line.id === 'bank')?.current).toBe(171000)
    expect(state.docs.find(document => document.id === 'bankdoc')?.status).toBe('reviewed')
  })

  it('accepts a changed destination and moves the amount into the comparison', () => {
    let state = seedState()
    state = setDocumentDestination(state, 'bankdoc', 'worksheet:giftflow')
    state = setDocumentAmount(state, 'bankdoc', 175000)
    state = approveDocumentProposal(state, 'bankdoc')
    expect(state.flows.find(flow => flow.id === 'giftflow')?.amount).toBe(175000)
    expect(state.flows.find(flow => flow.id === 'giftflow')?.verified).toBe(true)
    expect(state.docs.find(document => document.id === 'bankdoc')?.worksheetRowId).toBe('giftflow')
  })

  it('approves all classified pending documents and skips unclassified ones', () => {
    const state = seedState()
    state.docs.push({ id: 'unclassified', title: 'מסמך לא מזוהה', category: 'לבדיקה', status: 'uploaded', source: 'office', routingState: 'unassigned', sample: false })
    const result = approveAllDocumentProposals(state)
    expect(result.approved).toBeGreaterThan(0)
    expect(result.skipped).toBe(1)
    expect(result.state.docs.find(document => document.id === 'unclassified')?.status).toBe('uploaded')
  })
})
