/**
 * @file app/mesa/[token]/page.tsx
 * @description Página de pedido via QR Code de mesa.
 *
 * Acessada quando o cliente escaneia o QR Code da mesa.
 * Não exige autenticação — usa o token único da mesa.
 *
 * Fluxo:
 *  1. Valida o token e carrega o cardápio da empresa
 *  2. Mostra identidade da mesa (ex: "Mesa 05 — Salão Principal")
 *  3. Exibe o mesmo cardápio do /menu/[slug] adaptado para mesa
 *  4. POST /orders/table com x-table-token no header
 *  5. Tela de confirmação com número do pedido
 *
 * @module app/mesa/[token]/page
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image                                          from 'next/image';
import { useParams }                                  from 'next/navigation';
import { motion, AnimatePresence }                    from 'framer-motion';
import {
  ChefHat, UtensilsCrossed, Plus, Minus, X,
  ShoppingBag, Check, Clock, Search, Star, ArrowRight,
} from 'lucide-react';
import { toast }              from 'sonner';
import { useDebounce }        from 'use-debounce';
import { api }                from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface TableInfo {
  id        : string;
  identifier: string;
  name      : string | null;
  location  : string | null;
  status    : string;
}

interface CompanyInfo {
  id          : string;
  name        : string;
  logo_url    : string | null;
  primary_color: string;
}

interface Additional   { id: string; name: string; price: number; }
interface AdditionalGroup {
  id: string; name: string;
  min_select: number; max_select: number;
  is_required: boolean; items: Additional[];
}
interface Variation   { id: string; name: string; price: number; }
interface Product {
  id: string; name: string; description: string | null;
  image_url: string | null; base_price: number;
  promotional_price: number | null; prep_time: number | null;
  is_featured: boolean; tags: string[];
  variations: Variation[] | null;
  additional_groups: AdditionalGroup[] | null;
}
interface MenuCategory {
  category_id: string; category_name: string;
  products: Product[] | null;
}

interface TableResponse {
  table  : TableInfo;
  company: CompanyInfo;
  menu   : MenuCategory[];
  settings: { estimated_delivery_time?: number };
}

// ---------------------------------------------------------------------------
// Hook: carrega dados via token da mesa
// ---------------------------------------------------------------------------

function useTableMenu(token: string) {
  const [data,    setData]    = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // Busca o cardápio passando o token no header
    api.get('/menu/table', {
      headers: { 'x-table-token': token },
    })
      .then((r) => setData(r.data.data))
      .catch((e) => {
        const msg = e?.response?.data?.error?.message ?? 'Mesa não encontrada ou QR Code inválido.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Tipos do carrinho
// ---------------------------------------------------------------------------

interface CartAdditional { groupId: string; groupName: string; id: string; name: string; price: number; }
interface CartItem {
  id: string; product: Product;
  variationId?: string; variationName?: string;
  unitPrice: number; quantity: number;
  additionals: CartAdditional[]; notes: string;
}

// ---------------------------------------------------------------------------
// Modal de customização do produto (idêntico ao /menu/[slug])
// ---------------------------------------------------------------------------

function ProductModal({
  product, onClose, onAdd,
}: {
  product: Product;
  onClose: () => void;
  onAdd  : (item: Omit<CartItem, 'id'>) => void;
}) {
  const [variation,    setVariation]    = useState<Variation | null>(product.variations?.[0] ?? null);
  const [additionals,  setAdditionals]  = useState<Record<string, CartAdditional[]>>({});
  const [qty,          setQty]          = useState(1);
  const [notes,        setNotes]        = useState('');

  const addPrice   = Object.values(additionals).flat().reduce((s, a) => s + a.price, 0);
  const unitPrice  = (variation?.price ?? product.promotional_price ?? product.base_price) + addPrice;

  const toggleAdd = (group: AdditionalGroup, item: Additional) => {
    setAdditionals((prev) => {
      const existing = prev[group.id] ?? [];
      if (existing.find((a) => a.id === item.id)) {
        return { ...prev, [group.id]: existing.filter((a) => a.id !== item.id) };
      }
      if (existing.length >= group.max_select) {
        if (group.max_select === 1) {
          return { ...prev, [group.id]: [{ groupId: group.id, groupName: group.name, id: item.id, name: item.name, price: item.price }] };
        }
        toast.error(`Máximo ${group.max_select} em "${group.name}".`);
        return prev;
      }
      return { ...prev, [group.id]: [...existing, { groupId: group.id, groupName: group.name, id: item.id, name: item.name, price: item.price }] };
    });
  };

  const handleAdd = () => {
    for (const g of product.additional_groups ?? []) {
      if (g.is_required && (additionals[g.id]?.length ?? 0) < g.min_select) {
        toast.error(`Selecione ao menos ${g.min_select} em "${g.name}".`);
        return;
      }
    }
    onAdd({
      product, variationId: variation?.id, variationName: variation?.name,
      unitPrice, quantity: qty,
      additionals: Object.values(additionals).flat(), notes,
    });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-background"
      >
        {product.image_url && (
          <div className="relative h-44 w-full shrink-0">
            <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold">{product.name}</h2>
            {product.description && (
              <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
            )}
            <p className="mt-2 text-xl font-bold text-primary">{formatCurrency(unitPrice)}</p>
          </div>

          {product.variations?.map && product.variations.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Tamanho <span className="text-destructive">*</span></p>
              {product.variations.map((v) => (
                <label key={v.id} onClick={() => setVariation(v)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between rounded-xl border p-3',
                    variation?.id === v.id ? 'border-primary/60 bg-primary/5' : 'border-border/60',
                  )}>
                  <div className="flex items-center gap-2">
                    <div className={cn('h-4 w-4 rounded-full border-2', variation?.id === v.id ? 'border-primary bg-primary' : 'border-border')}>
                      {variation?.id === v.id && <div className="m-auto h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-medium">{v.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(v.price)}</span>
                </label>
              ))}
            </div>
          )}

          {(product.additional_groups ?? []).map((g) => (
            <div key={g.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{g.name}{g.is_required && <span className="text-destructive ml-1">*</span>}</p>
                <span className="text-[10px] text-muted-foreground">Até {g.max_select}</span>
              </div>
              {g.items.map((item) => {
                const sel = (additionals[g.id] ?? []).some((a) => a.id === item.id);
                return (
                  <label key={item.id} onClick={() => toggleAdd(g, item)}
                    className={cn('flex cursor-pointer items-center justify-between rounded-xl border p-3', sel ? 'border-primary/60 bg-primary/5' : 'border-border/60')}>
                    <div className="flex items-center gap-2">
                      <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center border-2', g.max_select === 1 ? 'rounded-full' : 'rounded', sel ? 'border-primary bg-primary' : 'border-border')}>
                        {sel && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm text-primary">{item.price > 0 ? `+${formatCurrency(item.price)}` : 'Grátis'}</span>
                  </label>
                );
              })}
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ex: sem cebola..."
              className="w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/60 px-1">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-6 text-center text-sm font-bold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            <button onClick={handleAdd} className="flex flex-1 items-center justify-between rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition-all">
              <span>Adicionar</span>
              <span className="font-mono">{formatCurrency(unitPrice * qty)}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function MesaPage() {
  const { token }                = useParams<{ token: string }>();
  const { data, loading, error } = useTableMenu(token);

  const [search,        setSearch]        = useState('');
  const [cart,          setCart]          = useState<CartItem[]>([]);
  const [cartOpen,      setCartOpen]      = useState(false);
  const [selectedProd,  setSelectedProd]  = useState<Product | null>(null);
  const [orderDone,     setOrderDone]     = useState<{ id: string; number: number } | null>(null);
  const [customerName,  setCustomerName]  = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [debouncedSearch] = useDebounce(search, 300);

  const filteredMenu = data?.menu?.map((cat) => ({
    ...cat,
    products: (cat.products ?? []).filter((p) =>
      debouncedSearch ? p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) : true,
    ),
  })).filter((cat) => cat.products.length > 0) ?? [];

  useEffect(() => {
    if (!filteredMenu.length) return;
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActiveCategory(e.target.id); },
      { threshold: 0.3, rootMargin: '-60px 0px 0px 0px' },
    );
    Object.values(categoryRefs.current).forEach((el) => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [filteredMenu.length]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = `${item.product.id}-${item.variationId ?? ''}-${item.additionals.map((a) => a.id).sort().join(',')}`;
    setCart((prev) => {
      const ex = prev.find((c) => c.id === id);
      if (ex) return prev.map((c) => c.id === id ? { ...c, quantity: c.quantity + item.quantity } : c);
      return [...prev, { ...item, id }];
    });
    toast.success(`${item.product.name} adicionado!`, { duration: 1500 });
  }, []);

  const removeFromCart = (id: string) => setCart((p) => p.filter((c) => c.id !== id));
  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart((p) => p.map((c) => c.id === id ? { ...c, quantity: qty } : c));
  };

  const sendOrder = async () => {
    if (!data) return;

    setSubmitting(true);
    try {
      const res = await api.post<{ data: { id: string; sequential_number: number } }>(
        '/orders/table',
        {
          customerName: customerName || undefined,
          items: cart.map((item) => ({
            productId  : item.product.id,
            variationId: item.variationId,
            quantity   : item.quantity,
            notes      : item.notes || undefined,
            additionals: item.additionals.map((a) => ({ additionalId: a.id, quantity: 1 })),
          })),
        },
        { headers: { 'x-table-token': token } },
      );
      setOrderDone({ id: res.data.data.id, number: res.data.data.sequential_number });
      setCart([]);
      setCartOpen(false);
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? 'Erro ao enviar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Estados especiais
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
            <UtensilsCrossed className="h-10 w-10 text-destructive" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold">QR Code inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? 'Esta mesa não foi encontrada.'}</p>
          <p className="mt-1 text-xs text-muted-foreground">Peça ao garçom um novo QR Code.</p>
        </div>
      </div>
    );
  }

  if (orderDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xs text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-12 w-12 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold">Pedido enviado!</h2>
          <p className="mt-2 font-mono text-5xl font-black text-primary">
            #{String(orderDone.number).padStart(4, '0')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu pedido foi recebido pela cozinha.<br />Aguarde o atendimento na mesa.
          </p>
          <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {data.table.name ?? data.table.identifier}
              {data.table.location && ` · ${data.table.location}`}
            </p>
          </div>
          <button
            onClick={() => setOrderDone(null)}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:scale-[0.98] transition-all"
          >
            Adicionar mais itens
          </button>
        </motion.div>
      </div>
    );
  }

  const { table, company } = data;

  // ---------------------------------------------------------------------------
  // Render do cardápio de mesa
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">

      {/* Header da mesa */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          {company.logo_url ? (
            <Image src={company.logo_url} alt={company.name} width={32} height={32}
              className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ChefHat className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-none">{company.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {table.name ?? table.identifier}
              {table.location && ` · ${table.location}`}
            </p>
          </div>
          <div className="flex h-7 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-400">Mesa aberta</span>
          </div>
        </div>

        {/* Busca */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="h-9 w-full rounded-xl border border-border/60 bg-muted/40 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs de categoria */}
      {!search && filteredMenu.length > 0 && (
        <div className="overflow-x-auto border-b border-border/60 bg-background/90 scrollbar-hide">
          <div className="flex gap-1 px-4 py-2">
            {filteredMenu.map((cat) => (
              <button
                key={cat.category_id}
                onClick={() => categoryRefs.current[cat.category_id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  activeCategory === cat.category_id
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {cat.category_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Produtos */}
      <div className="pb-32 pt-3">
        {filteredMenu.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground text-sm">Nenhum produto encontrado.</p>
          </div>
        ) : (
          filteredMenu.map((cat) => (
            <div
              key={cat.category_id}
              id={cat.category_id}
              ref={(el) => { categoryRefs.current[cat.category_id] = el; }}
              className="mb-6 px-4"
            >
              <h2 className="mb-3 text-sm font-bold text-foreground">{cat.category_name}</h2>
              <div className="space-y-2.5">
                {cat.products.map((product) => {
                  const price = product.promotional_price ?? product.base_price;
                  return (
                    <motion.button
                      key={product.id}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedProd(product)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-left hover:shadow-soft transition-shadow"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {product.is_featured && <Star className="h-3 w-3 shrink-0 text-amber-400" fill="currentColor" />}
                          <p className="text-sm font-semibold leading-snug">{product.name}</p>
                        </div>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
                        )}
                        {product.prep_time && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />{product.prep_time}min
                          </p>
                        )}
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-sm font-bold text-primary">{formatCurrency(price)}</span>
                          {product.promotional_price && product.promotional_price < product.base_price && (
                            <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.base_price)}</span>
                          )}
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <div className="h-20 w-20 overflow-hidden rounded-xl bg-muted">
                          {product.image_url ? (
                            <Image src={product.image_url} alt={product.name} width={80} height={80} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ChefHat className="h-7 w-7 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary shadow-sm">
                          <Plus className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Botão do carrinho */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-0 right-0 z-30 flex justify-center px-4"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="flex w-full max-w-sm items-center justify-between rounded-2xl bg-primary px-5 py-3.5 text-white shadow-glow"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{cartCount}</span>
              <span className="font-semibold">Ver pedido</span>
              <span className="font-mono font-bold">{formatCurrency(cartTotal)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de produto */}
      <AnimatePresence>
        {selectedProd && (
          <ProductModal product={selectedProd} onClose={() => setSelectedProd(null)} onAdd={addToCart} />
        )}
      </AnimatePresence>

      {/* Drawer do carrinho */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end" onClick={() => setCartOpen(false)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-background"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
                <div>
                  <h2 className="text-base font-bold">Meu Pedido</h2>
                  <p className="text-xs text-muted-foreground">
                    {table.name ?? table.identifier}
                    {table.location && ` · ${table.location}`}
                  </p>
                </div>
                <button onClick={() => setCartOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Itens */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.product.name}</p>
                      {item.variationName && <p className="text-xs text-muted-foreground">{item.variationName}</p>}
                      {item.additionals.length > 0 && (
                        <p className="text-xs text-muted-foreground">+ {item.additionals.map((a) => a.name).join(', ')}</p>
                      )}
                      <p className="mt-1 font-mono text-sm font-semibold text-primary">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQty(item.id, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 hover:bg-muted"><Minus className="h-3 w-3" /></button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 hover:bg-muted"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}

                {/* Nome (opcional) */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-medium text-muted-foreground">Seu nome (opcional)</label>
                  <input
                    value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: João"
                    className="h-9 w-full rounded-xl border border-border/60 bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-border/60 p-4 space-y-3">
                <div className="flex items-center justify-between font-semibold">
                  <span>Total do pedido</span>
                  <span className="font-mono text-lg text-primary">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCartOpen(false)}
                    className="rounded-xl border border-border/60 px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button onClick={sendOrder} disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white active:scale-[0.98] transition-all disabled:opacity-60">
                    {submitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <ShoppingBag className="h-4 w-4" />
                    )}
                    {submitting ? 'Enviando...' : 'Enviar pedido'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
