import type { Metadata } from 'next'
import './globals.css'
import Footer from '@/components/Footer'
import Script from 'next/script'
import SessionListener from '@/components/SessionListener'

import { ToastProvider } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'Chatbolt — Autonomous AI Workforce Platform',
  description: 'Enterprise runtime for orchestrating, supervising, and budgeting autonomous AI agent teams.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const analyticsId = process.env.NEXT_PUBLIC_ANALYTICS_ID

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {analyticsId && (
          <Script
            id="analytics-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){
                  w[l] = w[l] || [];
                  w[l].push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
                })(window,document,'script','dataLayer','${analyticsId}');
              `,
            }}
          />
        )}
      </head>
      <body className="antialiased bg-background text-primary min-h-screen font-sans">
        <SessionListener />
        <ToastProvider>
          {children}
        </ToastProvider>
        <Footer />
      </body>
    </html>
  )
}
