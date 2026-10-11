import type { CapitalDocument, CapitalState } from './model'
import type { AnnualRow } from './worksheet'

export type DocumentDestination = { value: string; label: string; group: 'declaration' | 'comparison' }

export function comparisonRows(state: CapitalState): AnnualRow[] {
  if (state.worksheet) return state.worksheet.rows
  return state.flows.filter(flow => flow.id !== 'living').map(flow => ({ ...flow, values: {}, unallocated: flow.amount }))
}

export function documentDestinations(state: CapitalState): DocumentDestination[] {
  return [
    ...state.form1219Entries.map(entry => ({ value: `form:${entry.id}`, label: `הצהרת הון · קוד ${entry.code} · ${entry.description}`, group: 'declaration' as const })),
    ...comparisonRows(state).map(row => ({ value: `worksheet:${row.id}`, label: `השוואת הון · ${row.kind === 'source' ? 'מקור' : 'שימוש'} · ${row.label}`, group: 'comparison' as const })),
  ]
}

export function documentDestination(document: CapitalDocument): string {
  if (document.worksheetRowId) return `worksheet:${document.worksheetRowId}`
  if (document.form1219EntryId) return `form:${document.form1219EntryId}`
  return ''
}

export function proposedDocumentAmount(state: CapitalState, document: CapitalDocument): number {
  if (document.extracted !== undefined) return document.extracted
  if (document.form1219EntryId) return state.form1219Entries.find(entry => entry.id === document.form1219EntryId)?.amount ?? 0
  if (document.worksheetRowId) {
    const row = comparisonRows(state).find(candidate => candidate.id === document.worksheetRowId)
    return row ? Object.values(row.values).reduce((sum, value) => sum + value, row.unallocated) : 0
  }
  return 0
}

export function setDocumentDestination(state: CapitalState, documentId: string, destination: string): CapitalState {
  const [kind, id] = destination.split(':', 2)
  const target = documentDestinations(state).find(candidate => candidate.value === destination)
  return {
    ...state,
    docs: state.docs.map(document => document.id === documentId ? {
      ...document,
      form1219EntryId: kind === 'form' ? id : undefined,
      worksheetRowId: kind === 'worksheet' ? id : undefined,
      routingState: target ? 'suggested' : 'unassigned',
      routingNote: target ? `יעד הסיווג שונה לפי הוראת המשרד: ${target.label}. נדרש אישור להעברה.` : 'המסמך הוסר מהיעד וממתין לסיווג.',
      status: document.status === 'reviewed' ? (document.extracted !== undefined ? 'extracted' : 'uploaded') : document.status,
    } : document),
  }
}

export function setDocumentAmount(state: CapitalState, documentId: string, amount: number): CapitalState {
  return {
    ...state,
    docs: state.docs.map(document => document.id === documentId ? {
      ...document,
      extracted: Math.max(0, amount),
      status: 'extracted',
      routingState: documentDestination(document) ? 'suggested' : 'unassigned',
      routingNote: 'הסכום עודכן בידי המשרד ונדרש אישור לפני העברה.',
    } : document),
  }
}

export function approveDocumentProposal(state: CapitalState, documentId: string): CapitalState {
  const document = state.docs.find(candidate => candidate.id === documentId)
  if (!document || document.status === 'missing') return state
  const destination = documentDestination(document)
  if (!destination) return state
  const amount = proposedDocumentAmount(state, document)
  const [kind, id] = destination.split(':', 2)
  const target = documentDestinations(state).find(candidate => candidate.value === destination)
  let next: CapitalState = {
    ...state,
    docs: state.docs.map(candidate => candidate.id === documentId ? {
      ...candidate,
      status: 'reviewed',
      routingState: 'confirmed',
      routingNote: `המשרד אישר את הסיווג וההעברה: ${target?.label ?? destination}.`,
    } : candidate),
  }
  if (amount <= 0) return next
  if (kind === 'form') {
    const targetEntry = next.form1219Entries.find(entry => entry.id === id)
    next = {
      ...next,
      form1219Entries: next.form1219Entries.map(entry => entry.id === id ? { ...entry, amount } : entry),
      lines: targetEntry?.documentId ? next.lines.map(line => line.docId === targetEntry.documentId ? { ...line, current: amount } : line) : next.lines,
    }
  } else if (kind === 'worksheet') {
    if (next.worksheet) {
      next = { ...next, worksheet: { ...next.worksheet, rows: next.worksheet.rows.map(row => row.id === id ? { ...row, unallocated: amount, verified: true } : row) }, flows: next.flows.map(flow => flow.id === id ? { ...flow, amount, verified: true } : flow) }
    } else {
      next = { ...next, flows: next.flows.map(flow => flow.id === id ? { ...flow, amount, verified: true } : flow) }
    }
  }
  return next
}

export function approveAllDocumentProposals(state: CapitalState): { state: CapitalState; approved: number; skipped: number } {
  const candidates = state.docs.filter(document => document.status !== 'missing' && document.status !== 'reviewed')
  let next = state
  let approved = 0
  let skipped = 0
  for (const document of candidates) {
    if (!documentDestination(document)) { skipped += 1; continue }
    next = approveDocumentProposal(next, document.id)
    approved += 1
  }
  return { state: next, approved, skipped }
}
