/**
 * @file app/(auth)/login/page.tsx
 * @description Página de login — design premium, dark, sofisticado.
 *
 * UX:
 *  - Validação em tempo real com React Hook Form + Zod
 *  - Feedback visual de erro por campo
 *  - Animação de entrada escalonada (staggered)
 *  - Loading state no botão durante o login
 *  - Redirect automático pós-login para a rota original
 *
 * @module app/(auth)/login
 */

'use client';

import { useState, useEffect }        from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm }                    from 'react-hook-form';
import { zodResolver }                from '@hookform/resolvers/zod';
import { z }                          from 'zod';
import { motion }                     from 'framer-motion';
import { Eye, EyeOff, Loader2, ChefHat, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { toast }                      from 'sonner';
import { apiPost }                    from '@/lib/api';
import { useAuthStore }               from '@/stores/auth.store';
import type { AuthUser, AuthCompany } from '@/stores/auth.store';

// ---------------------------------------------------------------------------
// Schema de validação
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email   : z.string().email('E-mail inválido.').min(1, 'E-mail obrigatório.'),
  password: z.string().min(1, 'Senha obrigatória.'),
});

type LoginForm = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Tipos da resposta da API
// ---------------------------------------------------------------------------

interface LoginResponse {
  accessToken : string;
  refreshToken: string;
  expiresIn   : number;
  user        : AuthUser;
  company     : AuthCompany;
}

// ---------------------------------------------------------------------------
// Animações Framer Motion
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden : {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden : { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const setSession   = useAuthStore((s) => s.setSession);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [isOnline,     setIsOnline]     = useState(true);

  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const reason     = searchParams.get('reason');

  // Monitora conexão
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Notificação de sessão expirada
  useEffect(() => {
    if (reason === 'session_expired') {
      toast.warning('Sua sessão expirou. Faça login novamente.', { id: 'session-expired' });
    }
  }, [reason]);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setError,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode    : 'onTouched',
  });

  const onSubmit = async (data: LoginForm) => {
    if (!isOnline) {
      toast.error('Sem conexão com a internet.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiPost<LoginResponse>('/login', data);

      setSession({
        accessToken : response.accessToken,
        refreshToken: response.refreshToken,
        user        : response.user,
        company     : response.company,
      });

      toast.success(`Bem-vindo, ${response.user.name.split(' ')[0]}! 👋`);
      router.replace(redirectTo);
    } catch (err: unknown) {
      const error = err as { statusCode?: number; errorCode?: string; message?: string };

      if (error?.statusCode === 401) {
        setError('email',    { message: '' });
        setError('password', { message: 'E-mail ou senha incorretos.' });
        return;
      }

      if (error?.errorCode === 'USER_INACTIVE') {
        toast.error('Conta inativa. Contate o administrador.');
        return;
      }

      if (error?.errorCode === 'COMPANY_SUSPENDED') {
        toast.error('Empresa suspensa. Entre em contato com o suporte.');
        return;
      }

      toast.error(error?.message ?? 'Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#090C10] flex items-center justify-center">

      {/* ── Background — grade geométrica sutil ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── Glow radial na marca laranja ── */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
        style={{
          width : '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
        }}
      />

      {/* ── Card de login ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-md px-6"
      >

        {/* Logo + Nome */}
        <motion.div variants={itemVariants} className="mb-10 text-center">
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-glow">
            <ChefHat className="h-8 w-8 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Food SaaS
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gestão inteligente para o seu negócio
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-soft-lg"
        >
          <div className="mb-7">
            <h2 className="text-lg font-semibold text-white">Entrar na conta</h2>
            <p className="mt-1 text-sm text-slate-400">
              Use suas credenciais de acesso
            </p>
          </div>

          {/* Banner offline */}
          {!isOnline && (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5">
              <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300">Sem conexão com a internet</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

            {/* Campo: E-mail */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-slate-300">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="seu@email.com"
                {...register('email')}
                className={`
                  w-full rounded-lg border bg-slate-800/60 px-3.5 py-2.5
                  text-sm text-white placeholder:text-slate-500
                  transition-all duration-150 outline-none
                  focus:ring-2 focus:ring-primary/60 focus:border-primary/60
                  ${errors.email
                    ? 'border-destructive/60 focus:ring-destructive/40 focus:border-destructive/60'
                    : 'border-slate-700/60 hover:border-slate-600/60'
                  }
                `}
              />
              {errors.email?.message && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive"
                >
                  {errors.email.message}
                </motion.p>
              )}
            </div>

            {/* Campo: Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-medium text-slate-300">
                  Senha
                </label>
                <a
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Esqueci a senha
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={`
                    w-full rounded-lg border bg-slate-800/60 px-3.5 py-2.5 pr-10
                    text-sm text-white placeholder:text-slate-500
                    transition-all duration-150 outline-none
                    focus:ring-2 focus:ring-primary/60 focus:border-primary/60
                    ${errors.password
                      ? 'border-destructive/60 focus:ring-destructive/40 focus:border-destructive/60'
                      : 'border-slate-700/60 hover:border-slate-600/60'
                    }
                  `}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye    className="h-4 w-4" />
                  }
                </button>
              </div>
              {errors.password?.message && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive"
                >
                  {errors.password.message}
                </motion.p>
              )}
            </div>

            {/* Botão de submit */}
            <button
              type="submit"
              disabled={isLoading || !isOnline}
              className={`
                group relative w-full overflow-hidden rounded-lg px-4 py-2.5
                text-sm font-semibold text-white transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary/60 focus-visible:ring-offset-2
                focus-visible:ring-offset-slate-900
                ${isLoading || !isOnline
                  ? 'cursor-not-allowed opacity-60 bg-primary'
                  : 'bg-primary hover:bg-primary/90 active:scale-[0.98] shadow-glow-sm hover:shadow-glow'
                }
              `}
            >
              {/* Shimmer no hover */}
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />

              <span className="relative flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </>
                )}
              </span>
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="mt-6 text-center text-xs text-slate-600"
        >
          © {new Date().getFullYear()} Food SaaS. Todos os direitos reservados.
        </motion.p>

        {/* Indicador de conexão discreto */}
        <motion.div
          variants={itemVariants}
          className="mt-3 flex items-center justify-center gap-1.5"
        >
          {isOnline
            ? <Wifi    className="h-3 w-3 text-emerald-500" />
            : <WifiOff className="h-3 w-3 text-amber-500"   />
          }
          <span className={`text-[11px] ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
            {isOnline ? 'Conectado' : 'Sem conexão'}
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
