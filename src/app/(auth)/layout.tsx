/**
 * @file app/(auth)/layout.tsx
 * @description Layout do grupo de rotas de autenticação.
 * Rotas filhas: /login, /forgot-password, /reset-password
 * Sem sidebar ou navbar — tela cheia.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
