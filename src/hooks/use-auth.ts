/**
 * @file hooks/use-auth.ts
 * @description Hook centralizado para consumir o auth store.
 *
 * Encapsula os seletores mais usados e expõe actions de forma limpa,
 * evitando que os componentes importem o store diretamente.
 *
 * @module hooks/use-auth
 */

'use client';

import { useCallback }             from 'react';
import { useRouter }               from 'next/navigation';
import { toast }                   from 'sonner';
import { useAuthStore }            from '@/stores/auth.store';
import { apiPost }                 from '@/lib/api';
import type { UserRole }           from '@/stores/auth.store';

export function useAuth() {
  const router  = useRouter();
  const store   = useAuthStore();

  const user    = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const isAuth  = useAuthStore((s) => s.isAuthenticated());

  // ---------------------------------------------------------------------------
  // logout — invalida sessão no backend e limpa store local
  // ---------------------------------------------------------------------------

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout');
    } catch {
      // Ignora erros — o logout local sempre ocorre
    } finally {
      store.logout();
      router.replace('/login');
      toast.success('Sessão encerrada.');
    }
  }, [store, router]);

  // ---------------------------------------------------------------------------
  // Helpers de role e permissão
  // ---------------------------------------------------------------------------

  const hasRole = useCallback(
    (...roles: UserRole[]) => store.hasRole(...roles),
    [store],
  );

  const can = useCallback(
    (permission: string) => store.can(permission),
    [store],
  );

  const isAdmin  = hasRole('owner', 'admin');
  const isOwner  = hasRole('owner');
  const isKitchen = hasRole('kitchen');

  return {
    user,
    company,
    isAuth,
    isAdmin,
    isOwner,
    isKitchen,
    logout,
    hasRole,
    can,
    updateUser   : store.updateUser,
    updateCompany: store.updateCompany,
  };
}
