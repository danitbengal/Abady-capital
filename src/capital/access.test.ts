import { describe, expect, it } from 'vitest'
import { canAccessClient } from './access'

describe('client access control', () => {
  const client = { manager: 'דנית בן גל', grantedUsers: ['מנהלת חשבונות מורשית'] }

  it('limits office staff to assigned or explicitly shared clients', () => {
    expect(canAccessClient({ name: 'דנית בן גל', role: 'accountant' }, client)).toBe(true)
    expect(canAccessClient({ name: 'עובד אחר', role: 'accountant' }, client)).toBe(false)
  })

  it('blocks a bookkeeper unless the specific client was granted', () => {
    expect(canAccessClient({ name: 'מנהלת חשבונות ללא הרשאה', role: 'bookkeeper' }, client)).toBe(false)
    expect(canAccessClient({ name: 'מנהלת חשבונות מורשית', role: 'bookkeeper' }, client)).toBe(true)
  })

  it('allows an administrator to manage all client permissions', () => {
    expect(canAccessClient({ name: 'מנהלת מערכת', role: 'administrator' }, { manager: 'עובד אחר' })).toBe(true)
  })
})
