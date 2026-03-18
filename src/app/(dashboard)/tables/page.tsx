/**
 * @file app/(dashboard)/tables/page.tsx
 * @description Página de Mesas — painel visual com grid por localização,
 * abertura/fechamento de comandas e QR Code inline.
 *
 * @module app/(dashboard)/tables/page
 */

'use client';

import { useState }                          from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  Plus, QrCode, RefreshCw, Users, Clock,
  X, Check, Coffee, Wrench, BookMarked,
  ChevronDown, Download, Printer,
} from 'lucide-react';
import { toast }                             from 'sonner';
import { QRCodeSVG }                         from 'qrcode.react';
import { apiGet, apiPost, apiPatch }         from '@/lib/api';
import { useAuth }                           from '@/hooks/use-auth';
import { formatCurrency, formatRelative, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type TableStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

interface TableItem {
  id                : string;
  identifier        : string;
  name              : string | null;
  capacity          : number;
  status            : TableStatus;
  location          : string | null;
  qr_code_token     : string;
  is_active         : boolean;
  order_id          : string | null;
  order_number      : number | null;
  order_status      : string | null;
  order_total       : number | null;
  order_customer    : string | null;
  order_opened_at   : string | null;
  occupied_minutes  : number | null;
  item_count        : number | null;
}

interface DashboardData {
  tables : TableItem[];
  grouped: Record<string, TableItem[]>;
  summary: {
    total      : number;
    available  : number;
    occupied   : number;
    reserved   : number;
    maintenance: number;
  };
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<TableStatus, {
  label : string;
  color : string;
  bg    : string;
  border: string;
  icon  : React.ElementType;
  dot   : string;
}> = {
  available  : { label: 'Disponível',  color: 'text-emerald-400', bg: 'bg-emerald-400/5',  border: 'border-emerald-400/20', icon: Check,      dot: 'bg-emerald-400' },
  occupied   : { label: 'Ocupada',     color: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/30',  icon: Coffee,     dot: 'bg-orange-400'  },
  reserved   : { label: 'Reservada',   color: 'text-blue-400',    bg: 'bg-blue-400/5',     border: 'border-blue-400/20',    icon: BookMarked, dot: 'bg-blue-400'    },
  maintenance: { label: 'Manutenção',  color: 'text-slate-400',   bg: 'bg-slate-400/5',    border: 'border-slate-400/20',   icon: Wrench,     dot: 'bg-slate-400'   },
};

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/** Card visual de uma mesa */
function TableCard({
  table, onClick,
}: { table: TableItem; onClick: () => void }) {
  const cfg      = STATUS_CONFIG[table.status];
  const StatusIcon = cfg.icon;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-start rounded-xl border p-4 text-left w-full',
        'transition-shadow duration-200 hover:shadow-soft-md',
        cfg.bg, cfg.border,
      )}
    >
      {/* Header */}
      <div className="flex w-full items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-foreground leading-none">
            {table.name ?? table.identifier}
          </p>
          {table.name && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{table.identifier}</p>
          )}
        </div>
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          cfg.bg, cfg.border, 'border',
        )}>
          <StatusIcon className={cn('h-3.5 w-3.5', cfg.color)} strokeWidth={1.5} />
        </div>
      </div>

      {/* Capacidade */}
      <div className="mt-3 flex items-center gap-1.5">
        <Users className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{table.capacity} lugares</span>
      </div>

      {/* Info do pedido ativo */}
      {table.status === 'occupied' && (
        <div className="mt-3 w-full space-y-1.5 border-t border-border/40 pt-3">
          {table.order_customer && (
            <p className="truncate text-xs font-medium text-foreground">
              {table.order_customer}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {table.occupied_minutes != null
                ? `${table.occupied_minutes}min`
                : table.order_opened_at
                  ? formatRelative(table.order_opened_at)
                  : '—'}
            </div>
            {table.order_total != null && (
              <span className="font-mono text-xs font-semibold text-foreground">
                {formatCurrency(table.order_total)}
              </span>
            )}
          </div>
          {table.item_count != null && (
            <p className="text-[10px] text-muted-foreground">
              {table.item_count} {table.item_count === 1 ? 'item' : 'itens'}
            </p>
          )}
        </div>
      )}

      {/* Dot de status */}
      <span className={cn(
        'absolute right-3 top-3 h-2 w-2 rounded-full',
        cfg.dot,
        table.status === 'occupied' && 'animate-pulse',
      )} />
    </motion.button>
  );
}

/** Modal de ações da mesa */
function TableModal({
  table, onClose, onAction,
}: {
  table   : TableItem;
  onClose : () => void;
  onAction: (action: string, data?: Record<string, unknown>) => void;
}) {
  const cfg          = STATUS_CONFIG[table.status];
  const [tab, setTab] = useState<'actions' | 'qrcode'>('actions');
  const menuUrl      = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/mesa/${table.qr_code_token}`;

  const [customerName, setCustomerName] = useState('');
  const [covers,       setCovers]       = useState(table.capacity);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-soft-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border',
              cfg.bg, cfg.border,
            )}>
              <cfg.icon className={cn('h-4 w-4', cfg.color)} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {table.name ?? table.identifier}
              </h2>
              <p className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/60">
          {(['actions', 'qrcode'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium transition-colors',
                tab === t
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'actions' ? 'Ações' : 'QR Code'}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="p-5">
          {tab === 'actions' ? (
            <div className="space-y-3">
              {/* Abrir comanda */}
              {table.status === 'available' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Nome do cliente (opcional)
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: João, Mesa do fundo..."
                      className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Número de pessoas
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCovers((c) => Math.max(1, c - 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 hover:bg-muted transition-colors text-lg font-bold"
                      >−</button>
                      <span className="flex-1 text-center font-mono text-base font-bold">{covers}</span>
                      <button
                        onClick={() => setCovers((c) => Math.min(table.capacity, c + 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 hover:bg-muted transition-colors text-lg font-bold"
                      >+</button>
                    </div>
                  </div>
                  <button
                    onClick={() => onAction('open', { customerName: customerName || undefined, covers })}
                    className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 active:scale-[0.98] transition-all shadow-glow-sm"
                  >
                    Abrir Comanda
                  </button>
                </div>
              )}

              {/* Fechar comanda */}
              {table.status === 'occupied' && (
                <>
                  {table.order_total != null && (
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Total da comanda</span>
                        <span className="font-mono text-base font-bold text-foreground">
                          {formatCurrency(table.order_total)}
                        </span>
                      </div>
                      {table.item_count != null && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {table.item_count} {table.item_count === 1 ? 'item' : 'itens'}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => onAction('close')}
                    className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 active:scale-[0.98] transition-all"
                  >
                    Fechar Comanda
                  </button>
                </>
              )}

              {/* Status para reservada */}
              {table.status === 'reserved' && (
                <button
                  onClick={() => onAction('status', { status: 'available' })}
                  className="w-full rounded-lg bg-muted py-2.5 text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  Marcar como Disponível
                </button>
              )}

              {/* Ações de status secundárias */}
              <div className="space-y-1.5">
                {table.status === 'available' && (
                  <button
                    onClick={() => onAction('status', { status: 'reserved' })}
                    className="flex w-full items-center gap-2 rounded-lg border border-blue-400/20 bg-blue-400/5 py-2 px-3 text-xs font-medium text-blue-400 hover:bg-blue-400/10 transition-colors"
                  >
                    <BookMarked className="h-3.5 w-3.5" />
                    Marcar como Reservada
                  </button>
                )}
                {table.status !== 'maintenance' && table.status !== 'occupied' && (
                  <button
                    onClick={() => onAction('status', { status: 'maintenance' })}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-500/20 bg-slate-500/5 py-2 px-3 text-xs font-medium text-slate-400 hover:bg-slate-500/10 transition-colors"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Em Manutenção
                  </button>
                )}
                {table.status === 'maintenance' && (
                  <button
                    onClick={() => onAction('status', { status: 'available' })}
                    className="flex w-full items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 py-2 px-3 text-xs font-medium text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Manutenção Concluída
                  </button>
                )}
              </div>

              {/* Regenerar QR */}
              <button
                onClick={() => onAction('regenerate-qr')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/60 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerar QR Code
              </button>
            </div>
          ) : (
            /* QR Code tab */
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border border-border bg-white p-4">
                <QRCodeSVG
                  value={menuUrl}
                  size={200}
                  level="H"
                  includeMargin={false}
                  fgColor="#1A202C"
                />
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {table.name ?? table.identifier}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground break-all">
                  {menuUrl}
                </p>
              </div>

              <div className="flex w-full gap-2">
                <a
                  href={`/api/v1/tables/${table.id}/qrcode`}
                  download={`qrcode-${table.identifier}.png`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar PNG
                </a>
                <button
                  onClick={() => window.print()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function TablesPage() {
  const queryClient              = useQueryClient();
  const { hasRole }              = useAuth();
  const [selected, setSelected]  = useState<TableItem | null>(null);
  const [filter,   setFilter]    = useState<TableStatus | ''>('');

  const canManage = hasRole('owner', 'admin', 'manager', 'waiter', 'cashier');

  // ── Query ─────────────────────────────────────────────────────────────────

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey      : ['tables-dashboard'],
    queryFn       : () => apiGet('/tables/dashboard'),
    refetchInterval: 15_000,
  });

  const summary = data?.summary ?? { total: 0, available: 0, occupied: 0, reserved: 0, maintenance: 0 };

  // Agrupa e filtra
  const grouped = Object.entries(data?.grouped ?? {}).reduce<Record<string, TableItem[]>>(
    (acc, [loc, tables]) => {
      const filtered = filter ? tables.filter((t) => t.status === filter) : tables;
      if (filtered.length > 0) acc[loc] = filtered;
      return acc;
    },
    {},
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tables-dashboard'] });
    setSelected(null);
  };

  const { mutate: openTab } = useMutation({
    mutationFn: ({ id, ...data }: { id: string; customerName?: string; covers?: number }) =>
      apiPost(`/tables/${id}/open`, data),
    onSuccess: () => { toast.success('Comanda aberta!'); invalidate(); },
    onError  : (e: unknown) => toast.error((e as { message?: string }).message ?? 'Erro ao abrir comanda.'),
  });

  const { mutate: closeTab } = useMutation({
    mutationFn: (id: string) => apiPost(`/tables/${id}/close`),
    onSuccess: () => { toast.success('Comanda fechada!'); invalidate(); },
    onError  : (e: unknown) => toast.error((e as { message?: string }).message ?? 'Erro ao fechar comanda.'),
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPatch(`/tables/${id}/status`, { status }),
    onSuccess: () => { toast.success('Status atualizado!'); invalidate(); },
    onError  : (e: unknown) => toast.error((e as { message?: string }).message ?? 'Erro ao atualizar status.'),
  });

  const { mutate: regenerateQr } = useMutation({
    mutationFn: (id: string) => apiPost(`/tables/${id}/qrcode/regenerate`),
    onSuccess: () => { toast.success('QR Code regenerado!'); invalidate(); },
    onError  : () => toast.error('Erro ao regenerar QR Code.'),
  });

  const handleAction = (action: string, actionData?: Record<string, unknown>) => {
    if (!selected) return;
    if (action === 'open')         return openTab({ id: selected.id, ...actionData as { customerName?: string; covers?: number } });
    if (action === 'close')        return closeTab(selected.id);
    if (action === 'status')       return updateStatus({ id: selected.id, status: actionData?.status as string });
    if (action === 'regenerate-qr') return regenerateQr(selected.id);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Mesas</h1>
          <p className="text-sm text-muted-foreground">
            {summary.total} mesas · {summary.occupied} ocupadas agora
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground transition-all disabled:opacity-60"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Atualizar
          </button>
          {hasRole('owner', 'admin', 'manager') && (
            <a
              href="/tables/new"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Mesa
            </a>
          )}
        </div>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.entries(STATUS_CONFIG) as [TableStatus, typeof STATUS_CONFIG[TableStatus]][]).map(([status, cfg]) => (
          <motion.button
            key={status}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setFilter(filter === status ? '' : status)}
            className={cn(
              'rounded-xl border p-4 text-left transition-all duration-200',
              filter === status
                ? cn(cfg.bg, cfg.border, 'shadow-soft')
                : 'border-border/60 bg-card hover:border-border',
            )}
          >
            <div className="flex items-center justify-between">
              <cfg.icon className={cn('h-4 w-4', cfg.color)} strokeWidth={1.5} />
              {filter === status && (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <p className="mt-3 font-mono text-2xl font-bold text-foreground">
              {summary[status]}
            </p>
            <p className={cn('mt-0.5 text-xs font-medium', cfg.color)}>{cfg.label}</p>
          </motion.button>
        ))}
      </div>

      {/* ── Grid de mesas por localização ── */}
      {isLoading ? (
        <div className="grid grid-cols-tables-sm gap-3 sm:grid-cols-tables-md">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-20">
          <QrCode className="h-12 w-12 text-muted-foreground/30" strokeWidth={1} />
          <p className="mt-3 text-sm text-muted-foreground">
            {filter ? 'Nenhuma mesa com este status.' : 'Nenhuma mesa cadastrada.'}
          </p>
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Mostrar todas
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([location, tables]) => (
            <div key={location}>
              <div className="divider-label mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {location}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {tables.length} mesa{tables.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-tables-sm gap-3 sm:grid-cols-tables-md lg:grid-cols-tables-lg">
                {tables.map((table) => (
                  <TableCard
                    key={table.id}
                    table={table}
                    onClick={() => canManage ? setSelected(table) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      <AnimatePresence>
        {selected && canManage && (
          <TableModal
            table={selected}
            onClose={() => setSelected(null)}
            onAction={handleAction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
