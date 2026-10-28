type AuthFailure={status?:number;code?:string;name?:string}
const isNetworkFailure=(error:AuthFailure)=>error.status===0||error.name==='AuthRetryableFetchError'
export function authFailureMessage(error:AuthFailure):string {
  const code=error.code??''
  if(isNetworkFailure(error))return 'הדפדפן לא קיבל תשובה משירות ההתחברות. יש לבדוק חיבור לאינטרנט או חסימה של הבקשה לפני בקשת קוד נוסף.'
  if(['over_email_send_rate_limit','over_request_rate_limit','email_send_rate_limit','rate_limit_exceeded'].includes(code)||error.status===429)return 'הגעת למגבלת שליחת קודים. המתיני לפני בקשת קוד נוסף.'
  if(code==='email_address_not_authorized')return 'שירות המייל של Supabase אינו מורשה לשלוח לכתובת הזו. מנהלת המערכת צריכה להגדיר ספק מייל (SMTP).'
  if(['email_provider_disabled','otp_disabled','signup_disabled','user_not_found'].includes(code))return 'יש לבדוק ב־Supabase שהמשתמש קיים ושהכניסה בקוד למייל מופעלת. לא ניתן לשלוח קוד כרגע.'
  if(code==='email_not_confirmed')return 'כתובת המייל של המשתמש טרם אושרה ב־Supabase. יש לאשר אותה לפני הכניסה.'
  if(code==='email_address_invalid'||code==='validation_failed')return 'כתובת המייל אינה מתקבלת. בדקי את הכתובת שהזנת.'
  if(error.status===401||code==='bad_jwt'||code==='invalid_credentials')return 'חיבור האתר ל־Supabase אינו מורשה. מנהלת המערכת צריכה לבדוק את הגדרות החיבור של האתר.'
  if(error.status!==undefined&&error.status>=500)return 'שירות ההתחברות לא הצליח לשלוח את המייל. יש לבדוק את יומן השגיאות והגדרות ספק המייל ב־Supabase.'
  return 'בקשת הקוד לא הושלמה. פרטי התקלה מוצגים למטה לצורך בדיקה.'
}
// Do not expose raw server messages, mail addresses, tokens or request bodies.
export function authFailureReference(error:AuthFailure):string {
  if(isNetworkFailure(error))return 'network_error · HTTP unavailable'
  const code=typeof error.code==='string'&&/^[a-z0-9_]{1,80}$/.test(error.code)?error.code:'unknown'
  const status=Number.isInteger(error.status)&&Number(error.status)>=100&&Number(error.status)<=599?String(error.status):'unknown'
  return `${code} · HTTP ${status}`
}
