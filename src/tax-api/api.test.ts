import { describe,expect,it,vi } from 'vitest'
import { seedState } from '../capital/model'
import { asObject,confirmEmptySections,createApiDraft,draftIssues,payloadHash,projectPayload,readyPayload,sourceSnapshot,validatePayload } from './payload'
import { interpretResponse,transmitApprovedPayload } from './transport'
import { endpoints } from './schema'

function fixture(){
  const state=seedState();state.form1219Entries=[];state.personal.clientId='000000018';state.personal.maritalStatus='single'
  state.form1219Disclosures={...state.form1219Disclosures,safeDepositBoxes:false,powersOfAttorney:false,propertyForOthers:false}
  const draft=createApiDraft(state);draft.payload=asObject(confirmEmptySections(draft.payload));draft.emptyReviewed=true;draft.directoriesReviewed=true
  asObject(draft.payload.details).representativeIdNumber=0
  Object.assign(asObject(draft.payload.submit),{rightDeclaration:true,asstsCmmtsDeclaration:true})
  return {state,draft}
}
describe('CapitalDeclarationFull contract',()=>{
  it('generates an explicit full declaration, uses UTC dates and preserves no internal notes',()=>{
    const {state,draft}=fixture();state.officeNotes='INTERNAL';state.docs[0].officeNote='PRIVATE'
    expect(draftIssues(state,draft)).toEqual([])
    const payload=readyPayload(state,draft)
    expect(asObject(payload.details).dochToDayDate).toBe('2025-12-31T00:00:00Z')
    expect(JSON.stringify(payload)).not.toMatch(/INTERNAL|PRIVATE|officeNote|documentId|worksheet|sourceSnapshot/)
    expect(Object.keys(payload)).toEqual(['details','prvAssetCommt','allBusinessesWithBalance','allBusinessesWithOutBalance','pwrAttrny','submit'])
  })
  it('requires review of empty categories and directories rather than inventing data',()=>{
    const draft=createApiDraft(seedState())
    expect(validatePayload(draft.payload).some(issue=>issue.path.endsWith('.city'))).toBe(true)
    expect(draftIssues(seedState(),draft).some(issue=>issue.path==='directories')).toBe(true)
    expect(asObject(asObject(draft.payload.prvAssetCommt).cash).isExist).toBe(null)
  })
  it('blocks source changes and omitted business amounts',()=>{
    const {state,draft}=fixture();state.currentDate='2026-12-31'
    expect(draftIssues(state,draft).some(issue=>issue.path==='source')).toBe(true)
    const seeded=seedState();const mapped=createApiDraft(seeded)
    expect(draftIssues(seeded,mapped).some(issue=>issue.path==='allBusinessesWithBalance')).toBe(true)
  })
  it('blocks arbitrary fields and explicitly checks safe integer precision',()=>{
    const {draft}=fixture();draft.payload.officeNotes='private'
    expect(validatePayload(draft.payload).some(issue=>issue.path==='.officeNotes')).toBe(true)
    expect(projectPayload(draft.payload)).not.toHaveProperty('officeNotes')
    asObject(draft.payload.details).tikNumber=Number.MAX_SAFE_INTEGER+1
    expect(validatePayload(draft.payload).some(issue=>issue.path==='details.tikNumber')).toBe(true)
  })
  it('requires representative declarations and never checks them automatically',()=>{
    const {draft}=fixture();asObject(draft.payload.details).representativeIdNumber=18
    expect(validatePayload(draft.payload).filter(issue=>issue.path.startsWith('submit.'))).toHaveLength(3)
    Object.assign(asObject(draft.payload.submit),{section143Declaration:true,section224Declaration:true,taxPayerSignDeclaration:true})
    expect(validatePayload(draft.payload)).toEqual([])
    expect(asObject(projectPayload(draft.payload).submit)).not.toHaveProperty('rightDeclaration')
  })
  it('validates category presence, currency, date, amounts and duplicate vehicle IDs',()=>{
    const {draft}=fixture();const prv=asObject(draft.payload.prvAssetCommt)
    prv.cash={isExist:false,dataList:[{currencyType:3,costILS:1,foreignCurrencySum:''}]}
    expect(validatePayload(draft.payload).some(issue=>issue.message==='קיימים פריטים אך סומן שאינו קיים')).toBe(true)
    expect(validatePayload(draft.payload).some(issue=>issue.path.endsWith('foreignCurrencySum'))).toBe(true)
    const car={type:1,datePurchase:'2026-01-01T00:00:00Z',costILS:20000,licenseOrRegistrationNumber:'12345'}
    prv.vehiclesAndTransport={isExist:true,dataList:[car,car]}
    expect(validatePayload(draft.payload).some(issue=>issue.path.endsWith('datePurchase'))).toBe(true)
    expect(validatePayload(draft.payload).some(issue=>issue.path==='vehiclesAndTransport')).toBe(true)
  })
  it('keeps notes out of source signatures but detects amount changes',()=>{
    const state=seedState();const initial=sourceSnapshot(state);state.form1219Entries[0].note='private'
    expect(sourceSnapshot(state)).toBe(initial);state.form1219Entries[0].amount++
    expect(sourceSnapshot(state)).not.toBe(initial)
  })
  it('allows a home safe without bank fields but requires them for a bank safe',()=>{
    const {draft}=fixture();const power=asObject(draft.payload.pwrAttrny)
    const safe={safeLocation:1,prpSafeNotOwn:{isExist:false,dataList:[]}}
    power.safes={isExist:true,dataList:[safe]}
    expect(validatePayload(draft.payload)).toEqual([])
    safe.safeLocation=2
    expect(validatePayload(draft.payload).filter(issue=>/institutionName|branchNum|safeNum/.test(issue.path))).toHaveLength(3)
  })
})
describe('approved server transport',()=>{
  it('requires a server enable flag and the hash of exactly the approved payload',async()=>{
    const {draft}=fixture();const fetcher=vi.fn();const payload=projectPayload(draft.payload)
    await expect(transmitApprovedPayload({payload,approvedHash:await payloadHash(payload),environment:'sandbox',accessToken:'test',enabled:false,fetcher})).rejects.toThrow()
    await expect(transmitApprovedPayload({payload,approvedHash:'wrong',environment:'sandbox',accessToken:'test',enabled:true,fetcher})).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('uses the exact Sandbox endpoint with OAuth bearer and accepts explicit success only',async()=>{
    const {draft}=fixture();const payload=projectPayload(draft.payload)
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({isSuccess:true,rcText:'success sandbox test'}),{status:200}))
    const result=await transmitApprovedPayload({payload,approvedHash:await payloadHash(payload),environment:'sandbox',accessToken:'test-token',enabled:true,fetcher})
    expect(fetcher).toHaveBeenCalledOnce();expect(fetcher.mock.calls[0][0]).toBe(endpoints.sandbox)
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');expect(result.status).toBe('succeeded')
  })
  it('never retries timeouts and never labels HTTP 200 or 500 alone as success',async()=>{
    expect(interpretResponse(200,{}).status).toBe('unknown');expect(interpretResponse(500,{errorId:'reference'})).toMatchObject({status:'unknown',errorId:'reference'})
    const {draft}=fixture();const payload=projectPayload(draft.payload);const fetcher=vi.fn().mockRejectedValue(new Error('network'))
    expect((await transmitApprovedPayload({payload,approvedHash:await payloadHash(payload),environment:'sandbox',accessToken:'test',enabled:true,fetcher})).status).toBe('unknown')
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('redacts attempted values in validation errors and blocks production separately',async()=>{
    const result=interpretResponse(400,[{propertyName:'details.tikNumber',errorMessage:'Invalid ID number',attemptedValue:'PRIVATE-ID'}])
    expect(JSON.stringify(result)).not.toContain('PRIVATE-ID')
    const {draft}=fixture();const payload=projectPayload(draft.payload)
    await expect(transmitApprovedPayload({payload,approvedHash:await payloadHash(payload),environment:'production',accessToken:'test',enabled:true})).rejects.toThrow()
  })
})
