// CapitalDeclarationApi 1.0 / 05.2025, supplied PDF physical pages 11–21, 32, 47–50, 60–61, 66–85.
export type Schema = { kind: 'object'; label: string; fields: Record<string, Schema> } |
  { kind: 'list'; label: string; item: Schema } |
  { kind: 'string' | 'number' | 'boolean' | 'date'; label: string; optional?: boolean; max?: number; min?: number; decimal?: boolean; codes?: readonly number[]; otherFor?: string }
const obj = (label: string, fields: Record<string, Schema>): Schema => ({ kind: 'object', label, fields })
const str = (label: string, max = 50): Schema => ({ kind: 'string', label, max })
const num = (label: string, max = 2147483647, min = 0): Schema => ({ kind: 'number', label, max, min })
const code = (label: string, codes?: readonly number[]): Schema => ({ kind: 'number', label, codes, min: -99, max: 32767 })
const date = (label: string): Schema => ({ kind: 'date', label })
const other = (label: string, otherFor: string): Schema => ({ kind: 'string', label, max: 50, optional: true, otherFor })
const list = (label: string, item: Schema): Schema => ({ kind: 'list', label, item })
const money = (label = 'סכום בשקלים'): Schema => num(label)
const longMoney = (label: string): Schema => num(label, Number.MAX_SAFE_INTEGER)
const flag = (label: string): Schema => ({ kind: 'boolean', label })
export const currencyCodes = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,-99] as const
const currencies = {
  currencyType: code('מטבע: 1 שקל, 2 אירו, 3 דולר, 4 ליש״ט, ‎-99 אחר', currencyCodes),
  currencyTypeOther: other('פירוט מטבע אחר', 'currencyType'),
  foreignCurrencySum: { ...num('סכום במטבע זר'), optional: true } as Schema,
}
const institution = {
  institutionName: code('קוד בנק / מוסד לפי רשימה רשמית'),
  institutionNameOther: other('שם מוסד אחר', 'institutionName'),
}
const country = { country: code('קוד מדינה לפי הרשימה הרשמית') }
const account = { ...country, ...institution, branchNum: num('מספר סניף',32767), accountNum: num('מספר חשבון'), accountOwnerName: str('שם בעל החשבון'), ...currencies, costILS: money() }
const assetCosts = list('עלויות נוספות בנכס', obj('עלות נוספת', {typeCost:str('סוג העלות'),date:date('מועד העלות'),costILS:money()}))
const estate = {assetType:code('סוג נכס: 1–10 או ‎-99 אחר',[1,2,3,4,5,6,7,8,9,10,-99]),assetTypeOther:other('פירוט סוג נכס אחר','assetType'),datePurchase:date('תאריך רכישה'),costILS:money()}
const realEstateIL = obj('נדל״ן בארץ',{...estate,city:code('קוד עיר רשמי'),street:code('קוד רחוב רשמי'),streetOther:other('שם רחוב אחר','street'),houseNumber:{...num('מספר בית',32767),optional:true} as Schema,block:{...num('גוש'),optional:true} as Schema,plot:{...num('חלקה'),optional:true} as Schema,subPlot:{...num('תת חלקה'),optional:true} as Schema,assetCosts})
const realEstateAbroad = obj('נדל״ן בחו״ל',{...estate,...country,address:str('כתובת',2000),...currencies,assetCosts})
const digitalAssets = obj('נכס דיגיטלי',{assetType:str('סוג הנכס הדיגיטלי'),amount:{...num('כמות'),decimal:true} as Schema,datePurchase:date('תאריך רכישה'),address:str('כתובת הארנק',150),costILS:money()})
const loans = obj('הלוואה',{borrowerName:str('שם הצד להלוואה'),relation:str('קרבה'),borrowerId:str('מספר מזהה של הצד'),debtYear:num('שנת החוב',9999,1800),...currencies,costILS:money()})
const vehicles = obj('כלי תחבורה',{type:code('סוג רכב: 1–11 או ‎-99 אחר',[1,2,3,4,5,6,7,8,9,10,11,-99]),typeOther:other('סוג רכב אחר','type'),licenseOrRegistrationNumber:str('מספר רישוי'),costILS:money(),datePurchase:date('תאריך רכישה')})
const securities = obj('ניירות ערך',{...institution,securityInvestmentDesc:code('סוג נייר ערך: 1–7 או ‎-99 אחר',[1,2,3,4,5,6,7,-99]),securityInvestmentDescOther:other('סוג נייר אחר','securityInvestmentDesc'),...country,branchNum:num('מספר סניף',32767),accountNum:num('מספר חשבון'),accountOwnerName:str('שם בעל החשבון'),...currencies,costILS:money()})
const commitments = obj('התחייבות',{...country,...institution,branchNum:num('מספר סניף',32767),account:num('מספר חשבון'),name:str('שם בעל החשבון'),...currencies,costILS:money()})
const property = obj('פריט',{itemType:str('תיאור הפריט'),purchaseDate:date('תאריך רכישה'),costILS:money()})
const wrapper = (label:string,item:Schema):Schema => obj(label,{isExist:flag('האם קיים?'),dataList:list('פירוט',item)})
export const privateCategories:Record<string,Schema> = {
  realEstateIL,realEstateAbroad,accounts:obj('חשבון',account),digitalAssets,cash:obj('מזומנים',{...currencies,costILS:money()}),
  pensionSavings:obj('חיסכון',{accountType:code('סוג חיסכון: 1–5 או ‎-99 אחר',[1,2,3,4,5,-99]),accountTypeOther:other('סוג חיסכון אחר','accountType'),...country,institutionName:code('מוסד: 1–9 או ‎-99 אחר',[1,2,3,4,5,6,7,8,9,-99]),institutionNameOther:other('שם מוסד אחר','institutionName'),accountOwnerName:str('שם בעל החיסכון'),...currencies,sumILS:money()}),
  securitiesInvestments:securities,loansGave:loans,vehiclesAndTransport:vehicles,jewelry:property,homeContents:property,otherProperty:property,commitments,loansTook:loans,
}
export const categoryLabels:Record<string,string>={realEstateIL:'נדל״ן בארץ',realEstateAbroad:'נדל״ן בחו״ל',accounts:'חשבונות בנקים',digitalAssets:'נכסים דיגיטליים',cash:'מזומנים',pensionSavings:'קופות וחסכונות',securitiesInvestments:'ניירות ערך',loansGave:'הלוואות שנתתי',vehiclesAndTransport:'כלי תחבורה',jewelry:'תכשיטים ואמנות',homeContents:'תכולת בית',otherProperty:'רכוש אחר',commitments:'התחייבויות מוסדיות',loansTook:'הלוואות שלקחתי'}
const privateFields=Object.fromEntries(Object.entries(privateCategories).map(([key,schema])=>[key,wrapper(categoryLabels[key],schema)]))
const businessCommon={businessRegisterNum:str('מספר רישום העסק'),partInPercent:{...num('אחוז בעלות',100),decimal:true} as Schema,...country,businessName:str('שם העסק')}
const fixed=(label:string,hasDate=true)=>obj(label,{propertyName:str('תיאור הרכוש'),...(hasDate?{purchaseDate:date('תאריך רכישה')}:{}),costILS:money()})
const businessCategories={accounts:privateCategories.accounts,digitalAssets,realEstateIL,realEstateAbroad,vehiclesAndTransport:vehicles,loansGave:loans,securitiesInvestments:securities,fixedProperty:fixed('רכוש קבוע'),stock:fixed('מלאי',false),paymentsOfFixedProperty:fixed('תשלומים על רכוש קבוע'),machinesAndEquipment:fixed('מכונות וציוד'),currentProperty:fixed('רכוש שוטף',false),commitments,loansTook:loans}
const businessFields=Object.fromEntries(Object.entries(businessCategories).map(([key,schema])=>[key,wrapper(categoryLabels[key]??schema.label,schema)]))
const propertyNotOwnFields={ownerName:str('שם הבעלים'),idNumber:str('מספר זהות של הבעלים'),sumILS:money(),propertyDescription:str('תיאור הרכוש')}
export const fullSchema:Schema=obj('הצהרת הון מלאה',{
  details:obj('פרטי שידור',{dochToDayDate:date('תאריך הצהרת הון'),tikNumber:num('מספר תיק',999999999,1),representativeIdNumber:{...num('מספר זהות מייצג: 0 לשידור עצמי',999999999),optional:true} as Schema}),
  prvAssetCommt:obj('רכוש והתחייבויות פרטיים',privateFields),
  allBusinessesWithBalance:obj('עסקים עם מאזן',{businessWithBalance:wrapper('עסקים עם מאזן',obj('עסק עם מאזן',{...businessCommon,businessType:code('סוג עסק: 1 חברה, 2 שותפות, 3 אגודה, 4 עצמאי, ‎-99 אחר',[1,2,3,4,-99]),businessTypeOther:other('סוג עסק אחר','businessType'),currentAccountBalance:longMoney('יתרת חו״ז'),capitalAccountBalance:longMoney('יתרת הון'),loansTookFromBusiness:longMoney('הלוואות מהעסק'),loansGivenToBusiness:longMoney('הלוואות לעסק'),paymentsOnUnallocatedShares:longMoney('תשלומים על מניות שלא הוקצו')}))}),
  allBusinessesWithOutBalance:obj('עסקים ללא מאזן',{businessWithoutBalance:wrapper('עסקים ללא מאזן',obj('עסק ללא מאזן',{...businessCommon,businessType:code('סוג עסק: 1 עצמאי, 2 שותפות, ‎-99 אחר',[1,2,-99]),businessTypeOther:other('סוג עסק אחר','businessType'),sumOfCash:longMoney('מזומנים'),totalChecksNotYetCashed:longMoney('שטרות והמחאות לקבל'),creditCardTransactions:longMoney('כרטיסי אשראי'),customersDebtBalance:longMoney('יתרת לקוחות'),debtsToSuppliers:longMoney('חובות לספקים'),billsAndChecksPayable:longMoney('שטרות והמחאות לפירעון'),...businessFields}))}),
  pwrAttrny:obj('כספות ורכוש של אחרים',{
    safes:wrapper('כספות',obj('כספת',{safeLocation:code('מיקום: 1 בבית, 2 בבנק, ‎-99 אחר',[1,2,-99]),safeLocationOther:other('מיקום כספת אחר','safeLocation'),...institution,branchNum:num('מספר סניף',32767),safeNum:num('מספר כספת'),prpSafeNotOwn:wrapper('רכוש אחרים בכספת',obj('רכוש של אחרים',propertyNotOwnFields))})),
    pwrOfAtrnyAstNotOwn:wrapper('ייפוי כוח לרכוש אחרים',obj('ייפוי כוח',propertyNotOwnFields)),
    propNotOwn:wrapper('רכוש אחרים המוחזק אצלי',obj('רכוש מוחזק',{...propertyNotOwnFields,location:str('מקום הרכוש')})),
  }),
  submit:obj('הצהרות ואישורים',{mariStatus:flag('נשוי/אה'),rightDeclaration:flag('הנישום אישר נכונות'),asstsCmmtsDeclaration:flag('הנישום אישר נכסים והתחייבויות'),section143Declaration:flag('המייצג אישר סעיף 143'),section224Declaration:flag('המייצג אישר סעיף 224'),taxPayerSignDeclaration:flag('המייצג מאשר חתימת הנישום'),prvDeclarationSum:{...longMoney('הון בהצהרה קודמת'),optional:true} as Schema}),
})

export function emptyValue(schema:Schema):unknown {
  if(schema.kind==='object')return Object.fromEntries(Object.entries(schema.fields).map(([key,node])=>[key,emptyValue(node)]))
  if(schema.kind==='list')return []
  if(schema.kind==='boolean')return null
  return ''
}
export const API_VERSION='1.0 / 05.2025'
export const endpoints={sandbox:'https://ita-api.taxes.gov.il/shaam/tsandbox/capitalDeclarationsApi/v1/CapitalDeclarationsFull',production:'https://openapi.taxes.gov.il/shaam/production/capitalDeclarationsApi/v1/CapitalDeclarationsFull'} as const
