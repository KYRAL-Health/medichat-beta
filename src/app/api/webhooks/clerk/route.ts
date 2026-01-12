import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { db } from '@/server/db'
import { users, userEmails } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!SIGNING_SECRET) {
    throw new Error('Error: Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env')
  }

  const wh = new Webhook(SIGNING_SECRET)
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  let evt: any

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    })
  } catch (err) {
    console.error('Error: Could not verify webhook:', err)
    return new Response('Error: Verification error', { status: 400 })
  }

  const eventType = evt.type

  const getEmailFromEvtData = (data: any): string | undefined => {
    if (!data) return undefined
    // Common Clerk shapes: data.email, data.email_address, data.primary_email_address,
    // data.email_addresses = [{ email_address, primary }]
    if (typeof data.email === 'string') return data.email
    if (typeof data.email_address === 'string') return data.email_address
    if (typeof data.primary_email_address === 'string') return data.primary_email_address
    if (data.primary_email_address && typeof data.primary_email_address.email_address === 'string')
      return data.primary_email_address.email_address
    if (Array.isArray(data.email_addresses)) {
      const primary = data.email_addresses.find((e: any) => e?.primary)
      if (primary && typeof primary.email_address === 'string') return primary.email_address
      if (data.email_addresses[0] && typeof data.email_addresses[0].email_address === 'string')
        return data.email_addresses[0].email_address
    }
    if (data.profile && typeof data.profile.email === 'string') return data.profile.email
    return undefined
  }

  if (eventType === 'user.created') {
    const { id } = evt.data
    try {
      await db.insert(users).values({ clerkUserId: id })
      console.log(`User created in database: ${id}`)
    } catch (error) {
      console.error('Error creating user in database:', error)
      return new Response('Error: Database error', { status: 500 })
    }

    // store email if present
    try {
      const email = getEmailFromEvtData(evt.data)
      if (email) {
        try {
          await db.insert(userEmails).values({ email })
        } catch (e) {
          // ignore duplicate / constraint errors
          console.debug('user_emails insert skipped:', e)
        }
      }
    } catch (e) {
      console.error('Error storing user email (created):', e)
    }
  }

  if (eventType === 'user.updated') {
    const { id } = evt.data
    try {
      await db
        .update(users)
        .set({ updatedAt: new Date() })
        .where(eq(users.clerkUserId, id))
      console.log(`User updated in database: ${id}`)
    } catch (error) {
      console.error('Error updating user in database:', error)
    }

    // store/update email if present
    try {
      const email = getEmailFromEvtData(evt.data)
      if (email) {
        try {
          await db.insert(userEmails).values({ email })
        } catch (e) {
          // ignore duplicate / constraint errors
          console.debug('user_emails insert skipped:', e)
        }
      }
    } catch (e) {
      console.error('Error storing user email (updated):', e)
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data
    if (id) {
      try {
        await db.delete(users).where(eq(users.clerkUserId, id))
        console.log(`User deleted from database: ${id}`)
      } catch (error) {
        console.error('Error deleting user from database:', error)
      }
    }
  }

  return new Response('Webhook processed', { status: 200 })
}
