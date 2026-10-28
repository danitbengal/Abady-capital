import { calculateForm1219, valuesFromEntries, type Form1219Entry, type Form1219Disclosures } from '../capital/form1219.ts'
import { emptyValue, fullSchema, type Schema } from './schema.ts'

export type JsonObject=Record<string,unknown>
export type ApiIssue={path:string;message:string}
export interface TaxApiDraft { payload:JsonObject; sourceSnapshot:string; emptyReviewed:boolean; directoriesReviewed:boolean; approvedSnapshot?:string }
export interface TaxSourceState {currentDate:string;personal:{clientId:string;maritalStatus:string};form1219Entries:Form1219Entry[];form1219SharePercent:number;form1219Disclosures:Form1219Disclosures}
export const asObject=(value:unknown):JsonObject=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as JsonObject:{}
const rows=(value:unknown):JsonObject[]=>Array.isArray(asObject(value).dataList)?(asObject(value).dataList as unknown[]).map(asObject):[]
export const privateCodeMap:Record<number,string>={10:'realEstateIL',20:'realEstateAbroad',30:'accounts',40:'digitalAssets',50:'cash',60:'pensionSavings',70:'securitiesInvestments',80:'loansGave',90:'vehiclesAndTransport',100:'jewelry',110:'homeContents',120:'otherProperty',130:'commitments',140:'loansTook'}
export function sourceSnapshot(state:TaxSourceState):string {
  return JSON.stringify({date:state.currentDate,id:state.personal.clientId,marital:state.personal.maritalStatus,entries:state.form1219Entries.map(({id,code,description,amount,acquiredAt,currency,foreignAmount})=>({id,code,description,amount,acquiredAt,currency,foreignAmount})),share:state.form1219SharePercent,disclosures:state.form1219Disclosures})
}
export function createApiDraft(state:TaxSourceState):TaxApiDraft {
  const payload=asObject(emptyValue(fullSchema)); const details=asObject(payload.details)
  details.dochToDayDate=state.currentDate?`${state.currentDate}T00:00:00Z`:''
  details.tikNumber=/^\d{1,9}$/.test(state.personal.clientId)?Number(state.personal.clientId):''
  details.representativeIdNumber='' // Never guess the representative's identity.
  asObject(payload.submit).mariStatus=state.personal.maritalStatus==='married'
  const privateData=asObject(payload.prvAssetCommt)
  if(fullSchema.kind!=='object')throw Error('Invalid schema')
  const privateSchema=fullSchema.fields.prvAssetCommt
  for(const entry of state.form1219Entries){
    const key=privateCodeMap[entry.code]; if(!key || privateSchema.kind!=='object')continue
    const wrapperSchema=privateSchema.fields[key]; if(wrapperSchema.kind!=='object')continue
    const listSchema=wrapperSchema.fields.dataList; if(listSchema.kind!=='list')continue
    const row=asObject(emptyValue(listSchema.item));
    if('costILS' in row)row.costILS=entry.amount
    if('sumILS' in row)row.sumILS=entry.amount
    if('datePurchase' in row)row.datePurchase=entry.acquiredAt?`${entry.acquiredAt}T00:00:00Z`:''
    if('purchaseDate' in row)row.purchaseDate=entry.acquiredAt?`${entry.acquiredAt}T00:00:00Z`:''
    if('itemType' in row)row.itemType=entry.description
    const currency=({ILS:1,EUR:2,USD:3,GBP:4} as Record<string,number>)[entry.currency]
    if('currencyType' in row)row.currencyType=currency??''
    if('foreignCurrencySum' in row && currency!==1)row.foreignCurrencySum=entry.foreignAmount
    const wrapper=asObject(privateData[key]); wrapper.isExist=true
    wrapper.dataList=[...(Array.isArray(wrapper.dataList)?wrapper.dataList:[]),row]
  }
  return {payload,sourceSnapshot:sourceSnapshot(state),emptyReviewed:false,directoriesReviewed:false}
}
export function confirmEmptySections(value:unknown):unknown {
  if(Array.isArray(value))return value.map(confirmEmptySections)
  if(value!==null&&typeof value==='object'){
    const object=asObject(value); const next=Object.fromEntries(Object.entries(object).map(([key,item])=>[key,confirmEmptySections(item)]))
    if('isExist' in next && next.isExist===null && Array.isArray(next.dataList) && next.dataList.length===0)next.isExist=false
    return next
  }
  return value
}
export function validIsraeliId(value:unknown):boolean {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0||value>999999999)return false
  return [...String(value).padStart(9,'0')].reduce((sum,char,index)=>{let n=Number(char)*(index%2+1);if(n>9)n-=9;return sum+n},0)%10===0
}
export function validatePayload(payload:unknown):ApiIssue[]{
  const issues:ApiIssue[]=[];const root=asObject(payload);const declaration=asObject(root.details).dochToDayDate
  const representative=asObject(root.details).representativeIdNumber
  const representativeMode=typeof representative==='number'&&representative>0
  const issue=(path:string,message:string)=>issues.push({path,message})
  function walk(schema:Schema,value:unknown,path:string,parent:JsonObject={}){
    if(schema.kind==='object'){
      if(value===null||typeof value!=='object'||Array.isArray(value)){issue(path,'נדרש פירוט');return}
      const object=asObject(value)
      for(const key of Object.keys(object))if(!Object.hasOwn(schema.fields,key))issue(`${path}.${key}`,'השדה אינו נכלל בחוזה השידור; הערות ומידע פנימי אינם משודרים')
      if('isExist' in schema.fields){
        const list=object.dataList
        if(object.isExist===true&&(!Array.isArray(list)||list.length===0))issue(path,'סומן קיים ללא פריטים')
        if(object.isExist===false&&Array.isArray(list)&&list.length>0)issue(path,'קיימים פריטים אך סומן שאינו קיים')
      }
      for(const [key,node] of Object.entries(schema.fields))walk(node,object[key],path?`${path}.${key}`:key,object)
      return
    }
    if(schema.kind==='list'){
      if(!Array.isArray(value)){issue(path,'נדרשת רשימה');return}
      value.forEach((item,index)=>walk(schema.item,item,`${path}[${index}]`));return
    }
    if(path.startsWith('submit.')&&['rightDeclaration','asstsCmmtsDeclaration','section143Declaration','section224Declaration','taxPayerSignDeclaration'].includes(path.split('.').at(-1)!)){
      const forRepresentative=['section143Declaration','section224Declaration','taxPayerSignDeclaration'].includes(path.split('.').at(-1)!)
      if(forRepresentative!==representativeMode)return
      if(value!==true)issue(path,'נדרש אישור מפורש של ההצהרה');return
    }
    let required=!schema.optional
    if('safeLocation' in parent && ['institutionName','branchNum','safeNum'].includes(path.split('.').at(-1)!))required=parent.safeLocation===2
    if(schema.otherFor)required=parent[schema.otherFor]===-99
    if(path.endsWith('.foreignCurrencySum'))required=typeof parent.currencyType==='number'&&parent.currencyType!==1
    if(value===undefined||value===null||value===''){if(required)issue(path,`${schema.label}: חובה להשלים`);return}
    if(schema.kind==='boolean'){if(typeof value!=='boolean')issue(path,'נדרש כן / לא');return}
    if(schema.kind==='string'){
      if(typeof value!=='string'||!value.trim()){issue(path,'נדרש טקסט');return}
      if(schema.max&&value.length>schema.max)issue(path,`הטקסט ארוך מ־${schema.max} תווים`)
      if(/[\u0000-\u001f]/.test(value))issue(path,'תווים לא מותרים בטקסט')
      if(/(?:accountOwnerName|borrowerName|borrowerId|businessRegisterNum|propertyName|ownerName|idNumber|itemType|propertyDescription|location)$/.test(path)&&!/^[a-zA-Z0-9/()\-"'\u0590-\u05fe ]+$/.test(value))issue(path,'מותרים תווים ומספרים לפי תבנית הרשות')
      if(/(?:currencyTypeOther|institutionNameOther|relation|businessTypeOther)$/.test(path)&&!/^[a-zA-Z/()\-"'\u0590-\u05fe ]+$/.test(value))issue(path,'מותרים תווים לפי תבנית הרשות')
      if(path.endsWith('licenseOrRegistrationNumber')&&!/^[a-zA-Z0-9\u0590-\u05fe]+$/.test(value))issue(path,'מספר רישוי חייב להכיל אותיות או ספרות בלבד')
      return
    }
    if(schema.kind==='date'){
      if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T00:00:00Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().replace('.000','')!==value){issue(path,'תאריך אינו תקין או אינו בפורמט UTC הנדרש');return}
      if(value<'1800-01-01T00:00:00Z'||(path!=='details.dochToDayDate'&&typeof declaration==='string'&&value>declaration))issue(path,'תאריך חייב להיות בין 1.1.1800 לתאריך ההצהרה')
      return
    }
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER||(!schema.decimal&&!Number.isSafeInteger(value))){issue(path,'נדרש מספר מדויק בטווח הנתמך, ללא עיגול אוטומטי');return}
    if(schema.decimal&&Math.abs(Math.round(value*100)-value*100)>0.00001)issue(path,'מותרות עד שתי ספרות אחרי הנקודה')
    if(schema.min!==undefined&&value<schema.min||schema.max!==undefined&&value>schema.max)issue(path,'המספר מחוץ לטווח המוגדר')
    if(schema.codes&&!schema.codes.includes(value))issue(path,'הקוד אינו ברשימה הרשמית')
    if(!schema.codes&&schema.min===-99&&value!==-99&&value<=0)issue(path,'נדרש קוד רשמי חיובי או ‎-99 כאשר מותר אחר')
    if(value===-99&&/(?:\.city|\.country)$/.test(path))issue(path,'בסעיף זה נדרש קוד מהרשימה הרשמית; אין אפשרות אחר')
    if(path.endsWith('.debtYear')&&typeof declaration==='string'&&value>=Number(declaration.slice(0,4)))issue(path,'שנת החוב חייבת להיות מוקדמת משנת ההצהרה')
    if(/\.(costILS|sumILS)$/.test(path)&&value<=1)issue(path,'המפרט דורש סכום גדול מ־1 ₪; ערך 1 דורש הבהרה מול הרשות לפני שידור')
    if(path.endsWith('.tikNumber')&&!validIsraeliId(value))issue(path,'מספר תיק אינו עובר בדיקת ספרת ביקורת')
    if(path.endsWith('.representativeIdNumber')&&value!==0&&!validIsraeliId(value))issue(path,'מספר מייצג אינו עובר בדיקת ספרת ביקורת')
  }
  walk(fullSchema,payload,'')
  const plates=new Set<string>()
  function checkDuplicates(value:unknown){
    if(Array.isArray(value)){value.forEach(checkDuplicates);return}
    const object=asObject(value)
    if(typeof object.licenseOrRegistrationNumber==='string'&&object.licenseOrRegistrationNumber){const plate=object.licenseOrRegistrationNumber;if(plates.has(plate))issue('vehiclesAndTransport','מספר רישוי מופיע יותר מפעם אחת');plates.add(plate)}
    Object.values(object).filter(child=>child!==null&&typeof child==='object').forEach(checkDuplicates)
  }
  checkDuplicates(payload)
  return issues
}
// Projection uses only published API fields. It never serializes the client state, files or notes.
export function projectPayload(payload:JsonObject):JsonObject {
  function pick(schema:Schema,value:unknown):unknown{
    if(schema.kind==='object')return Object.fromEntries(Object.entries(schema.fields).filter(([key,node])=>!(node.kind!=='object'&&node.kind!=='list'&&node.optional&&['',undefined,null].includes(asObject(value)[key] as never))).map(([key,node])=>[key,pick(node,asObject(value)[key])]))
    if(schema.kind==='list')return (Array.isArray(value)?value:[]).map(item=>pick(schema.item,item))
    return value
  }
  const projected=asObject(pick(fullSchema,payload));const submit=asObject(projected.submit)
  if(Number(asObject(projected.details).representativeIdNumber)>0){delete submit.rightDeclaration;delete submit.asstsCmmtsDeclaration}
  else {delete submit.section143Declaration;delete submit.section224Declaration;delete submit.taxPayerSignDeclaration}
  return projected
}
export function draftIssues(state:TaxSourceState,draft:TaxApiDraft):ApiIssue[]{
  const issues=validatePayload(draft.payload)
  const details=asObject(draft.payload.details)
  if(details.dochToDayDate!==`${state.currentDate}T00:00:00Z`)issues.push({path:'details.dochToDayDate',message:'מועד השידור חייב להתאים למועד ההצהרה בתיק'})
  if(Number(details.tikNumber)!==Number(state.personal.clientId))issues.push({path:'details.tikNumber',message:'מספר התיק לשידור אינו תואם לכרטיס הלקוח'})
  if(asObject(draft.payload.submit).mariStatus!==(state.personal.maritalStatus==='married'))issues.push({path:'submit.mariStatus',message:'המצב המשפחתי אינו תואם לכרטיס הלקוח'})
  if(draft.sourceSnapshot!==sourceSnapshot(state))issues.push({path:'source',message:'נתוני ההצהרה השתנו; יש לרענן את נתוני השידור ולבדוק שוב'})
  if(!draft.emptyReviewed)issues.push({path:'review',message:'נדרש אישור בדיקת הסעיפים הריקים והיקף ההצהרה'})
  if(!draft.directoriesReviewed)issues.push({path:'directories',message:'נדרש אימות קודי מדינות, בנקים, סניפים, ערים ורחובות מול הרשימות הרשמיות'})
  const prv=asObject(draft.payload.prvAssetCommt)
  for(const [rawCode,key] of Object.entries(privateCodeMap)){
    const expected=state.form1219Entries.filter(entry=>entry.code===Number(rawCode)).reduce((sum,entry)=>sum+entry.amount,0)
    const actual=rows(prv[key]).reduce((sum,row)=>sum+Number(row.costILS??row.sumILS??0),0)
    if(actual!==expected)issues.push({path:`prvAssetCommt.${key}`,message:`סכום הסעיף אינו תואם לשורות ההצהרה: ${expected} ₪ לעומת ${actual} ₪`})
  }
  const official=calculateForm1219(valuesFromEntries(state.form1219Entries),state.form1219SharePercent)
  const businesses=rows(asObject(draft.payload.allBusinessesWithBalance).businessWithBalance)
  const businessNet=businesses.reduce((sum,row)=>sum+Number(row.currentAccountBalance??0)+Number(row.capitalAccountBalance??0)+Number(row.loansGivenToBusiness??0)+Number(row.paymentsOnUnallocatedShares??0)-Number(row.loansTookFromBusiness??0),0)
  if(businessNet!==official[460])issues.push({path:'allBusinessesWithBalance',message:'פירוט עסקים עם מאזן חייב להתאים לסיכום חלק ב׳; יש להשלים קיבוץ לפי כל עסק'})
  const without=rows(asObject(draft.payload.allBusinessesWithOutBalance).businessWithoutBalance)
  const withoutNet=without.reduce((sum,row)=>{
    const assets=['accounts','digitalAssets','realEstateIL','realEstateAbroad','vehiclesAndTransport','loansGave','securitiesInvestments','fixedProperty','stock','paymentsOfFixedProperty','machinesAndEquipment','currentProperty'].reduce((n,key)=>n+rows(row[key]).reduce((s,item)=>s+Number(item.costILS??0),0),0)
    const debt=['commitments','loansTook'].reduce((n,key)=>n+rows(row[key]).reduce((s,item)=>s+Number(item.costILS??0),0),0)
    return sum+(assets+Number(row.sumOfCash??0)+Number(row.totalChecksNotYetCashed??0)+Number(row.creditCardTransactions??0)+Number(row.customersDebtBalance??0)-debt-Number(row.debtsToSuppliers??0)-Number(row.billsAndChecksPayable??0))*Number(row.partInPercent??0)/100
  },0)
  if(Math.abs(withoutNet-official[770])>0.005)issues.push({path:'allBusinessesWithOutBalance',message:'פירוט עסקים ללא מאזן ואחוזי הבעלות אינם תואמים לסיכום חלק ג׳'})
  const disclosures=state.form1219Disclosures; const power=asObject(draft.payload.pwrAttrny)
  for(const [key,exists] of [['safes',disclosures.safeDepositBoxes],['pwrOfAtrnyAstNotOwn',disclosures.powersOfAttorney],['propNotOwn',disclosures.propertyForOthers]] as const)if(asObject(power[key]).isExist!==exists)issues.push({path:`pwrAttrny.${key}`,message:'סימון קיום הרכוש אינו תואם לחלק ד׳ בהצהרה'})
  return issues
}
export function readyPayload(state:TaxSourceState,draft:TaxApiDraft):JsonObject {
  const issues=draftIssues(state,draft);if(issues.length)throw Error('יש להשלים את החוסרים לפני הכנת בקשת השידור')
  return projectPayload(draft.payload)
}
export async function payloadHash(payload:JsonObject):Promise<string>{
  function canonical(value:unknown):unknown {if(Array.isArray(value))return value.map(canonical);if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(asObject(value)).sort().map(key=>[key,canonical(asObject(value)[key])]));return value}
  const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(payload))))
  return [...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('')
}
