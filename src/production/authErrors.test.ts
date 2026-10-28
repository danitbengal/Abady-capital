import {describe,expect,it} from 'vitest'
import {authFailureMessage,authFailureReference} from './authErrors'
describe('safe email-code failure diagnostics',()=>{
  it('distinguishes rate limits, restricted recipients, provider setup and connection credentials',()=>{
    expect(authFailureMessage({status:429})).toContain('מגבלת')
    expect(authFailureMessage({code:'email_address_not_authorized'})).toContain('SMTP')
    expect(authFailureMessage({code:'otp_disabled'})).toContain('המשתמש קיים')
    expect(authFailureMessage({status:401})).toContain('הגדרות החיבור')
    expect(authFailureMessage({status:500})).toContain('יומן השגיאות')
  })
  it('only exposes a bounded status and error identifier, never arbitrary messages',()=>{
    const error={code:'email_address_not_authorized',status:403,message:'secret and personal information'}
    expect(authFailureReference(error)).toBe('email_address_not_authorized · HTTP 403')
    expect(authFailureReference({code:'private@example.com',status:123456})).toBe('unknown · HTTP unknown')
    expect(authFailureMessage(error)+authFailureReference(error)).not.toContain('secret')
  })
  it('recognizes SDK network errors instead of displaying unknown HTTP failures',()=>{
    const error={status:0,name:'AuthRetryableFetchError'}
    expect(authFailureMessage(error)).toContain('הדפדפן לא קיבל תשובה')
    expect(authFailureReference(error)).toBe('network_error · HTTP unavailable')
  })
})
