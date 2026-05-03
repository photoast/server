import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import KakaoProvider from 'next-auth/providers/kakao'
import { findOrCreateUser } from './models'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false
      const provider = account.provider as 'google' | 'kakao'
      await findOrCreateUser({
        provider,
        providerId: account.providerAccountId,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        profileImage: user.image ?? undefined,
      })
      return true
    },
    async jwt({ token, account }) {
      if (account) {
        const provider = account.provider as 'google' | 'kakao'
        const dbUser = await findOrCreateUser({
          provider,
          providerId: account.providerAccountId,
          email: token.email ?? undefined,
          name: token.name ?? undefined,
          profileImage: token.picture ?? undefined,
        })
        token.userId = dbUser._id!.toString()
        token.credits = dbUser.credits
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId
        ;(session.user as any).credits = token.credits
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
