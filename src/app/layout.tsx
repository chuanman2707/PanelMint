import type { Metadata } from "next";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PanelMint — AI Comic Generator",
  description: "Turn stories into comics with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} ${inter.variable}`}>
      <body className="antialiased bg-[var(--neo-bg-canvas)] text-[var(--neo-ink)] min-h-screen">
        <ClerkProvider
          signInUrl="/auth/signin"
          signUpUrl="/auth/signup"
          afterSignOutUrl="/auth/signin"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
