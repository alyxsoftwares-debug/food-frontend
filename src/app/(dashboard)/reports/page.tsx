/**
 * @file app/(dashboard)/reports/page.tsx
 * @description Relatórios — receita, top produtos e resumo por período.
 *
 * @module app/(dashboard)/reports/page
 */

'use client';

import { useState }   from 'react';
import { useQuery }   from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion }     from 'framer-motion';
import {
  TrendingUp, ShoppingBag, Users, DollarSign,
  BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { apiGet }     from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface RevenueDayRow {
  day      : string;
  orders   : string;
  revenue  : string;
  avg_ticket: string;
}

interface TopProduct {
  product_name : string;
  total_qty    : string;
  total_revenue: string;
  order_count  : string;
}

interface Summary {
  orders_today  : string;
  revenue_today : string;
  orders_month  : string;
  revenue_month : string;
  open_orders   : string;
  pending_orders: string;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ title, value, sub, icon: Icon, trend }: {
  title : string;
  value : string;
  sub?  : string;
  icon  : React.ElementType;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/60 bg-card p-5 shadow-soft"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      {trend && (
        <div className={cn(
          'mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
        )}>
          {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          vs. período anterior
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-soft-md text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold">
          {p.dataKey === 'revenue' ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

const PERIODS = [
  { value: '7d',  label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  const { data: summary } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn : () => apiGet('/dashboard/summary'),
    refetchInterval: 60_000,
  });

  const { data: revenueData = [], isLoading: loadingRevenue } = useQuery<RevenueDayRow[]>({
    queryKey: ['revenue-chart', period],
    queryFn : () => apiGet(`/dashboard/revenue?period=${period}`),
  });

  const { data: topProducts = [], isLoading: loadingProducts } = useQuery<TopProduct[]>({
    queryKey: ['top-products'],
    queryFn : () => apiGet('/dashboard/top-products?limit=8'),
  });

  const chartData = revenueData.map((row) => ({
    day      : formatDate(row.day),
    revenue  : Number(row.revenue),
    orders   : Number(row.orders),
    avgTicket: Number(row.avg_ticket),
  }));

  const totalRevenue = revenueData.reduce((s, r) => s + Number(r.revenue), 0);
  const totalOrders  = revenueData.reduce((s, r) => s + Number(r.orders), 0);
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const maxProduct   = topProducts[0] ? Number(topProducts[0].total_qty) : 1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise de desempenho do seu negócio</p>
        </div>
        {/* Seletor de período */}
        <div className="flex rounded-xl border border-border/60 bg-card p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value as typeof period)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                period === p.value
                  ? 'bg-primary text-white shadow-glow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs de hoje */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hoje</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Receita Hoje"   value={formatCurrency(Number(summary?.revenue_today ?? 0))}
            sub={`${summary?.orders_today ?? 0} pedidos entregues`} icon={DollarSign} trend="up" />
          <KpiCard title="Pedidos Hoje"   value={String(summary?.orders_today ?? 0)}
            icon={ShoppingBag} />
          <KpiCard title="Em Aberto"      value={String(summary?.open_orders ?? 0)}
            sub={`${summary?.pending_orders ?? 0} aguardando confirmação`} icon={BarChart3} />
          <KpiCard title="Receita do Mês" value={formatCurrency(Number(summary?.revenue_month ?? 0))}
            sub={`${summary?.orders_month ?? 0} pedidos no mês`} icon={TrendingUp} trend="up" />
        </div>
      </div>

      {/* KPIs do período */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Últimos {period === '7d' ? '7 dias' : period === '30d' ? '30 dias' : '90 dias'}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard title="Receita Total"  value={formatCurrency(totalRevenue)}     icon={DollarSign} />
          <KpiCard title="Total de Pedidos" value={String(totalOrders)}            icon={ShoppingBag} />
          <KpiCard title="Ticket Médio"   value={formatCurrency(avgTicket)}        icon={Users} />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-5 xl:grid-cols-3">

        {/* Receita por dia — 2/3 */}
        <div className="xl:col-span-2 rounded-xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Receita por Dia</h2>
            <span className="text-xs text-muted-foreground">{formatCurrency(totalRevenue)} no período</span>
          </div>
          {loadingRevenue ? (
            <div className="skeleton h-52 rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="flex h-52 items-center justify-center">
              <p className="text-sm text-muted-foreground">Sem dados para este período.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(24,100%,50%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(24,100%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(24,100%,50%)" strokeWidth={2}
                  fill="url(#rg)" dot={false} activeDot={{ r: 4, fill: 'hsl(24,100%,50%)', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pedidos por dia — 1/3 */}
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="mb-5">
            <h2 className="text-sm font-semibold">Pedidos por Dia</h2>
            <p className="text-xs text-muted-foreground">{totalOrders} pedidos no período</p>
          </div>
          {loadingRevenue ? (
            <div className="skeleton h-52 rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', radius: 4 }} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Produtos */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Produtos Mais Vendidos</h2>
          <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
        </div>

        {loadingProducts ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}</div>
        ) : topProducts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum dado de vendas ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => {
              const pct = Math.round((Number(p.total_qty) / maxProduct) * 100);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{p.product_name}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                      <span className="tabular-nums">{p.total_qty}×</span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">
                        {formatCurrency(Number(p.total_revenue))}
                      </span>
                    </div>
                  </div>
                  {/* Barra de progresso relativa */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
