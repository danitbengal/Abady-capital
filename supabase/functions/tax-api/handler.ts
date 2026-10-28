import { createClient } from 'npm:@supabase/supabase-js@2.75.0'
import { asObject, payloadHash, projectPayload, validatePayload } from '../../../src/tax-api/payload.ts'
import { transmitApprovedPayload } from '../../../src/tax-api/transport.ts'

// Deployment must retain Supabase JWT verification. No tokens are returned to the browser.
export async function handleTaxApi(request:Request){
  const origin=request.headers.get('Origin')??''
  const allowedOrigins=(Deno.env.get('TAX_API_ALLOWED_ORIGINS')??'').split(',').map(value=>value.trim()).filter(Boolean)
  const headers={ 'Content-Type':'application/json',...(allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS' }
  const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers})
  if(origin&&!allowedOrigins.includes(origin))return respond(403,{message:'Origin not allowed'})
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
  if(request.method!=='POST')return respond(405,{message:'Method not allowed'})
  const authorization=request.headers.get('Authorization')??''
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data:auth,error:authError}=await db.auth.getUser()
  if(authError||!auth.user)return respond(401,{message:'Authentication required'})
  let input:Record<string,unknown>
  try {
    const raw=await request.text();if(raw.length>1_000_000)return respond(413,{message:'Request too large'})
    input=asObject(JSON.parse(raw))
  }catch{return respond(400,{message:'Invalid JSON'})}
  try{
    if(input.action==='prepare'){
      const payload=asObject(input.payload);const issues=validatePayload(payload)
      if(issues.length)return respond(422,{message:'Validation failed',issues})
      if(!['sandbox','production'].includes(String(input.environment)))return respond(400,{message:'Invalid environment'})
      const projected=projectPayload(payload)
      const {data,error}=await db.rpc('tax_api_prepare',{target_case:input.caseId,target_environment:input.environment,request_payload:projected,request_hash:await payloadHash(projected)})
      return error?respond(403,{message:'Cannot prepare submission for this case'}):respond(200,{id:data,status:'draft'})
    }
    if(input.action==='approve'){
      const {error}=await db.rpc('tax_api_approve',{job_id:input.id})
      return error?respond(409,{message:'Cannot approve submission'}):respond(200,{status:'approved'})
    }
    if(input.action!=='send')return respond(400,{message:'Invalid action'})
    const {data:job,error}=await db.from('tax_api_submissions').select('*').eq('id',input.id).single()
    if(error||!job)return respond(403,{message:'Not authorized'})
    const isProduction=job.environment==='production'
    const enabled=Deno.env.get(isProduction?'TAX_API_ENABLE_PRODUCTION':'TAX_API_ENABLE_SANDBOX')==='true'
    const token=Deno.env.get(isProduction?'TAX_API_PRODUCTION_ACCESS_TOKEN':'TAX_API_SANDBOX_ACCESS_TOKEN')??''
    if(!enabled||!token)return respond(503,{message:'שידור חי לא הופעל או שחסרה הרשאת OAuth2 לסביבה שנבחרה'})
    if(validatePayload(job.payload).length||await payloadHash(projectPayload(job.payload))!==job.payload_hash)return respond(409,{message:'Invalid or changed approved payload'})
    const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
    const claim=await service.rpc('tax_api_claim',{job_id:job.id,actor_id:auth.user.id})
    if(claim.error||!claim.data?.length)return respond(409,{message:'Already attempted, not approved, or case changed'})
    const result=await transmitApprovedPayload({payload:job.payload,approvedHash:job.payload_hash,environment:job.environment,enabled:true,productionEnabled:isProduction,accessToken:token})
    const completed=await service.rpc('tax_api_complete',{job_id:job.id,outcome:result.status,response_status:result.httpStatus??null,error_id:result.errorId??null,error_code:result.code??null})
    if(completed.error)return respond(503,{status:'unknown',message:'לא ניתן לשמור את תוצאת השידור; אין לנסות לשדר שוב לפני בירור'})
    return respond(200,result)
  }catch{
    // Never log a payload, taxpayer ID, OAuth token or the authority's attemptedValue.
    return respond(500,{status:'unknown',message:'לא ניתן להשלים את הפעולה; יש לבדוק את מצב הבקשה לפני ניסיון נוסף'})
  }
}
