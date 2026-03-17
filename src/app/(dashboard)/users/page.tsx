/**
 * @file app/(dashboard)/users/page.tsx
 * @description Gestão de usuários e funcionários.
 *
 * @module app/(dashboard)/users/page
 */

'use client';

import { useState }                              from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }               from 'framer-motion';
import {
  Plus, Pencil, Trash2, X, Check, Shield, Key,
  Crown, ChefHat, Wallet, Coffee, UserCheck,
} from 'lucide-react';
import { toast }       from 'sonner';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z }           from 'zod';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { useAuth }     from '@/hooks/use-auth';
import { formatDate, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos & constantes
// ---------------------------------------------------------------------------

interface User {
  id           : string;
  name         : string;
  email        : string;
  phone        : string | null;
  role         : string;
  status       : string;
  last_login_at: string | null;
  created_at   : string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  owner  : { label: 'Proprietário', icon: Crown,     color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',  desc: 'Acesso total ao sistema' },
  admin  : { label: 'Administrador',icon: Shield,    color: 'text-violet-400 bg-violet-400/10 border-violet-400/20', desc: 'Gerencia tudo exceto faturamento' },
  manager: { label: 'Gerente',      icon: UserCheck, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',    desc: 'Gerencia pedidos e cardápio' },
  cashier: { label: 'Caixa',        icon: Wallet,    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', desc: 'PDV e atendimento' },
  waiter : { label: 'Garçom',       icon: Coffee,    color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',    desc: 'Mesas e pedidos' },
  kitchen: { label: 'Cozinha',      icon: ChefHat,   color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', desc: 'Visualiza e atualiza pedidos' },
};

// ---------------------------------------------------------------------------
// Schema de formulário
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  name    : z.string().min(2, 'Mínimo 2 caracteres.').max(200),
  email   : z.string().email('E-mail inválido.'),
  role    : z.enum(['admin','manager','cashier','waiter','kitchen']),
  phone   : z.string().optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

// ---------------------------------------------------------------------------
// Modal de convite / edição
// ---------------------------------------------------------------------------

function UserFormModal({
  user, onClose,
}: {
  user?   : User;
  onClose : () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit      = !!user;

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<InviteFormValues>({
      resolver: zodResolver(isEdit ? inviteSchema.omit({ password: true }) : inviteSchema),
      defaultValues: user
        ? { name: user.name, email: user.email, role: user.role as InviteFormValues['role'], phone: user.phone ?? '' }
        : { role: 'cashier' },
    });

  const onSubmit = async (data: InviteFormValues) => {
    try {
      if (isEdit) {
        await apiPut(`/users/${user!.id}`, { name: data.name, role: data.role, phone: data.phone });
        toast.success('Usuário atualizado!');
      } else {
        await apiPost('/users', data);
        toast.success('Usuário convidado! Um e-mail de acesso foi enviado.');
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? 'Erro ao salvar usuário.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-soft-lg"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-sm font-bold">{isEdit ? 'Editar Usuário' : 'Convidar Funcionário'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Nome *</label>
            <input {...register('name')} placeholder="Nome completo"
              className={cn('h-9 w-full rounded-lg border bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all',
                errors.name ? 'border-destructive/60' : 'border-border/60')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">E-mail *</label>
            <input {...register('email')} type="email" placeholder="funcionario@email.com" disabled={isEdit}
              className={cn('h-9 w-full rounded-lg border bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-60',
                errors.email ? 'border-destructive/60' : 'border-border/60')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Telefone</label>
            <input {...register('phone')} placeholder="(84) 99999-0000"
              className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Cargo *</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'owner') as [string, typeof ROLE_CONFIG[string]][]).map(([value, cfg]) => (
                <label key={value}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-all',
                    'hover:border-primary/30',
                  )}
                >
                  <input type="radio" {...register('role')} value={value} className="mt-0.5 accent-primary" />
                  <div>
                    <p className="text-xs font-semibold">{cfg.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{cfg.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          {/* Senha (apenas criação) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">Senha inicial *</label>
              <input {...register('password')} type="password" placeholder="Mínimo 8 caracteres"
                className={cn('h-9 w-full rounded-lg border bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all',
                  errors.password ? 'border-destructive/60' : 'border-border/60')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              <p className="text-[10px] text-muted-foreground">O usuário pode alterar a senha pelo perfil.</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-border/60 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60">
              <Check className="h-4 w-4" />
              {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Convidar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: me, hasRole } = useAuth();
  const canManage = hasRole('owner', 'admin');

  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<User | undefined>();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn : () => apiGet('/users'),
  });

  const { mutate: deleteUser } = useMutation({
    mutationFn: (id: string) => apiDelete(`/users/${id}`),
    onSuccess : () => {
      toast.success('Usuário removido.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: unknown) => toast.error((e as { message?: string }).message ?? 'Erro ao remover.'),
  });

  const handleEdit  = (u: User) => { setEditing(u); setShowForm(true); };
  const handleClose = () => { setEditing(undefined); setShowForm(false); };

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">{users.length} funcionário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm">
            <Plus className="h-4 w-4" />Convidar Funcionário
          </button>
        )}
      </div>

      {/* Legenda de cargos */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <div key={key} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', cfg.color)}>
            <cfg.icon className="h-3 w-3" />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Grid de usuários */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
          <UserCheck className="h-12 w-12 text-muted-foreground/30" strokeWidth={1} />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => {
            const cfg       = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.cashier;
            const RoleIcon  = cfg.icon;
            const isMe      = u.id === me?.id;
            const isOwner   = u.role === 'owner';

            return (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'relative rounded-xl border border-border/60 bg-card p-4 shadow-soft',
                  u.status !== 'active' && 'opacity-60',
                )}
              >
                {/* Badge de cargo */}
                <div className={cn('mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', cfg.color)}>
                  <RoleIcon className="h-3 w-3" />
                  {cfg.label}
                </div>

                {isMe && (
                  <span className="absolute right-3 top-3 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Você
                  </span>
                )}

                {/* Info */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
                    <span className="text-sm font-bold text-primary">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {u.last_login_at
                      ? `Último acesso: ${formatDate(u.last_login_at)}`
                      : 'Nunca acessou'}
                  </span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 font-medium',
                    u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground',
                  )}>
                    {u.status === 'active' ? 'Ativo' : u.status === 'pending' ? 'Pendente' : 'Inativo'}
                  </span>
                </div>

                {/* Ações */}
                {canManage && !isMe && !isOwner && (
                  <div className="mt-3 flex items-center gap-1 border-t border-border/40 pt-3">
                    <button onClick={() => handleEdit(u)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      <Pencil className="h-3 w-3" />Editar
                    </button>
                    <button
                      onClick={() => confirm(`Remover "${u.name}"? O acesso será revogado imediatamente.`) && deleteUser(u.id)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <Trash2 className="h-3 w-3" />Remover
                    </button>
                    <button
                      onClick={() => {
                        const pin = prompt('Digite o novo PIN (4 a 6 dígitos):');
                        if (pin && /^\d{4,6}$/.test(pin)) {
                          apiPut(`/users/${u.id}/pin`, { pin })
                            .then(() => toast.success('PIN atualizado!'))
                            .catch(() => toast.error('Erro ao atualizar PIN.'));
                        } else if (pin) {
                          toast.error('PIN inválido. Use 4 a 6 dígitos numéricos.');
                        }
                      }}
                      className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      <Key className="h-3 w-3" />PIN
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && <UserFormModal user={editing} onClose={handleClose} />}
      </AnimatePresence>
    </div>
  );
}
