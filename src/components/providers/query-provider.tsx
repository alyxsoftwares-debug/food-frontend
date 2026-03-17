/**
 * @file components/providers/query-provider.tsx
 * @description Provider do React Query com defaults otimizados para o painel.
 *
 * @module providers/query
 */

'use client';

import { useState }                                  from 'react';
import { QueryClient, QueryClientProvider }          from '@tanstack/react-query';
import { ReactQueryDevtools }                        from '@tanstack/react-query-devtools';
import { ApiError }                                  from '@/lib/api';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Dados considerados frescos por 30s — evita refetch desnecessário
        staleTime          : 30 * 1000,
        // Cache mantido por 5 minutos após o componente desmontar
        gcTime             : 5 * 60 * 1000,
        // Não refetch ao focar a janela (painel fica o dia todo aberto)
        refetchOnWindowFocus: false,
        // Retry apenas em erros de rede, não em erros da API (4xx)
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.statusCode < 500) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: sempre cria um novo client
    return makeQueryClient();
  }

  // Browser: reutiliza o mesmo client (singleton)
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Usa useState para garantir que o client não seja recriado em re-renders
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
