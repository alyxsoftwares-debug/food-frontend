/**
 * @file app/(dashboard)/customers/page.tsx
 * @description Base de clientes com busca, estatísticas e histórico de pedidos.
 *
 * @module app/(dashboard)/customers/page
 */

'use client';

import { useState }                              from 'react';
import { useQuery }                              from '@tanstack/react-query';
import { motion, AnimatePresence }               from 'framer-motion';
import {
  Search, Users, ShoppingBag, TrendingUp,
  X, Phone, Mail, MapPin, Calendar,
  ChevronRight, Clock,
} from 'lucide-react';
import { useDebounce }     from 'use-debounce';
import { apiGet }          from '@/lib/api';
import {
  formatCurrency, formatDate, formatRelative,
  formatOrderNumber, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, cn,
} from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Customer {
  id            : string;
  name          : string;
  phone         : string;
  email         : string | null;
  address_city  : string | null;
  address_state : string | null;
  total_orders  : number;
  total_spent   : number;
  last_order_at : string | null;
  notes         : string | null;
  tags          : string[];
  created_at    : string;
}

interface CustomerOrder {
  id               : string;
  sequential_number: number;
  type             : string;
  status           : string;
  total            : number;
  payment_status   : string;
  created_at       : string;
  delivered_at     : string | null;
}

interface CustomersResponse {
  customers : Customer[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ---------------------------------------------------------------------------
// Painel de detalhes do cliente
// ---------------------------------------------------------------------------

function CustomerDetailPanel({
  customer, onClose,
}: {
  customer: Customer;
  onClose : () => void;
}) {
  const { data: orders = [], isLoading } = useQuery<CustomerOrder[]>({
    queryKey: ['customer-orders', customer.id],
    queryFn : () => apiGet(`/customers/${customer.id}/orders`),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-border bg-card shadow-soft-lg"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
              <span className="text-sm font-bold text-primary">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold">{customer.name}</p>
              <p className="text-xs text-muted-foreground">
                Cliente desde {formatDate(customer.created_at)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* KPIs do cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Gasto</p>
              <p className="mt-1 font-mono text-lg font-bold text-primary">
                {formatCurrency(customer.total_spent)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pedidos</p>
              <p className="mt-1 font-mono text-lg font-bold">
                {customer.total_orders}
              </p>
            </div>
          </div>

          {/* Ticket médio */}
          {customer.total_orders > 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ticket médio</span>
                <span className="font-mono text-sm font-semibold">
                  {formatCurrency(customer.total_spent / customer.total_orders)}
                </span>
              </div>
              {customer.last_order_at && (
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Último pedido</span>
                  <span className="text-xs">{formatRelative(customer.last_order_at)}</span>
                </div>
              )}
            </div>
          )}

          {/* Contato */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</h3>
            <div className="rounded-xl border border-border/60 divide-y divide-border/40">
              <a href={`tel:${customer.phone}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm">{customer.phone}</span>
              </a>
              {customer.email && (
                <a href={`mailto:${customer.email}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate">{customer.email}</span>
                </a>
              )}
              {(customer.address_city || customer.address_state) && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    {[customer.address_city, customer.address_state].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {customer.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.map((tag) => (
                <span key={tag} className="tag-chip">{tag}</span>
              ))}
            </div>
          )}

          {/* Notas */}
          {customer.notes && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-300">{customer.notes}</p>
            </div>
          )}

          {/* Histórico de pedidos */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Histórico de Pedidos
            </h3>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 text-center">
                <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/30" strokeWidth={1} />
                <p className="mt-2 text-xs text-muted-foreground">Nenhum pedido encontrado.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {orders.map((order) => (
                  <div key={order.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {formatOrderNumber(order.sequential_number)}
                        </span>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          ORDER_STATUS_COLORS[order.status] ?? 'text-muted-foreground bg-muted border-border',
                        )}>
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(order.created_at, true)}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold tabular-nums">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function CustomersPage() {
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<Customer | null>(null);

  const [debouncedSearch] = useDebounce(search, 350);

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ['customers', { search: debouncedSearch, page }],
    queryFn : () => {
      const p = new URLSearchParams({
        page: String(page), limit: '20',
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      return apiGet(`/customers?${p}`);
    },
    placeholderData: (prev) => prev,
  });

  const customers  = data?.customers  ?? [];
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total} cliente{pagination.total !== 1 ? 's' : ''} cadastrado{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nome, telefone ou e-mail..."
          className="h-9 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
        />
        {search && (
          <button onClick={() => { setSearch(''); setPage(1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              {['Cliente','Contato','Pedidos','Total Gasto','Último Pedido',''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="skeleton h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {debouncedSearch ? `Nenhum resultado para "${debouncedSearch}".` : 'Nenhum cliente cadastrado ainda.'}
                  </p>
                  {debouncedSearch && (
                    <button onClick={() => setSearch('')} className="mt-1 text-xs text-primary hover:underline">
                      Limpar busca
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <motion.tr
                  key={customer.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => setSelected(customer)}
                >
                  {/* Nome */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
                        <span className="text-xs font-bold text-primary">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground leading-none">{customer.name}</p>
                        {customer.tags?.length > 0 && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {customer.tags.slice(0, 2).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Contato */}
                  <td className="px-4 py-3">
                    <p className="text-sm">{customer.phone}</p>
                    {customer.email && (
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{customer.email}</p>
                    )}
                  </td>

                  {/* Pedidos */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm tabular-nums">{customer.total_orders}</span>
                    </div>
                  </td>

                  {/* Total gasto */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        {formatCurrency(customer.total_spent)}
                      </span>
                    </div>
                  </td>

                  {/* Último pedido */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {customer.last_order_at
                        ? formatRelative(customer.last_order_at)
                        : '—'}
                    </div>
                  </td>

                  {/* Ação */}
                  <td className="px-4 py-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {pagination.page} de {pagination.totalPages} · {pagination.total} clientes</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded-lg border border-border/60 px-3 py-1.5 hover:bg-muted disabled:opacity-40 transition-all">← Ant.</button>
            <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              className="rounded-lg border border-border/60 px-3 py-1.5 hover:bg-muted disabled:opacity-40 transition-all">Próx. →</button>
          </div>
        </div>
      )}

      {/* Panel de detalhes */}
      <AnimatePresence>
        {selected && (
          <CustomerDetailPanel
            customer={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
