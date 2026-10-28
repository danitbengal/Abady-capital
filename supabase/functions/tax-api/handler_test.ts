import { handleTaxApi } from './handler.ts'
import { asObject, confirmEmptySections, payloadHash, projectPayload } from '../../../src/tax-api/payload.ts'
import { fullSchema, emptyValue, endpoints } from '../../../src/tax-api/schema.ts'

const check=(condition:unknown,message:string)=>{if(!condition)throw Error(message)}
Deno.test('Edge handler authenticates, gates, locks and records a mocked Sandbox submission',async()=>{
  const names=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','TAX_API_ALLOWED_ORIGINS','TAX_API_ENABLE_SANDBOX','TAX_API_SANDBOX_ACCESS_TOKEN']
  const oldValues=new Map(names.map(name=>[name,Deno.env.get(name)]))
  const originalFetch=globalThis.fetch
  const values=['https://example.supabase.co','test-anon','test-service','https://office.example','false','test-oauth']
  names.forEach((name,index)=>Deno.env.set(name,values[index]))
  let authenticated=true,claimable=true,authorityCalls=0,completions=0
  const payload=asObject(confirmEmptySections(emptyValue(fullSchema)))
  Object.assign(asObject(payload.details),{tikNumber:18,representativeIdNumber:0,dochToDayDate:'2025-12-31T00:00:00Z'})
  Object.assign(asObject(payload.submit),{mariStatus:false,rightDeclaration:true,asstsCmmtsDeclaration:true})
  const job={id:'00000000-0000-0000-0000-000000000001',environment:'sandbox',status:'approved',payload:projectPayload(payload),payload_hash:await payloadHash(projectPayload(payload))}
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
  globalThis.fetch=async(input,init)=>{
    const url=String(input)
    if(url.includes('/auth/v1/user'))return authenticated?json({id:'00000000-0000-0000-0000-000000000002',aud:'authenticated',app_metadata:{},user_metadata:{}}):json({message:'invalid',code:'bad_jwt'},401)
    if(url.includes('/rest/v1/tax_api_submissions'))return json(job)
    if(url.includes('/rpc/tax_api_claim'))return claimable?json([job]):json({message:'already claimed'},409)
    if(url===endpoints.sandbox){authorityCalls++;check(new Headers(init?.headers).get('Authorization')==='Bearer test-oauth','OAuth token missing');return json({isSuccess:true,rcText:'sandbox test'})}
    if(url.includes('/rpc/tax_api_complete')){completions++;check(JSON.parse(String(init?.body)).outcome==='succeeded','Outcome missing');return json(null)}
    throw Error('Unexpected network call')
  }
  const request=(origin='https://office.example')=>new Request('https://edge.example/tax-api',{method:'POST',headers:{Origin:origin,Authorization:'Bearer test-user','Content-Type':'application/json'},body:JSON.stringify({action:'send',id:job.id})})
  try{
    check((await handleTaxApi(request('https://foreign.example'))).status===403,'Foreign origin allowed')
    authenticated=false;check((await handleTaxApi(request())).status===401,'Unauthenticated access allowed');authenticated=true
    check((await handleTaxApi(request())).status===503,'Disabled Sandbox allowed')
    check(authorityCalls===0,'Called authority before enable')
    Deno.env.set('TAX_API_ENABLE_SANDBOX','true');claimable=false
    check((await handleTaxApi(request())).status===409,'Duplicate not blocked')
    check(authorityCalls===0,'Called authority before lock')
    claimable=true
    const response=await handleTaxApi(request());const result=await response.json()
    check(response.status===200&&result.status==='succeeded','Explicit success not returned')
    check(authorityCalls===1&&completions===1,'Expected exactly one attempt and one completion')
  }finally{
    globalThis.fetch=originalFetch
    for(const [name,value] of oldValues)value===undefined?Deno.env.delete(name):Deno.env.set(name,value)
  }
})
