export type OfficeRole = 'administrator' | 'accountant' | 'bookkeeper'

export interface OfficeUser {
  name: string
  role: OfficeRole
}

export interface ClientAccess {
  manager: string
  grantedUsers?: string[]
}

export function canAccessClient(user: OfficeUser, client: ClientAccess): boolean {
  if (user.role === 'administrator') return true
  if (user.role === 'bookkeeper') return client.grantedUsers?.includes(user.name) ?? false
  return client.manager === user.name || (client.grantedUsers?.includes(user.name) ?? false)
}
