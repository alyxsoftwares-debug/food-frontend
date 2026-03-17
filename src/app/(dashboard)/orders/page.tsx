/**
 * @file app/(dashboard)/orders/page.tsx
 * @description Página de Pedidos — lista com filtros, atualização de status
 * e modal de detalhes completo.
 *
 * Funcionalidades:
 *  - Visualização em lista com paginação
 *  - Filtros por status, tipo, origem e busca textual
 *  - Atualização de status inline via dropdown (máquina de estados)
 *  - Modal lateral com detalhes completos do pedido
 *  - Impressão do pedido via API
 *  - Cancelamento com motivo obrigatório
 *  - Refetch automático a cada 30s + refresh manual
 *
 * @module app/(dashboard)/orders/page
 */

'use client';

import { useState, useCallback }        from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }       from 'framer-motion';
import {
  Search, Filter, RefreshCw, Printer, X, ChevronDown,
  Eye, Ban, Phone, MapPin, ShoppingBag, Clock,
  ChevronLeft, ChevronRight, ArrowUpDown, Package,
  Bike, UtensilsCrossed, Monitor,
} from 'lucide-react';
import { toast }                         from 'sonner';
import { useDebounce }                   from 'use-debounce';
import { apiGet, apiPatch, apiPost }     from '@/lib/api';
import { useAuth }                       from '@/hooks/use-auth';
import {
  formatCurrency, formatDate, formatRelative,
  formatOrderNumber, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, cn,
} from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface OrderItem {
  id            : string;
  product_name  : string;
  variation_name: string | null;
  unit_price    : number;
  quantity      : number;
  subtotal      : number;
  notes         : string | null;
  additionals   : Array<{
    group_name      : string;
    additional_name : string;
    unit_price      : number;
    quantity        : number;
    subtotal        : number;
  }>;
}

interface OrderPayment {
  method       : string;
  amount       : number;
  change_amount: number;
  reference    : string | null;
  paid_at      : string;
}

interface Order {
  id              : string;
  sequential_number: number;
  origin          : string;
  type            : string;
  status          : string;
  customer_name   : string | null;
  customer_phone  : string | null;
  table_identifier: string | null;
  table_name      : string | null;
  subtotal        : number;
  discount_amount : number;
  delivery_fee    : number;
  service_fee     : number;
  total           : number;
  payment_status  : string;
  estimated_time  : number | null;
  notes           : string | null;
  delivery_address: Record<string, string> | null;
  items           : OrderItem[] | null;
  payments        : OrderPayment[] | null;
  created_at      : string;
  confirmed_at    : string | null;
  delivered_at    : string | null;
  cancelled_at    : string | null;
  printed_count   : number;
}

interface OrdersResponse {
  orders    : Order[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: '',           label: 'Todos' },
  { value: 'pending',    label: 'Pendente' },
  { value: 'confirmed',  label: 'Confirmado' },
  { value: 'preparing',  label: 'Preparando' },
  { value: 'ready',      label: 'Pronto' },
  { value: 'dispatched', label: 'Em entrega' },
  { value: 'delivered',  label: 'Entregue' },
  { value: 'cancelled',  label: 'Cancelado' },
];

const TYPE_OPTIONS = [
  { value: '',         label: 'Todos os tipos' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'pickup',   label: 'Retirada' },
  { value: 'table',    label: 'Mesa' },
  { value: 'pdv',      label: 'PDV' },
];

// Transições permitidas de status
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending   : ['confirmed', 'rejected', 'cancelled'],
  confirmed : ['preparing', 'cancelled'],
  preparing : ['ready', 'cancelled'],
  ready     : ['dispatched', 'delivered'],
  dispatched: ['delivered'],
  delivered : [],
  cancelled : [],
  rejected  : [],
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash        : 'Dinheiro',
  credit_card : 'Crédito',
  debit_card  : 'Débito',
  pix         : 'PIX',
  voucher     : 'Vale',
  online      : 'Online',
  other       : 'Outro',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  delivery: Bike,
  pickup  : Package,
  table   : UtensilsCrossed,
  pdv     : Monitor,
};

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
      ORDER_STATUS_COLORS[status] ?? 'text-muted-foreground bg-muted border-border',
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Dropdown inline para trocar o status do pedido */
function StatusDropdown({
  orderId, currentStatus, onStatusChange,
}: {
  orderId      : string;
  currentStatus: string;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const transitions     = STATUS_TRANSITIONS[currentStatus] ?? [];

  if (transitions.length === 0) {
    return <StatusBadge status={currentStatus} />;
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
          'transition-all hover:brightness-110',
          ORDER_STATUS_COLORS[currentStatus] ?? 'text-muted-foreground bg-muted border-border',
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {ORDER_STATUS_LABELS[currentStatus] ?? currentStatus}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 z-20 mt-1.5 min-w-[160px] rounded-lg border border-border bg-card shadow-soft-md"
            >
              {transitions.map((status) => (
                <button
                  key={status}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(orderId, status);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className={cn(
                    'h-2 w-2 rounded-full',
                    ORDER_STATUS_COLORS[status]?.split(' ')[0].replace('text-', 'bg-') ?? 'bg-muted-foreground',
                  )} />
                  <span className="font-medium">{ORDER_STATUS_LABELS[status] ?? status}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de Detalhes do Pedido
// ---------------------------------------------------------------------------

function OrderDetailModal({
  order, onClose, onStatusChange, onPrint,
}: {
  order          : Order;
  onClose        : () => void;
  onStatusChange : (id: string, status: string) => void;
  onPrint        : (id: string) => void;
}) {
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel]     = useState(false);
  const { can }                         = useAuth();

  const canCancel = !['delivered', 'cancelled', 'rejected'].includes(order.status)
    && can('orders:cancel');

  const address = order.delivery_address;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Painel lateral */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-border bg-card shadow-soft-lg"
      >
        {/* Header do modal */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-mono text-base font-bold">
                {formatOrderNumber(order.sequential_number)}
              </h2>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(order.created_at, true)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {can('orders:print') && (
              <button
                onClick={() => onPrint(order.id)}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground transition-all"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
                {order.printed_count > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                    {order.printed_count}×
                  </span>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Informações do pedido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tipo</p>
              <div className="mt-1 flex items-center gap-1.5">
                {(() => {
                  const Icon = TYPE_ICONS[order.type] ?? ShoppingBag;
                  return <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />;
                })()}
                <p className="text-sm font-medium capitalize">
                  {order.type === 'delivery' ? 'Delivery' :
                   order.type === 'pickup'   ? 'Retirada' :
                   order.type === 'table'    ? `Mesa ${order.table_identifier ?? ''}` : 'PDV'}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Origem</p>
              <p className="mt-1 text-sm font-medium capitalize">{order.origin}</p>
            </div>

            {order.estimated_time && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tempo Estimado</p>
                <div className="mt-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm font-medium">{order.estimated_time} min</p>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pagamento</p>
              <p className={cn(
                'mt-1 text-sm font-medium',
                order.payment_status === 'paid' ? 'text-emerald-400' :
                order.payment_status === 'partial' ? 'text-amber-400' : 'text-muted-foreground',
              )}>
                {order.payment_status === 'paid'    ? 'Pago' :
                 order.payment_status === 'partial' ? 'Parcial' : 'Pendente'}
              </p>
            </div>
          </div>

          {/* Cliente */}
          {(order.customer_name || order.customer_phone) && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h3>
              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                {order.customer_name && (
                  <p className="text-sm font-medium">{order.customer_name}</p>
                )}
                {order.customer_phone && (
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {order.customer_phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Endereço de entrega */}
          {address && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</h3>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {[address.street, address.number, address.complement].filter(Boolean).join(', ')}
                    <br />
                    {[address.neighborhood, address.city, address.state].filter(Boolean).join(', ')}
                    {address.zip && ` — CEP ${address.zip}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Itens do pedido */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Itens ({order.items?.length ?? 0})
            </h3>
            <div className="space-y-2">
              {(order.items ?? []).map((item, i) => (
                <div key={item.id ?? i} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        <span className="mr-1.5 font-mono text-xs text-muted-foreground">{item.quantity}×</span>
                        {item.product_name}
                        {item.variation_name && (
                          <span className="ml-1 text-xs text-muted-foreground">({item.variation_name})</span>
                        )}
                      </p>
                      {item.notes && (
                        <p className="mt-1 text-xs italic text-muted-foreground">"{item.notes}"</p>
                      )}
                      {item.additionals?.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {item.additionals.map((add, j) => (
                            <li key={j} className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>+ {add.additional_name}</span>
                              {add.unit_price > 0 && (
                                <span className="tabular-nums">{formatCurrency(add.subtotal)}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          {order.notes && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</h3>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-300">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Totais */}
          <div className="rounded-lg border border-border/60 p-4 space-y-2">
            {[
              { label: 'Subtotal',    value: order.subtotal },
              order.delivery_fee > 0 && { label: 'Entrega',      value: order.delivery_fee },
              order.discount_amount > 0 && { label: 'Desconto',  value: -order.discount_amount },
              order.service_fee > 0 && { label: 'Taxa de serviço', value: order.service_fee },
            ].filter(Boolean).map((row: unknown) => {
              const r = row as { label: string; value: number };
              return (
                <div key={r.label} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{r.label}</span>
                  <span className={cn('tabular-nums', r.value < 0 && 'text-emerald-400')}>
                    {formatCurrency(Math.abs(r.value))}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-border/60 pt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-mono text-base font-bold tabular-nums">
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>

          {/* Pagamentos */}
          {(order.payments ?? []).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pagamentos</h3>
              {(order.payments ?? []).map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatCurrency(p.amount)}
                    {p.change_amount > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        (troco: {formatCurrency(p.change_amount)})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Cancelamento */}
          {showCancel && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">Motivo do cancelamento</h3>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Informe o motivo do cancelamento..."
                className="w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-destructive/40 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (cancelReason.trim().length < 5) {
                      toast.error('Informe um motivo com ao menos 5 caracteres.');
                      return;
                    }
                    onStatusChange(order.id, 'cancelled');
                    setShowCancel(false);
                  }}
                  className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                >
                  Confirmar cancelamento
                </button>
                <button
                  onClick={() => setShowCancel(false)}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer de ações */}
        <div className="shrink-0 border-t border-border/60 p-4 space-y-2">
          {/* Próximo status */}
          {(STATUS_TRANSITIONS[order.status] ?? []).length > 0 && (
            <div className="flex gap-2">
              {STATUS_TRANSITIONS[order.status]
                .filter((s) => s !== 'cancelled' && s !== 'rejected')
                .map((nextStatus) => (
                  <button
                    key={nextStatus}
                    onClick={() => onStatusChange(order.id, nextStatus)}
                    className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 active:scale-[0.98] transition-all shadow-glow-sm"
                  >
                    → {ORDER_STATUS_LABELS[nextStatus]}
                  </button>
                ))
              }
            </div>
          )}

          {/* Cancelar */}
          {canCancel && !showCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/20 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancelar pedido
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { can }     = useAuth();

  // ── State de filtros ──────────────────────────────────────────────────────
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [type,      setType]      = useState('');
  const [page,      setPage]      = useState(1);
  const [selected,  setSelected]  = useState<Order | null>(null);

  const [debouncedSearch] = useDebounce(search, 400);

  // ── Queries ───────────────────────────────────────────────────────────────

  const queryKey = ['orders', { search: debouncedSearch, status, type, page }];

  const { data, isLoading, isFetching, refetch } = useQuery<OrdersResponse>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page : String(page),
        limit: '15',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(status && { status }),
        ...(type   && { type }),
      });
      return apiGet(`/orders?${params}`);
    },
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });

  const orders     = data?.orders     ?? [];
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  // ── Mutation: atualizar status ────────────────────────────────────────────

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      apiPatch(`/orders/${id}/status`, { status: newStatus }),
    onSuccess: (_, { newStatus }) => {
      toast.success(`Status atualizado para "${ORDER_STATUS_LABELS[newStatus] ?? newStatus}".`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // Atualiza o pedido selecionado no modal
      if (selected?.id) {
        setSelected((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    },
    onError: (err: unknown) => {
      const e = err as { message?: string };
      toast.error(e?.message ?? 'Erro ao atualizar status.');
    },
  });

  const handleStatusChange = useCallback((id: string, newStatus: string) => {
    updateStatus({ id, newStatus });
  }, [updateStatus]);

  // ── Mutation: imprimir ────────────────────────────────────────────────────

  const { mutate: printOrder } = useMutation({
    mutationFn: (id: string) => apiPost(`/orders/${id}/print`),
    onSuccess: () => toast.success('Pedido enviado para impressão.'),
    onError  : () => toast.error('Erro ao imprimir pedido.'),
  });

  // ── Reset página ao filtrar ───────────────────────────────────────────────
  const handleFilterChange = (fn: () => void) => {
    fn();
    setPage(1);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col gap-4">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total} pedido{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground transition-all',
              isFetching && 'opacity-60 cursor-not-allowed',
            )}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2">
        {/* Busca */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
            placeholder="Buscar por cliente ou nº do pedido..."
            className="h-9 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring/50 transition-all"
          />
        </div>

        {/* Filtro de status */}
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={status}
            onChange={(e) => handleFilterChange(() => setStatus(e.target.value))}
            className="h-9 rounded-lg border border-border/60 bg-card pl-9 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 appearance-none cursor-pointer transition-all"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Filtro de tipo */}
        <div className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={type}
            onChange={(e) => handleFilterChange(() => setType(e.target.value))}
            className="h-9 rounded-lg border border-border/60 bg-card pl-9 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 appearance-none cursor-pointer transition-all"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Chips de filtros ativos ── */}
      {(status || type || debouncedSearch) && (
        <div className="flex flex-wrap gap-1.5">
          {debouncedSearch && (
            <span className="tag-chip gap-1">
              "{debouncedSearch}"
              <button onClick={() => { setSearch(''); setPage(1); }} className="ml-0.5 hover:text-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {status && (
            <span className="tag-chip gap-1">
              {ORDER_STATUS_LABELS[status]}
              <button onClick={() => { setStatus(''); setPage(1); }}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {type && (
            <span className="tag-chip gap-1">
              {TYPE_OPTIONS.find((t) => t.value === type)?.label}
              <button onClick={() => { setType(''); setPage(1); }}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          <button
            onClick={() => { setSearch(''); setStatus(''); setType(''); setPage(1); }}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* ── Tabela de pedidos ── */}
      <div className="flex-1 overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {['Nº', 'Cliente / Mesa', 'Tipo', 'Status', 'Total', 'Criado', 'Ações'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 w-full rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
                    <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
                    {(status || type || search) && (
                      <button
                        onClick={() => { setSearch(''); setStatus(''); setType(''); setPage(1); }}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const TypeIcon = TYPE_ICONS[order.type] ?? ShoppingBag;
                  return (
                    <motion.tr
                      key={order.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => setSelected(order)}
                    >
                      {/* Número */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                          {formatOrderNumber(order.sequential_number)}
                        </span>
                      </td>

                      {/* Cliente / Mesa */}
                      <td className="px-4 py-3">
                        <div className="max-w-[180px]">
                          <p className="truncate font-medium text-foreground">
                            {order.customer_name ??
                              (order.table_identifier
                                ? `Mesa ${order.table_identifier}`
                                : '—')}
                          </p>
                          {order.customer_phone && (
                            <p className="truncate text-xs text-muted-foreground">
                              {order.customer_phone}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                          <TypeIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span className="capitalize">
                            {order.type === 'delivery' ? 'Delivery' :
                             order.type === 'pickup'   ? 'Retirada' :
                             order.type === 'table'    ? 'Mesa' : 'PDV'}
                          </span>
                        </div>
                      </td>

                      {/* Status com dropdown */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <StatusDropdown
                          orderId={order.id}
                          currentStatus={order.status}
                          onStatusChange={handleStatusChange}
                        />
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold tabular-nums whitespace-nowrap">
                          {formatCurrency(order.total)}
                        </span>
                      </td>

                      {/* Criado */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelative(order.created_at)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelected(order)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {can('orders:print') && (
                            <button
                              onClick={() => printOrder(order.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              title="Imprimir"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Paginação ── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Página {pagination.page} de {pagination.totalPages}
            {' · '}
            {pagination.total} pedidos
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border/60 p-1.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Botões de página */}
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              const pageNum = Math.max(1, page - 2) + i;
              if (pageNum > pagination.totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'min-w-[32px] rounded-lg border px-2 py-1.5 text-xs transition-all',
                    pageNum === page
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border/60 hover:bg-muted text-muted-foreground',
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="rounded-lg border border-border/60 p-1.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de detalhes ── */}
      <AnimatePresence>
        {selected && (
          <OrderDetailModal
            order={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
            onPrint={(id) => printOrder(id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
