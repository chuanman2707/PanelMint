import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { LandingPageClient } from '@/components/public/LandingPageClient'

export default async function LandingPage() {
    const { userId } = await auth()

    if (userId) {
        redirect('/dashboard')
    }

    return <LandingPageClient />
}
