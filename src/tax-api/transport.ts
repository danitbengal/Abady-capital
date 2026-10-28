import { endpoints } from './schema.ts'
import { type JsonObject, asObject, projectPayload, validatePayload, payloadHash } from './payload.ts'

export type SubmissionResult={status:'succeeded'|'rejected'|'unknown';httpStatus?:number;errorId?:string;code?:string;issues?:{path:string;message:string}[]}
export function interpretResponse(httpStatus:number,body:unknown):SubmissionResult {
  const object=asObject(body)
  if(httpStatus===200&&object.isSuccess===true)return {status:'succeeded',httpStatus}
  const base={httpStatus,...(typeof object.errorId==='string'?{errorId:object.errorId}:{}),...(typeof object.errorCode==='string'?{code:object.errorCode}: {})}
  if(httpStatus>=400&&httpStatus<500){
    const errors=Array.isArray(body)?body:[body]
    return {status:'rejected',...base,issues:errors.flatMap(error=>{const value=asObject(error);return typeof value.propertyName==='string'?[{path:value.propertyName,message:typeof value.errorMessage==='string'?value.errorMessage:'שגיאת בדיקת הרשות'}]:[]})}
  }
  // A timeout, HTTP 5xx, malformed body or missing isSuccess may follow acceptance.
  // Do not automatically retry or infer successful submission from HTTP alone.
  return {status:'unknown',...base}
}
export async function transmitApprovedPayload(input:{
  payload:JsonObject; approvedHash:string; environment:'sandbox'|'production'; accessToken:string;
  enabled:boolean; productionEnabled?:boolean; fetcher?:typeof fetch;
}):Promise<SubmissionResult>{
  if(!input.enabled||input.environment==='production'&&!input.productionEnabled)throw Error('השידור לסביבה זו טרם הופעל')
  if(!input.accessToken.trim())throw Error('חסרה הרשאת OAuth2 לשירות רשות המסים')
  if(validatePayload(input.payload).length)throw Error('בקשת השידור אינה תקינה')
  const payload=projectPayload(input.payload)
  if(await payloadHash(payload)!==input.approvedHash)throw Error('התוכן השתנה מאז אישור המשרד')
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000)
  try {
    const response=await (input.fetcher??fetch)(endpoints[input.environment],{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${input.accessToken}`},body:JSON.stringify(payload),signal:controller.signal,redirect:'error'})
    let body:unknown;try{body=await response.json()}catch{return {status:'unknown',httpStatus:response.status}}
    return interpretResponse(response.status,body)
  }catch{return {status:'unknown'}}finally{clearTimeout(timer)}
}
