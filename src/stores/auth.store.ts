/**
 * @file stores/auth.store.ts
 * @description Store global de autenticação com Zustand + persistência em localStorage.
 *
 * Responsabilidades:
 *  - Armazenar tokens (access + refresh) de forma persistida
 *  - Manter dados do usuário e empresa autenticados
 *  - Expor actions: login, logout, setTokens, clearTokens
 *  - Injetar o token store no cliente HTTP (lib/api.ts)
 *
 * Padrão de uso:
 *  - `useAuthStore()` dentro de Server Components é bloqueado (uso apenas em Client)
 *  - Para leitura em layouts, use o hook `useAuth()` de hooks/use-auth.ts
 *
 * @module stores/auth
 */

'use client';

import { create }             from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer }              from 'zustand/middleware/immer';
import { injectTokenStore }   from '@/lib/api';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type UserRole =
  | 'owner' | 'admin' | 'manager'
  | 'cashier' | 'waiter' | 'kitchen';

export interface AuthUser {
  id         : string;
  companyId  : string;
  name       : string;
  email      : string;
  role       : UserRole;
  permissions: Record<string, boolean>;
}

export interface AuthCompany {
  id    : string;
  name  : string;
  slug  : string;
  plan  : string;
  status: string;
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface AuthState {
  // State
  accessToken  : string | null;
  refreshToken : string | null;
  user         : AuthUser  | null;
  company      : AuthCompany | null;
  isInitialized: boolean;   // true após tentar restaurar sessão na inicialização

  // Actions
  setSession: (params: {
    accessToken : string;
    refreshToken: string;
    user        : AuthUser;
    company     : AuthCompany;
  }) => void;
  setTokens     : (access: string, refresh: string) => void;
  clearTokens   : () => void;
  logout        : () => void;
  setInitialized: () => void;
  updateUser    : (data: Partial<AuthUser>) => void;
  updateCompany : (data: Partial<AuthCompany>) => void;

  // Computed helpers (não persistidos)
  isAuthenticated: () => boolean;
  hasRole        : (...roles: UserRole[]) => boolean;
  can            : (permission: string) => boolean;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      // -----------------------------------------------------------------------
      // State inicial
      // -----------------------------------------------------------------------
      accessToken  : null,
      refreshToken : null,
      user         : null,
      company      : null,
      isInitialized: false,

      // -----------------------------------------------------------------------
      // Actions
      // -----------------------------------------------------------------------

      setSession: ({ accessToken, refreshToken, user, company }) => {
        set((state) => {
          state.accessToken  = accessToken;
          state.refreshToken = refreshToken;
          state.user         = user;
          state.company      = company;
        });

        // Salva slug da empresa no localStorage para o interceptor do api.ts
        if (typeof window !== 'undefined') {
          localStorage.setItem('company_slug', company.slug);
        }
      },

      setTokens: (access, refresh) => {
        set((state) => {
          state.accessToken  = access;
          state.refreshToken = refresh;
        });
      },

      clearTokens: () => {
        set((state) => {
          state.accessToken  = null;
          state.refreshToken = null;
        });
      },

      logout: () => {
        set((state) => {
          state.accessToken  = null;
          state.refreshToken = null;
          state.user         = null;
          state.company      = null;
        });

        if (typeof window !== 'undefined') {
          localStorage.removeItem('company_slug');
        }
      },

      setInitialized: () => {
        set((state) => {
          state.isInitialized = true;
        });
      },

      updateUser: (data) => {
        set((state) => {
          if (state.user) {
            Object.assign(state.user, data);
          }
        });
      },

      updateCompany: (data) => {
        set((state) => {
          if (state.company) {
            Object.assign(state.company, data);
          }
        });
      },

      // -----------------------------------------------------------------------
      // Computed helpers
      // -----------------------------------------------------------------------

      isAuthenticated: () => {
        const { accessToken, user } = get();
        return !!accessToken && !!user;
      },

      hasRole: (...roles) => {
        const { user } = get();
        if (!user) return false;
        return roles.includes(user.role);
      },

      can: (permission) => {
        const { user } = get();
        if (!user) return false;
        // Owners e admins têm tudo
        if (['owner', 'admin'].includes(user.role)) return true;
        return user.permissions?.[permission] === true;
      },
    })),

    // -------------------------------------------------------------------------
    // Persistência — apenas tokens e dados de sessão
    // -------------------------------------------------------------------------
    {
      name   : 'food-saas-auth',
      storage: createJSONStorage(() => localStorage),

      // Persiste apenas os campos necessários (não persiste computed helpers)
      partialize: (state) => ({
        accessToken : state.accessToken,
        refreshToken: state.refreshToken,
        user        : state.user,
        company     : state.company,
      }),

      // Após rehidratar do localStorage, injeta o token store no api.ts
      onRehydrateStorage: () => (state) => {
        if (state) {
          injectTokenStore({
            getAccessToken : () => state.accessToken,
            getRefreshToken: () => state.refreshToken,
            setTokens      : (a, r) => state.setTokens(a, r),
            clearTokens    : () => state.clearTokens(),
          });

          state.setInitialized();
        }
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Seletores tipados — evitam re-renders desnecessários
// ---------------------------------------------------------------------------

export const selectUser        = (s: AuthState) => s.user;
export const selectCompany     = (s: AuthState) => s.company;
export const selectAccessToken = (s: AuthState) => s.accessToken;
export const selectIsAuth      = (s: AuthState) => s.isAuthenticated();
export const selectRole        = (s: AuthState) => s.user?.role;
