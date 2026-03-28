import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
    '/auth(.*)',
    '/api/auth(.*)',
    '/api/health',
    '/api/inngest(.*)',
    '/api/webhooks/clerk',
])

export default clerkMiddleware(
    async (auth, request) => {
        if (isPublicRoute(request) || request.nextUrl.pathname.startsWith('/api/')) {
            return
        }

        await auth.protect()
    },
    {
        signInUrl: '/auth/signin',
        signUpUrl: '/auth/signup',
    },
)

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
}
