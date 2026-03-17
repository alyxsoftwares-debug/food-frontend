/**
 * @file components/providers/auth-provider.tsx
 * @description Provider de autenticação — restaura sessão e protege rotas.
 *
 * Responsabilidades:
 *  - Injeta o token store no cliente HTTP (uma única vez na inicialização)
 *  - Exibe loading screen enquanto a sessão está sendo restaurada do localStorage
 *  - Redireciona para /auth/login se não autenticado em rotas protegidas
 *
 * @module providers/auth
 */

'use client';

import { useEffect }           from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore }        from '@/stores/auth.store';
import { injectTokenStore }    from '@/lib/api';

// Rotas que não precisam de autenticação
const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/menu',          // Cardápio digital público
  '/mesa',          // Acesso via QR Code de mesa
  '/manifest.json', // Libera o arquivo manifest do erro 401
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router        = useRouter();
  const pathname      = usePathname();
  const store         = useAuthStore();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAuth        = useAuthStore((s) => s.isAuthenticated());

  // Injeta o token store no api.ts na montagem do provider
  useEffect(() => {
    injectTokenStore({
      getAccessToken : () => useAuthStore.getState().accessToken,
      getRefreshToken: () => useAuthStore.getState().refreshToken,
      setTokens      : (a, r) => useAuthStore.getState().setTokens(a, r),
      clearTokens    : () => useAuthStore.getState().clearTokens(),
    });

    // Marca como inicializado se o store já foi rehidratado
    if (!isInitialized) {
      store.setInitialized();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proteção de rotas
  useEffect(() => {
    if (!isInitialized) return;

    const onPublic = isPublicPath(pathname);

    if (!isAuth && !onPublic) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isAuth && pathname.startsWith('/login')) {
      router.replace('/dashboard');
    }
  }, [isInitialized, isAuth, pathname, router]);

  // Loading state enquanto restaura sessão do localStorage
  if (!isInitialized) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          {/* Logo animada */}
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-xl bg-primary/20 animate-ping" />
            <div className="relative h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-2xl">🍽</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
