/**
 * @file lib/api.ts
 * @description Cliente HTTP centralizado para comunicação com o backend.
 *
 * Responsabilidades:
 *  - Instância Axios configurada com base URL e headers padrão
 *  - Interceptor de request: injeta o Bearer token automaticamente
 *  - Interceptor de response: normaliza erros e renova token expirado (refresh)
 *  - Fila de requests durante o refresh (evita múltiplos refreshes simultâneos)
 *  - Tipagem forte de erros (ApiError) para uso nos components
 *
 * @module lib/api
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

// ---------------------------------------------------------------------------
// Tipagem de erros da API
// ---------------------------------------------------------------------------

export interface ApiErrorDetail {
  field  : string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  error  : {
    code   : string;
    message: string;
    errors?: ApiErrorDetail[];
    meta?  : Record<string, unknown>;
  };
}

export class ApiError extends Error {
  public readonly statusCode : number;
  public readonly errorCode  : string;
  public readonly errors?    : ApiErrorDetail[];
  public readonly meta?      : Record<string, unknown>;

  constructor(body: ApiErrorBody, statusCode: number) {
    super(body.error.message);
    this.name       = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode  = body.error.code;
    this.errors     = body.error.errors;
    this.meta       = body.error.meta;
  }

  /** Verifica se é um erro de campo específico */
  hasFieldError(field: string): boolean {
    return this.errors?.some((e) => e.field === field) ?? false;
  }

  /** Retorna a mensagem de erro de um campo específico */
  getFieldError(field: string): string | undefined {
    return this.errors?.find((e) => e.field === field)?.message;
  }
}

// ---------------------------------------------------------------------------
// Tipagem do token store (injetado pelo auth store em runtime)
// ---------------------------------------------------------------------------

interface TokenStore {
  getAccessToken : () => string | null;
  getRefreshToken: () => string | null;
  setTokens      : (access: string, refresh: string) => void;
  clearTokens    : () => void;
}

let tokenStore: TokenStore | null = null;

/**
 * Injeta o token store após inicialização do auth store.
 * Chamado uma única vez em providers/auth-provider.tsx.
 */
export function injectTokenStore(store: TokenStore): void {
  tokenStore = store;
}

// ---------------------------------------------------------------------------
// Fila de requests durante o refresh de token
// Evita múltiplas chamadas a /auth/refresh quando o token expira
// e há requests paralelos em andamento.
// ---------------------------------------------------------------------------

let isRefreshing              = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject : (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null): void {
  for (const { resolve, reject } of refreshQueue) {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  }
  refreshQueue = [];
}

// ---------------------------------------------------------------------------
// Instância Axios
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL        : API_BASE_URL,
  timeout        : 30_000,
  headers        : {
    'Content-Type': 'application/json',
    'Accept'      : 'application/json',
  },
  withCredentials: false,  // Tokens via header Authorization, não cookies
});

// ---------------------------------------------------------------------------
// Interceptor de REQUEST — injeta token e request ID
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Injeta Bearer token
    const token = tokenStore?.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Injeta request ID para rastreabilidade (correlaciona com logs do backend)
    config.headers['x-request-id'] = generateRequestId();

    // Injeta slug da empresa se disponível (usado em operações multi-tenant)
    const companySlug = getCompanySlugFromPath();
    if (companySlug) {
      config.headers['x-company-slug'] = companySlug;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Interceptor de RESPONSE — normaliza erros e renova token
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // -------------------------------------------------------------------------
    // Token expirado (401 com código específico) — tenta renovar
    // -------------------------------------------------------------------------
    const isTokenExpired =
      error.response?.status === 401 &&
      (error.response.data?.error?.code === 'TOKEN_EXPIRED' ||
       error.response.data?.error?.code === 'TOKEN_INVALID') &&
      !originalRequest._retry &&
      !!tokenStore?.getRefreshToken();

    if (isTokenExpired) {
      // Já está renovando — enfileira e aguarda
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing            = true;

      try {
        const refreshToken = tokenStore!.getRefreshToken()!;

        // Chama o endpoint de refresh sem passar pelo interceptor de auth
        const { data } = await axios.post<{
          data: { accessToken: string; refreshToken: string };
        }>(`${API_BASE_URL}/auth/refresh`, { refreshToken });

        const { accessToken, refreshToken: newRefresh } = data.data;

        tokenStore!.setTokens(accessToken, newRefresh);
        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh falhou — desloga o usuário
        processQueue(refreshError, null);
        tokenStore?.clearTokens();
        window.location.href = '/login?reason=session_expired';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // -------------------------------------------------------------------------
    // Timeout
    // -------------------------------------------------------------------------
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(
        new ApiError(
          {
            success: false,
            error  : {
              code   : 'REQUEST_TIMEOUT',
              message: 'A requisição demorou muito. Verifique sua conexão e tente novamente.',
            },
          },
          408,
        ),
      );
    }

    // -------------------------------------------------------------------------
    // Sem conexão com o servidor
    // -------------------------------------------------------------------------
    if (!error.response) {
      return Promise.reject(
        new ApiError(
          {
            success: false,
            error  : {
              code   : 'NETWORK_ERROR',
              message: 'Sem conexão com o servidor. Verifique sua internet.',
            },
          },
          0,
        ),
      );
    }

    // -------------------------------------------------------------------------
    // Erro da API com body estruturado
    // -------------------------------------------------------------------------
    if (error.response.data?.error) {
      return Promise.reject(
        new ApiError(error.response.data, error.response.status),
      );
    }

    // -------------------------------------------------------------------------
    // Erro HTTP sem body estruturado (ex: 500 com HTML do servidor)
    // -------------------------------------------------------------------------
    return Promise.reject(
      new ApiError(
        {
          success: false,
          error  : {
            code   : 'UNEXPECTED_ERROR',
            message: `Erro inesperado (${error.response.status}). Tente novamente.`,
          },
        },
        error.response.status,
      ),
    );
  },
);

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCompanySlugFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  // Extrai slug da URL: /dashboard/[slug]/... ou de localStorage
  const stored = localStorage.getItem('company_slug');
  return stored ?? null;
}

// ---------------------------------------------------------------------------
// Helpers de requisição tipados
// ---------------------------------------------------------------------------

/** Wrapper tipado para GET requests */
export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.get<{ success: true; data: T }>(url, config);
  return data.data;
}

/** Wrapper tipado para POST requests */
export async function apiPost<T>(
  url  : string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.post<{ success: true; data: T }>(url, body, config);
  return data.data;
}

/** Wrapper tipado para PUT requests */
export async function apiPut<T>(
  url  : string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.put<{ success: true; data: T }>(url, body, config);
  return data.data;
}

/** Wrapper tipado para PATCH requests */
export async function apiPatch<T>(
  url  : string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.patch<{ success: true; data: T }>(url, body, config);
  return data.data;
}

/** Wrapper tipado para DELETE requests */
export async function apiDelete<T = void>(
  url    : string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.delete<{ success: true; data: T }>(url, config);
  return data.data;
}
