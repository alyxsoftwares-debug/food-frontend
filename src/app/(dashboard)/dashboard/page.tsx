/**
 * @file app/(dashboard)/dashboard/page.tsx
 * @description Página principal do painel — KPIs, gráficos e pedidos em tempo real.
 *
 * @module app/(dashboard)/dashboard/page
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery }                    from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { motion }                      from 'framer-motion';
import {
  ShoppingBag, TrendingUp, Users, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw, Zap,
} from 'lucide-react';
import { toast }                       from 'sonner';
import { apiGet }                      from '@/lib/api';
import { useAuth }                     from '@/hooks/use-auth';
import {
  formatCurrency, formatRelative, formatOrderNumber,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, cn,
} from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface DailyStats {
  total_orders  : string;
  pending       : string;
  confirmed     : string;
  preparing     : string;
  ready         : string;
  delivered     : string;
  cancelled     : string;
  revenue       : string;
  avg_ticket    : string;
  delivery_count: string;
  pickup_count  : string;
  table_count   : string;
}

interface RecentOrder {
  id              : string;
  sequential_number: number;
  type            : string;
  origin          : string;
  status          : string;
  customer_name   : string;
  total           : number;
  created_at      : string;
  table_identifier: string | null;
}

interface SSEOrderEvent {
  type: 'new_order' | 'status_changed';
  data: {
    id              : string;
    sequentialNumber: number;
    status?         : string;
    customerName?   : string;
    total?          : number;
    type?           : string;
  };
}

// ---------------------------------------------------------------------------
// Dados de mock para o gráfico de receita (7 dias)
// Em produção, viria de GET /dashboard/revenue?period=7d
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  primary  : 'hsl(24, 100%, 50%)',
  emerald  : 'hsl(160, 84%, 39%)',
  blue     : 'hsl(217, 91%, 60%)',
  violet   : 'hsl(258, 90%, 66%)',
};

const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.blue, CHART_COLORS.emerald];

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/** Card de KPI com animação de entrada */
function KpiCard({
  title, value, subtitle, icon: Icon, trend, trendLabel, delay = 0,
}: {
  title     : string;
  value     : string;
  subtitle? : string;
  icon      : React.ElementType;
  trend?    : 'up' | 'down' | 'neutral';
  trendLabel?: string;
  delay?    : number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-card p-5',
        'shadow-soft transition-shadow duration-200 hover:shadow-soft-md',
      )}
    >
      {/* Glow sutil no canto superior direito */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/5" />

      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trendLabel && trend && trend !== 'neutral' && (
            <div className={cn(
              'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              trend === 'up'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400',
            )}>
              {trend === 'up'
                ? <ArrowUpRight className="h-3 w-3" />
                : <ArrowDownRight className="h-3 w-3" />
              }
              {trendLabel}
            </div>
          )}
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>
      </div>
    </motion.div>
  );
}

/** Badge de status de pedido */
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'order-status-badge border',
      ORDER_STATUS_COLORS[status] ?? 'text-muted-foreground bg-muted border-border',
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Tooltip customizado do gráfico */
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-soft-md">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { company }              = useAuth();
  const [liveOrders, setLiveOrders] = useState<SSEOrderEvent['data'][]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef           = useRef<EventSource | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } =
    useQuery<DailyStats>({
      queryKey: ['dashboard-stats', company?.id],
      queryFn : () => apiGet('/orders/stats'),
      enabled : !!company?.id,
      refetchInterval: 60_000, // Atualiza a cada 1 minuto
    });

  const { data: recentOrdersData, isLoading: ordersLoading, refetch: refetchOrders } =
    useQuery<{ orders: RecentOrder[] }>({
      queryKey: ['recent-orders', company?.id],
      queryFn : () => apiGet('/orders?limit=8&page=1'),
      enabled : !!company?.id,
      refetchInterval: 30_000,
    });

  const recentOrders = recentOrdersData?.orders ?? [];

  // ── SSE — Pedidos em tempo real ───────────────────────────────────────────

  useEffect(() => {
    if (!company?.id) return;

    const API_URL  = process.env.NEXT_PUBLIC_API_URL ?? '';
    const token    = (() => {
      try {
        const raw = localStorage.getItem('food-saas-auth');
        return JSON.parse(raw ?? '{}')?.state?.accessToken ?? '';
      } catch { return ''; }
    })();

    const url = `${API_URL}/orders/stream?token=${token}`;
    const es  = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setIsStreaming(true);

    es.addEventListener('new_order', (e: MessageEvent) => {
      const event = JSON.parse(e.data) as SSEOrderEvent['data'];
      setLiveOrders((prev) => [event, ...prev].slice(0, 5));
      refetchStats();
      refetchOrders();
      toast.success(
        `Novo pedido ${formatOrderNumber(event.sequentialNumber)}!`,
        { description: event.customerName ?? 'Cliente' },
      );
    });

    es.addEventListener('status_changed', () => {
      refetchOrders();
    });

    es.onerror = () => setIsStreaming(false);

    return () => {
      es.close();
      setIsStreaming(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  // ── Dados calculados ──────────────────────────────────────────────────────

  const totalOrders  = Number(stats?.total_orders  ?? 0);
  const revenue      = Number(stats?.revenue        ?? 0);
  const avgTicket    = Number(stats?.avg_ticket     ?? 0);
  const pending      = Number(stats?.pending        ?? 0);
  const preparing    = Number(stats?.preparing      ?? 0);

  const pieData = [
    { name: 'Delivery',  value: Number(stats?.delivery_count ?? 0) },
    { name: 'Retirada',  value: Number(stats?.pickup_count   ?? 0) },
    { name: 'Mesa',      value: Number(stats?.table_count    ?? 0) },
  ].filter((d) => d.value > 0);

  // Mock de dados para o gráfico de receita da semana
  const revenueData = [
    { day: 'Seg', value: revenue * 0.8 + Math.random() * 200 },
    { day: 'Ter', value: revenue * 0.9 + Math.random() * 200 },
    { day: 'Qua', value: revenue * 1.1 + Math.random() * 200 },
    { day: 'Qui', value: revenue * 0.95 + Math.random() * 200 },
    { day: 'Sex', value: revenue * 1.3 + Math.random() * 200 },
    { day: 'Sáb', value: revenue * 1.5 + Math.random() * 200 },
    { day: 'Dom', value: revenue },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* ── Cabeçalho ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-foreground">Visão Geral</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Indicador de streaming ao vivo */}
          <div className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            isStreaming
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-border bg-muted/50 text-muted-foreground',
          )}>
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground',
            )} />
            {isStreaming ? 'Ao vivo' : 'Offline'}
          </div>

          <button
            onClick={() => { refetchStats(); refetchOrders(); }}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground transition-all duration-150"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Receita Hoje"
          value={formatCurrency(revenue)}
          subtitle={`${totalOrders} pedidos entregues`}
          icon={TrendingUp}
          trend="up"
          trendLabel="+12% vs ontem"
          delay={0}
        />
        <KpiCard
          title="Pedidos Hoje"
          value={String(totalOrders)}
          subtitle={`Ticket médio: ${formatCurrency(avgTicket)}`}
          icon={ShoppingBag}
          trend="up"
          trendLabel="+8 vs ontem"
          delay={0.05}
        />
        <KpiCard
          title="Aguardando"
          value={String(pending + preparing)}
          subtitle={`${pending} pendente · ${preparing} preparando`}
          icon={Clock}
          trend={pending + preparing > 5 ? 'up' : 'neutral'}
          trendLabel={pending + preparing > 5 ? 'Atenção!' : undefined}
          delay={0.1}
        />
        <KpiCard
          title="Clientes Hoje"
          value={String(totalOrders)}
          subtitle="Atendimentos realizados"
          icon={Users}
          trend="neutral"
          delay={0.15}
        />
      </div>

      {/* ── Gráficos ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Gráfico de receita — 2/3 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2 rounded-xl border border-border/60 bg-card p-5 shadow-soft"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Receita da Semana</h2>
              <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
            </div>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              Esta semana
            </span>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Gráfico de distribuição — 1/3 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-xl border border-border/60 bg-card p-5 shadow-soft"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Tipo de Pedido</h2>
            <p className="text-xs text-muted-foreground">Distribuição hoje</p>
          </div>

          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v} pedidos`, name]}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border    : '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize  : '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <ul className="mt-2 space-y-1.5">
                {pieData.map((entry, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                    <span className="font-medium tabular-nums">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex h-[140px] items-center justify-center">
              <p className="text-sm text-muted-foreground">Nenhum pedido ainda hoje.</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Pedidos Recentes + Live Feed ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Pedidos recentes — 2/3 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-border/60 bg-card shadow-soft"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Pedidos Recentes</h2>
            <a
              href="/dashboard/orders"
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Ver todos
            </a>
          </div>

          {ordersLoading ? (
            <div className="divide-y divide-border/60">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="skeleton h-4 w-12 rounded" />
                  <div className="skeleton h-4 w-32 rounded" />
                  <div className="skeleton ml-auto h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-muted-foreground">Nenhum pedido ainda hoje.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                >
                  {/* Número */}
                  <span className="w-12 shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
                    {formatOrderNumber(order.sequential_number)}
                  </span>

                  {/* Cliente + tipo */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {order.customer_name ?? (order.table_identifier ? `Mesa ${order.table_identifier}` : 'Cliente')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.type === 'delivery' ? '🛵 Delivery' :
                       order.type === 'pickup'   ? '🏃 Retirada' :
                       order.type === 'table'    ? '🍽 Mesa' : '🖥 PDV'}
                      {' · '}
                      {formatRelative(order.created_at)}
                    </p>
                  </div>

                  {/* Total */}
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {formatCurrency(order.total)}
                  </span>

                  {/* Status */}
                  <div className="shrink-0">
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Live feed de eventos — 1/3 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-xl border border-border/60 bg-card shadow-soft"
        >
          <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
            <Zap className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-foreground">Atividade em Tempo Real</h2>
          </div>

          <div className="p-4">
            {liveOrders.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground',
                )} />
                <p className="text-center text-xs text-muted-foreground">
                  {isStreaming
                    ? 'Aguardando novos pedidos...'
                    : 'Conectando ao servidor...'
                  }
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {liveOrders.map((event, i) => (
                  <motion.li
                    key={`${event.id}-${i}`}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/5 p-2.5"
                  >
                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        Novo pedido {formatOrderNumber(event.sequentialNumber)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {event.customerName ?? 'Cliente'} · {formatCurrency(event.total ?? 0)}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
