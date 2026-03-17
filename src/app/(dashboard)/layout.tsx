/**
 * @file app/(dashboard)/layout.tsx
 * @description Layout principal do painel administrativo.
 *
 * Estrutura:
 *  - Sidebar colapsável com navegação por domínio
 *  - Header fixo com breadcrumb, notificações e perfil do usuário
 *  - Área de conteúdo com scroll independente
 *
 * @module app/(dashboard)/layout
 */

'use client';

import { useState, useEffect }   from 'react';
import Link                      from 'next/link';
import { usePathname }           from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Grid2X2,
  Users, Truck, Settings, ChefHat, Menu, X, Bell,
  ChevronRight, LogOut, User, Moon, Sun, Printer,
  BarChart3, Building2,
} from 'lucide-react';
import { useTheme }              from 'next-themes';
import { useAuth }               from '@/hooks/use-auth';
import { cn }                    from '@/lib/utils';

// ---------------------------------------------------------------------------
// Estrutura de navegação
// ---------------------------------------------------------------------------

interface NavItem {
  label     : string;
  href      : string;
  icon      : React.ElementType;
  badge?    : number | string;
  roles?    : string[];           // undefined = todos os roles
  children? : Omit<NavItem, 'children'>[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href : '/dashboard',
    icon : LayoutDashboard,
  },
  {
    label: 'Pedidos',
    href : '/dashboard/orders',
    icon : ShoppingBag,
  },
  {
    label: 'Cardápio',
    href : '/dashboard/menu',
    icon : UtensilsCrossed,
    roles: ['owner', 'admin', 'manager'],
    children: [
      { label: 'Produtos',   href: '/dashboard/menu/products',   icon: UtensilsCrossed },
      { label: 'Categorias', href: '/dashboard/menu/categories', icon: Grid2X2 },
      { label: 'Adicionais', href: '/dashboard/menu/additionals',icon: ChefHat },
    ],
  },
  {
    label: 'Mesas',
    href : '/dashboard/tables',
    icon : Grid2X2,
  },
  {
    label: 'Clientes',
    href : '/dashboard/customers',
    icon : Users,
    roles: ['owner', 'admin', 'manager', 'cashier'],
  },
  {
    label: 'Entregas',
    href : '/dashboard/delivery',
    icon : Truck,
    roles: ['owner', 'admin', 'manager'],
  },
  {
    label: 'Relatórios',
    href : '/dashboard/reports',
    icon : BarChart3,
    roles: ['owner', 'admin', 'manager'],
  },
  {
    label: 'Impressoras',
    href : '/dashboard/printers',
    icon : Printer,
    roles: ['owner', 'admin', 'manager'],
  },
  {
    label: 'Usuários',
    href : '/dashboard/users',
    icon : Building2,
    roles: ['owner', 'admin'],
  },
  {
    label: 'Configurações',
    href : '/dashboard/settings',
    icon : Settings,
    roles: ['owner', 'admin'],
  },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface SidebarProps {
  collapsed : boolean;
  onCollapse: (v: boolean) => void;
}

function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const pathname               = usePathname();
  const { user, company, logout, hasRole } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname.startsWith(href);

  const filteredNav = NAV_ITEMS.filter(
    (item) => !item.roles || hasRole(...(item.roles as Parameters<typeof hasRole>)),
  );

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 256 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex h-full flex-col overflow-hidden border-r bg-[hsl(var(--sidebar-bg))] border-[hsl(var(--sidebar-border))]"
    >
      {/* ── Logo ── */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-glow-sm">
          <ChefHat className="h-4 w-4 text-white" strokeWidth={1.5} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="min-w-0 flex-1 overflow-hidden"
            >
              <p className="truncate text-sm font-bold text-white">
                {company?.name ?? 'Food SaaS'}
              </p>
              <p className="truncate text-[10px] text-[hsl(var(--sidebar-muted))] uppercase tracking-wider">
                {company?.plan ?? 'starter'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navegação ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-hide">
        <ul className="space-y-0.5 px-2">
          {filteredNav.map((item) => {
            const active   = isActive(item.href);
            const hasChild = !!item.children?.length;
            const open     = expanded === item.href;

            return (
              <li key={item.href}>
                {/* Item principal */}
                <button
                  onClick={() => {
                    if (hasChild && !collapsed) {
                      setExpanded(open ? null : item.href);
                    }
                  }}
                  className={cn(
                    'sidebar-link w-full',
                    active && 'active',
                    collapsed && 'justify-center px-2',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {hasChild && !collapsed
                    ? (
                      <Link href={item.href} className="flex items-center gap-3 flex-1" onClick={(e) => e.stopPropagation()}>
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                      </Link>
                    )
                    : (
                      <Link href={item.href} className={cn('flex items-center gap-3 flex-1', collapsed && 'justify-center')}>
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                      </Link>
                    )
                  }

                  {/* Badge */}
                  {item.badge && !collapsed && (
                    <span className="ml-auto rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {item.badge}
                    </span>
                  )}

                  {/* Chevron para itens com filhos */}
                  {hasChild && !collapsed && (
                    <ChevronRight
                      className={cn(
                        'ml-auto h-3.5 w-3.5 shrink-0 text-[hsl(var(--sidebar-muted))] transition-transform duration-200',
                        open && 'rotate-90',
                      )}
                    />
                  )}
                </button>

                {/* Sub-itens */}
                <AnimatePresence>
                  {hasChild && !collapsed && open && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-9 pr-1 pt-0.5 space-y-0.5"
                    >
                      {item.children!.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-all duration-150',
                              pathname.startsWith(child.href)
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-text))] hover:bg-[hsl(var(--sidebar-hover))]',
                            )}
                          >
                            <child.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Perfil do usuário ── */}
      <div className="shrink-0 border-t border-[hsl(var(--sidebar-border))] p-2">
        <div className={cn(
          'flex items-center gap-2.5 rounded-lg p-2',
          'hover:bg-[hsl(var(--sidebar-hover))] transition-colors duration-150 cursor-pointer group',
          collapsed && 'justify-center',
        )}>
          {/* Avatar */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
            <span className="text-xs font-semibold text-primary">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium text-[hsl(var(--sidebar-text))]">
                {user?.name ?? 'Usuário'}
              </p>
              <p className="truncate text-[10px] text-[hsl(var(--sidebar-muted))]">
                {user?.role ?? '—'}
              </p>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={logout}
              title="Sair"
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/20 text-[hsl(var(--sidebar-muted))] hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Botão de colapso ── */}
      <button
        onClick={() => onCollapse(!collapsed)}
        className={cn(
          'absolute -right-3 top-20 z-10',
          'flex h-6 w-6 items-center justify-center rounded-full',
          'border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-bg))]',
          'text-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-text))]',
          'transition-all duration-150 hover:scale-110',
          'shadow-soft-sm',
        )}
        aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
      >
        <ChevronRight
          className={cn('h-3 w-3 transition-transform duration-200', !collapsed && 'rotate-180')}
        />
      </button>
    </motion.aside>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, company }   = useAuth();
  const pathname            = usePathname();

  // Gera breadcrumb a partir do pathname
  const segments = pathname
    .replace('/dashboard', '')
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1));

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/60 bg-background/80 px-6 backdrop-blur-sm">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Dashboard</span>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className={i === segments.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {seg}
            </span>
          </span>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Ações do header */}
      <div className="flex items-center gap-2">
        {/* Cardápio público */}
        {company?.slug && (
          <a
            href={`${process.env.NEXT_PUBLIC_MENU_BASE_URL}/${company.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground transition-all duration-150 sm:flex"
          >
            Ver cardápio
            <ChevronRight className="h-3 w-3" />
          </a>
        )}

        {/* Notificações */}
        <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Bell className="h-4.5 w-4.5" />
          {/* Badge de notificação */}
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse-ring" />
        </button>

        {/* Toggle de tema */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Alternar tema"
        >
          {theme === 'dark'
            ? <Sun  className="h-4.5 w-4.5" />
            : <Moon className="h-4.5 w-4.5" />
          }
        </button>

        {/* Avatar do usuário */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
          <span className="text-xs font-semibold text-primary">
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </span>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Persiste preferência de sidebar
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) setSidebarCollapsed(stored === 'true');
  }, []);

  const handleCollapse = (v: boolean) => {
    setSidebarCollapsed(v);
    localStorage.setItem('sidebar-collapsed', String(v));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar Desktop ── */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar collapsed={sidebarCollapsed} onCollapse={handleCollapse} />
      </div>

      {/* ── Sidebar Mobile (drawer) ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-64 md:hidden"
            >
              <Sidebar collapsed={false} onCollapse={() => setMobileSidebarOpen(false)} />
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute right-3 top-4 rounded-lg p-1.5 text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))]"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Área principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
