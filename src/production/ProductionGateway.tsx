import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Building2, FolderLock, LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { capitalSupabase, isCapitalSupabaseConfigured } from '../lib/supabase'
import './production.css'
import { SecureWorkspace, type ClientRow } from './SecureWorkspace'
import { authFailureMessage,authFailureReference } from './authErrors'

type Membership = { office_id: string; role: string; offices?: { name?: string } | null }

const roleNames: Record<string, string> = {
  administrator: 'מנהלת מערכת', accountant: 'רואה חשבון', office_staff: 'עובד/ת משרד', bookkeeper: 'מנהלת חשבונות', auditor: 'מבקר/ת',
}

export function ProductionGateway() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeEmail, setCodeEmail] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [message, setMessage] = useState('')
  const [authReference,setAuthReference]=useState('')
  const [membership, setMembership] = useState<Membership | null>(null)
  const [workspaceError, setWorkspaceError] = useState(false)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [officeName, setOfficeName] = useState('עבדי בן גל — רואי חשבון')
  const [memberName, setMemberName] = useState('')

  useEffect(() => {
    if (!capitalSupabase) { setLoading(false); return }
    capitalSupabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = capitalSupabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !capitalSupabase) { setMembership(null); setClients([]); return }
    void loadWorkspace()
  }, [session])

  useEffect(() => {
    if (!resendSeconds) return
    const timer = window.setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  async function loadWorkspace() {
    if (!capitalSupabase || !session) return
    setLoading(true); setMessage(''); setWorkspaceError(false)
    const membershipResult = await capitalSupabase.from('office_members').select('office_id, role, offices(name)').eq('user_id',session.user.id).eq('active',true).limit(1).maybeSingle()
    if (membershipResult.error) {
      setWorkspaceError(true)
      setMessage(membershipResult.error.code === 'PGRST205' ? 'תשתית המסד עדיין לא הופעלה בפרויקט Supabase. יש להפעיל תחילה את מיגרציית שלב 1.' : 'לא ניתן לטעון את הרשאות המשרד. בדקי את החיבור וההרשאות.')
      setLoading(false); return
    }
    const currentMembership = membershipResult.data as unknown as Membership | null
    setMembership(currentMembership)
    if (!currentMembership) { setLoading(false); return }
    const clientsResult = await capitalSupabase.from('clients').select('id, display_name, tax_identifier, capital_cases(id, declaration_date, filing_due_date, status)').order('display_name')
    if (clientsResult.error) setMessage('ההתחברות הצליחה, אך לא ניתן לטעון את הלקוחות המורשים.')
    else setClients((clientsResult.data ?? []) as unknown as ClientRow[])
    setLoading(false)
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault()
    if (!capitalSupabase || authBusy || resendSeconds) return
    const recipient = codeEmail || email.trim()
    setAuthBusy(true); setMessage(''); setAuthReference('')
    try {
      const { error } = await capitalSupabase.auth.signInWithOtp({ email: recipient, options: { shouldCreateUser: false } })
      if (error) { setMessage(authFailureMessage(error));setAuthReference(authFailureReference(error));if(error.status===429)setResendSeconds(60);return }
      setCodeEmail(recipient); setCode(''); setResendSeconds(60)
    } catch { setMessage('לא ניתן להגיע לשירות ההתחברות. בדקי חיבור לאינטרנט ונסי שוב.');setAuthReference('network_error') }
    finally { setAuthBusy(false) }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (!capitalSupabase || authBusy) return
    setAuthBusy(true); setMessage('')
    try {
      const { error } = await capitalSupabase.auth.verifyOtp({ email: codeEmail, token: code.trim(), type: 'email' })
      if (error) setMessage('הקוד שגוי או פג תוקף. בדקי את הקוד או בקשי קוד חדש.')
      else setCode('')
    } catch { setMessage('החיבור נכשל. נסי שוב.') }
    finally { setAuthBusy(false) }
  }

  async function bootstrapOffice(event: FormEvent) {
    event.preventDefault()
    if (!capitalSupabase) return
    setLoading(true); setMessage('')
    const { error } = await capitalSupabase.rpc('bootstrap_office', { office_name: officeName.trim(), member_name: memberName.trim() })
    if (error) setMessage('לא ניתן להקים את סביבת המשרד. הפעולה מותרת רק למשתמש שאינו שייך עדיין למשרד.')
    else await loadWorkspace()
    setLoading(false)
  }

  if (!isCapitalSupabaseConfigured) return <SecureMessage title="החיבור אינו מוגדר" text="יש להגדיר את כתובת פרויקט ההון ואת המפתח הציבורי בסביבת ההפעלה." />
  if (loading) return <SecureMessage title="טוענים את סביבת המשרד" text="מתבצעת בדיקת התחברות והרשאות…" />

  if (!session) return <div className="prod-shell" dir="rtl"><section className="prod-login"><div className="prod-mark"><FolderLock /></div><small>מערכת הצהרות הון · קוד חד־פעמי במייל</small><h1>כניסה למשרד</h1>{!codeEmail ? <><p>הזיני את המייל של משתמש המשרד שלך כדי לקבל קוד כניסה.</p><form onSubmit={sendCode}><label>כתובת מייל<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={authBusy}/></label><button type="submit" disabled={authBusy || resendSeconds > 0}><LogIn size={17}/>{authBusy ? 'שולחים קוד…' : resendSeconds > 0 ? `אפשר לבקש שוב בעוד ${resendSeconds} שניות` : 'שליחת קוד למייל'}</button></form></> : <><p>בקשת קוד נשלחה עבור <b dir="ltr">{codeEmail}</b>. בדקי גם את תיקיית הספאם.</p><form onSubmit={verifyCode}><label>קוד כניסה<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} required autoFocus disabled={authBusy}/></label><button type="submit" disabled={authBusy}><LogIn size={17}/>{authBusy ? 'בודקים קוד…' : 'אימות קוד וכניסה'}</button></form><button className="prod-link" disabled={authBusy || resendSeconds > 0} onClick={() => void sendCode()}>{resendSeconds ? `שליחה חוזרת בעוד ${resendSeconds} שניות` : 'שליחת קוד חדש'}</button><button className="prod-link" disabled={authBusy} onClick={() => { setCodeEmail(''); setCode(''); setMessage(''); setAuthReference('') }}>שינוי כתובת מייל</button></>}{message && <div role="alert" className="prod-error">{message}{authReference && <details><summary>פרטי התקלה לבדיקה</summary><code dir="ltr">{authReference}</code></details>}</div>}<a href="?">חזרה לדגם</a></section></div>

  if (workspaceError) return <div className="prod-shell" dir="rtl"><section className="prod-login"><h1>סביבת המשרד עדיין אינה זמינה</h1><p>{message}</p><button className="prod-link" onClick={() => void loadWorkspace()}>בדיקה מחדש</button><button className="prod-link" onClick={() => capitalSupabase?.auth.signOut()}>התנתקות</button></section></div>

  if (!membership) return <div className="prod-shell" dir="rtl"><section className="prod-login"><div className="prod-mark"><Building2 /></div><small>הקמה חד־פעמית</small><h1>פתיחת סביבת המשרד</h1><p>המשתמש המחובר יוגדר כמנהל הראשון. לאחר מכן מוסיפים עובדים והרשאות בצורה מבוקרת.</p><form onSubmit={bootstrapOffice}><label>שם המשרד<input value={officeName} onChange={event => setOfficeName(event.target.value)} required minLength={2}/></label><label>שם מלא<input value={memberName} onChange={event => setMemberName(event.target.value)} required minLength={2}/></label><button type="submit"><ShieldCheck size={17}/>יצירת סביבת המשרד</button></form>{message && <div className="prod-error">{message}</div>}<button className="prod-link" onClick={() => capitalSupabase?.auth.signOut()}><LogOut size={14}/>התנתקות</button></section></div>

  return <div className="prod-app" dir="rtl"><header><div><span className="prod-logo"><FolderLock/></span><div><strong>הון.</strong><small>{membership.offices?.name ?? 'סביבת המשרד'}</small></div></div><div><span>{session.user.email}</span><em>{roleNames[membership.role] ?? membership.role}</em><button onClick={() => capitalSupabase?.auth.signOut()}><LogOut size={15}/>יציאה</button></div></header><main><SecureWorkspace clients={clients} officeId={membership.office_id} role={membership.role} userId={session.user.id} onRefresh={loadWorkspace}/>{message && <div className="prod-error">{message}</div>}<div className="prod-security"><ShieldCheck/><div><strong>סביבת הקמה ובדיקות</strong><p>יש להשלים הפעלת המסד, אימות נוסף ובדיקות בסביבת Supabase לפני הכנסת מידע אמיתי.</p></div></div></main></div>
}

function SecureMessage({ title, text }: { title: string; text: string }) {
  return <div className="prod-shell" dir="rtl"><section className="prod-login prod-message"><div className="prod-mark"><FolderLock /></div><h1>{title}</h1><p>{text}</p><a href="?">חזרה לדגם</a></section></div>
}
