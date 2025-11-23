import bcrypt from 'bcryptjs'
import { findAdminByUsername } from './models'

export async function verifyAdmin(username: string, password: string): Promise<boolean> {
  // Check if it's the default admin from env
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return true
  }

  // Check database for admin users
  const admin = await findAdminByUsername(username)
  if (!admin) {
    return false
  }

  return bcrypt.compare(password, admin.passwordHash)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}
