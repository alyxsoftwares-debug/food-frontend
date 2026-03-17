/**
 * @file app/layout.tsx
 * @description Root layout da aplicação — configura providers globais.
 *
 * Hierarquia de providers:
 *  ThemeProvider → QueryProvider → AuthProvider → Toaster → children
 *
 * @module app/layout
 */

import type { Metadata, Viewport } from 'next';
import { Inter }                   from 'next/font/google';
import { ThemeProvider }           from '@/components/providers/theme-provider';
import { QueryProvider }           from '@/components/providers/query-provider';
import { AuthProvider }            from '@/components/providers/auth-provider';
import '@/app/globals.css';

// ---------------------------------------------------------------------------
// Fontes
// ---------------------------------------------------------------------------

const inter = Inter({
  subsets   : ['latin'],
  variable  : '--font-inter',
  display   : 'swap',
  preload   : true,
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: {
    template: `%s | ${process.env.NEXT_PUBLIC_APP_NAME ?? 'Food SaaS'}`,
    default : process.env.NEXT_PUBLIC_APP_NAME ?? 'Food SaaS',
  },
  description: 'Sistema de gestão completo para restaurantes e delivery',
  keywords   : ['restaurante', 'delivery', 'gestão', 'cardápio digital', 'PDV'],
  authors    : [{ name: 'Food SaaS' }],
  robots     : { index: false, follow: false }, // Painel admin não deve ser indexado
  icons: {
    icon  : '/favicon.ico',
    apple : '/apple-touch-icon.png',
  },
  // manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor     : '#FF6600',
  width          : 'device-width',
  initialScale   : 1,
  maximumScale   : 1,  // Desabilita zoom no mobile (UX de app nativo)
  userScalable   : false,
};

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning  // Necessário para next-themes (evita mismatch SSR/CSR)
    >
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
