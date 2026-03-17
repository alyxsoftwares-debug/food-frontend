/**
 * @file app/menu/[slug]/page.tsx
 * @description Cardápio digital público — acessado por clientes finais.
 *
 * Features:
 *  - Busca de empresa pelo slug (SSG com revalidação a cada 60s)
 *  - Navegação por categorias (sticky tab bar)
 *  - Cards de produto com modal de customização (variações + adicionais)
 *  - Carrinho persistido em estado local
 *  - Formulário de finalização (delivery/retirada)
 *  - Rastreamento do pedido após confirmação
 *
 * @module app/menu/[slug]/page
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image                          from 'next/image';
import { motion, AnimatePresence }    from 'framer-motion';
import {
  Search, ShoppingBag, Plus, Minus, X, ArrowRight,
  MapPin, Clock, ChefHat, Star, Bike, Package, Check,
} from 'lucide-react';
import { toast }                      from 'sonner';
import { useParams }                  from 'next/navigation';
import { apiGet, apiPost }            from '@/lib/api';
import { formatCurrency, cn }         from '@/lib/utils';
import { useDebounce }                from 'use-debounce';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Additional {
  id    : string;
  name  : string;
  price : number;
}

interface AdditionalGroup {
  id         : string;
  name       : string;
  min_select : number;
  max_select : number;
  is_required: boolean;
  items      : Additional[];
}

interface Variation {
  id    : string;
  name  : string;
  price : number;
}

interface Product {
  id               : string;
  name             : string;
  description      : string | null;
  image_url        : string | null;
  base_price       : number;
  promotional_price: number | null;
  prep_time        : number | null;
  serves           : number;
  tags             : string[];
  is_featured      : boolean;
  variations       : Variation[] | null;
  additional_groups: AdditionalGroup[] | null;
}

interface MenuCategory {
  category_id         : string;
  category_name       : string;
  category_description: string | null;
  products            : Product[] | null;
}

interface CompanyInfo {
  id           : string;
  name         : string;
  logo_url     : string | null;
  cover_url    : string | null;
  description  : string | null;
  address_city : string | null;
  address_state: string | null;
  primary_color: string;
}

interface DeliverySettings {
  is_delivery_enabled    : boolean;
  is_pickup_enabled      : boolean;
  min_order_value        : number;
  base_delivery_fee      : number;
  free_delivery_above    : number | null;
  estimated_delivery_time: number;
  estimated_pickup_time  : number;
  accepted_payments      : string[];
}

interface MenuData {
  company : CompanyInfo;
  settings: DeliverySettings;
  menu    : MenuCategory[];
}

// ---------------------------------------------------------------------------
// Tipos do carrinho
// ---------------------------------------------------------------------------

interface CartAdditional {
  groupId  : string;
  groupName: string;
  id       : string;
  name     : string;
  price    : number;
  qty      : number;
}

interface CartItem {
  id          : string;  // product.id + variation.id + additionals hash
  product     : Product;
  variationId?: string;
  variationName?: string;
  unitPrice   : number;
  quantity    : number;
  additionals : CartAdditional[];
  notes       : string;
}

// ---------------------------------------------------------------------------
// Hook: busca o cardápio
// ---------------------------------------------------------------------------

function useMenu(slug: string) {
  const [data,    setData]    = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    apiGet<MenuData>(`/menu/${slug}`)
      .then(setData)
      .catch((e) => setError(e.message ?? 'Cardápio não encontrado.'))
      .finally(() => setLoading(false));
  }, [slug]);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Modal de customização do produto
// ---------------------------------------------------------------------------

function ProductModal({
  product, onClose, onAddToCart,
}: {
  product    : Product;
  onClose    : () => void;
  onAddToCart: (item: Omit<CartItem, 'id'>) => void;
}) {
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(
    product.variations?.[0] ?? null,
  );
  const [selectedAdditionals, setSelectedAdditionals] = useState<Record<string, CartAdditional[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes,    setNotes]    = useState('');

  const basePrice = selectedVariation?.price ?? product.promotional_price ?? product.base_price;
  const addPrice  = Object.values(selectedAdditionals)
    .flat()
    .reduce((sum, a) => sum + a.price * a.qty, 0);
  const unitPrice = basePrice + addPrice;
  const totalPrice = unitPrice * quantity;

  const toggleAdditional = (group: AdditionalGroup, item: Additional) => {
    setSelectedAdditionals((prev) => {
      const existing = prev[group.id] ?? [];
      const found    = existing.find((a) => a.id === item.id);

      if (found) {
        // Remove
        const next = existing.filter((a) => a.id !== item.id);
        return { ...prev, [group.id]: next };
      }

      // Verifica limite máximo
      if (existing.length >= group.max_select) {
        if (group.max_select === 1) {
          // Radio behavior — substitui
          return {
            ...prev,
            [group.id]: [{
              groupId: group.id, groupName: group.name,
              id: item.id, name: item.name, price: item.price, qty: 1,
            }],
          };
        }
        toast.error(`Máximo de ${group.max_select} opções em "${group.name}".`);
        return prev;
      }

      return {
        ...prev,
        [group.id]: [...existing, {
          groupId: group.id, groupName: group.name,
          id: item.id, name: item.name, price: item.price, qty: 1,
        }],
      };
    });
  };

  const handleAdd = () => {
    // Valida obrigatórios
    for (const group of product.additional_groups ?? []) {
      if (group.is_required) {
        const selected = selectedAdditionals[group.id]?.length ?? 0;
        if (selected < group.min_select) {
          toast.error(`Selecione ao menos ${group.min_select} opção em "${group.name}".`);
          return;
        }
      }
    }

    const allAdditionals = Object.values(selectedAdditionals).flat();

    onAddToCart({
      product,
      variationId  : selectedVariation?.id,
      variationName: selectedVariation?.name,
      unitPrice,
      quantity,
      additionals  : allAdditionals,
      notes,
    });

    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-background sm:rounded-2xl"
        style={{ '--primary': '24 100% 50%' } as React.CSSProperties}
      >
        {/* Imagem */}
        {product.image_url && (
          <div className="relative h-48 w-full shrink-0 overflow-hidden">
            <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="512px" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        )}

        {/* Scroll */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Info */}
            <div>
              <h2 className="text-lg font-bold leading-tight">{product.name}</h2>
              {product.description && (
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              )}
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xl font-bold" style={{ color: 'hsl(var(--primary))' }}>
                  {formatCurrency(basePrice + addPrice)}
                </span>
                {product.promotional_price && product.promotional_price < product.base_price && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatCurrency(product.base_price)}
                  </span>
                )}
              </div>
            </div>

            {/* Variações */}
            {product.variations && product.variations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Tamanho / Variação <span className="text-destructive">*</span></p>
                <div className="space-y-1.5">
                  {product.variations.map((v) => (
                    <label
                      key={v.id}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all',
                        selectedVariation?.id === v.id
                          ? 'border-primary/60 bg-primary/5'
                          : 'border-border/60 hover:border-border',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
                          selectedVariation?.id === v.id
                            ? 'border-primary bg-primary'
                            : 'border-border',
                        )}>
                          {selectedVariation?.id === v.id && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{v.name}</span>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(v.price)}</span>
                      <input
                        type="radio"
                        name="variation"
                        value={v.id}
                        checked={selectedVariation?.id === v.id}
                        onChange={() => setSelectedVariation(v)}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Grupos de adicionais */}
            {(product.additional_groups ?? []).map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {group.name}
                    {group.is_required && <span className="ml-1 text-destructive">*</span>}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {group.min_select === 0
                      ? `Até ${group.max_select}`
                      : `${group.min_select}–${group.max_select}`}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const isSelected = (selectedAdditionals[group.id] ?? []).some((a) => a.id === item.id);
                    return (
                      <label
                        key={item.id}
                        className={cn(
                          'flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all',
                          isSelected ? 'border-primary/60 bg-primary/5' : 'border-border/60 hover:border-border',
                        )}
                        onClick={() => toggleAdditional(group, item)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors border-2',
                            group.max_select === 1 ? 'rounded-full' : 'rounded',
                            isSelected ? 'border-primary bg-primary' : 'border-border',
                          )}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-primary">
                          {item.price > 0 ? `+ ${formatCurrency(item.price)}` : 'Grátis'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: sem cebola, ponto da carne..."
                rows={2}
                className="w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer fixo */}
        <div className="shrink-0 border-t border-border/60 p-4">
          <div className="flex items-center gap-3">
            {/* Quantidade */}
            <div className="flex items-center gap-2 rounded-xl border border-border/60 px-1">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-bold tabular-nums">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Adicionar */}
            <button
              onClick={handleAdd}
              className="flex flex-1 items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
              style={{ background: 'hsl(var(--primary))' }}
            >
              <span>Adicionar</span>
              <span className="font-mono">{formatCurrency(totalPrice)}</span>
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

export default function MenuPage() {
  const params           = useParams<{ slug: string }>();
  const { data, loading, error } = useMenu(params.slug);

  const [search,       setSearch]       = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [cartOpen,     setCartOpen]     = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderPlaced,  setOrderPlaced]  = useState<{ id: string; number: number } | null>(null);

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [debouncedSearch] = useDebounce(search, 300);

  // Filtra produtos por busca
  const filteredMenu = data?.menu?.map((cat) => ({
    ...cat,
    products: (cat.products ?? []).filter((p) =>
      debouncedSearch
        ? p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
        : true,
    ),
  })).filter((cat) => cat.products.length > 0) ?? [];

  // Scroll spy — atualiza categoria ativa
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveCategory(entry.target.id);
        }
      },
      { threshold: 0.3, rootMargin: '-64px 0px 0px 0px' },
    );
    Object.values(categoryRefs.current).forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [filteredMenu.length]);

  // Carrinho helpers
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal     = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = `${item.product.id}-${item.variationId ?? ''}-${item.additionals.map((a) => a.id).sort().join(',')}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing) {
        return prev.map((c) => c.id === id ? { ...c, quantity: c.quantity + item.quantity } : c);
      }
      return [...prev, { ...item, id }];
    });
    toast.success(`${item.product.name} adicionado!`, { duration: 1500 });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, quantity: qty } : c));
  }, [removeFromCart]);

  // Finalizar pedido
  const handleCheckout = async (orderData: {
    type : 'delivery' | 'pickup';
    customerName : string;
    customerPhone: string;
    deliveryAddress?: Record<string, string>;
  }) => {
    if (!data) return;

    try {
      const payload = {
        companyId    : data.company.id,
        type         : orderData.type,
        customerName : orderData.customerName,
        customerPhone: orderData.customerPhone,
        deliveryAddress: orderData.deliveryAddress,
        items: cart.map((item) => ({
          productId  : item.product.id,
          variationId: item.variationId,
          quantity   : item.quantity,
          notes      : item.notes || undefined,
          additionals: item.additionals.map((a) => ({
            additionalId: a.id,
            quantity    : a.qty,
          })),
        })),
      };

      const order = await apiPost<{ id: string; sequential_number: number }>(
        `/menu/${params.slug}/orders`, payload,
      );

      setOrderPlaced({ id: order.id, number: order.sequential_number });
      setCart([]);
      setCartOpen(false);
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? 'Erro ao finalizar pedido.');
    }
  };

  // ---------------------------------------------------------------------------
  // Estados de loading / error / pedido feito
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20 animate-pulse flex items-center justify-center">
            <ChefHat className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <ChefHat className="mx-auto h-16 w-16 text-muted-foreground/30" strokeWidth={1} />
          <p className="mt-4 text-lg font-semibold">Cardápio não encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold">Pedido realizado!</h2>
          <p className="mt-2 font-mono text-4xl font-black text-primary">
            #{String(orderPlaced.number).padStart(4, '0')}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Acompanhe seu pedido pelo número acima.
          </p>
          <button
            onClick={() => setOrderPlaced(null)}
            className="mt-6 w-full rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ background: 'hsl(24 100% 50%)' }}
          >
            Fazer outro pedido
          </button>
        </motion.div>
      </div>
    );
  }

  const { company, settings } = data;

  // ---------------------------------------------------------------------------
  // Render do cardápio
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background" style={{ '--primary': '24 100% 50%' } as React.CSSProperties}>

      {/* Hero / Cover */}
      <div className="relative h-40 overflow-hidden bg-muted sm:h-52">
        {company.cover_url ? (
          <Image src={company.cover_url} alt={company.name} fill className="object-cover" priority sizes="100vw" />
        ) : (
          <div className="h-full w-full" style={{ background: `hsl(${company.primary_color})` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      {/* Info da empresa */}
      <div className="relative px-4 pb-4">
        <div className="flex items-end gap-4 -mt-8">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-muted shadow-soft-md">
            {company.logo_url ? (
              <Image src={company.logo_url} alt={company.name} fill className="object-cover" sizes="80px" />
            ) : (
              <div className="flex h-full items-center justify-center bg-primary">
                <ChefHat className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
          <div className="pb-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight">{company.name}</h1>
            {(company.address_city || company.address_state) && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3" />
                {[company.address_city, company.address_state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Badges de info */}
        <div className="mt-4 flex flex-wrap gap-2">
          {settings.is_delivery_enabled && (
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs">
              <Bike className="h-3.5 w-3.5 text-primary" />
              <span>Entrega • {settings.estimated_delivery_time}min</span>
              {settings.base_delivery_fee > 0
                ? <span className="font-medium">• {formatCurrency(settings.base_delivery_fee)}</span>
                : <span className="text-emerald-400 font-medium">• Grátis</span>
              }
            </div>
          )}
          {settings.is_pickup_enabled && (
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs">
              <Package className="h-3.5 w-3.5 text-primary" />
              <span>Retirada • {settings.estimated_pickup_time}min</span>
            </div>
          )}
          {settings.min_order_value > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <span>Pedido mín. {formatCurrency(settings.min_order_value)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Busca */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-sm px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar em ${company.name}...`}
            className="h-10 w-full rounded-xl border border-border/60 bg-muted/40 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:border-primary/40"
            style={{ '--tw-ring-color': 'hsl(var(--primary) / 0.4)' } as React.CSSProperties}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs de categorias */}
      {!search && (
        <div className="sticky top-[61px] z-10 overflow-x-auto border-b border-border/60 bg-background/95 backdrop-blur-sm scrollbar-hide">
          <div className="flex gap-1 px-4 py-2">
            {filteredMenu.map((cat) => (
              <button
                key={cat.category_id}
                onClick={() => {
                  categoryRefs.current[cat.category_id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  activeCategory === cat.category_id
                    ? 'text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                style={activeCategory === cat.category_id ? { background: 'hsl(var(--primary))' } : {}}
              >
                {cat.category_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="mx-auto max-w-2xl px-4 pb-32 pt-4">
        {filteredMenu.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-muted-foreground">Nenhum produto encontrado para "{search}".</p>
          </div>
        ) : (
          filteredMenu.map((cat) => (
            <div
              key={cat.category_id}
              id={cat.category_id}
              ref={(el) => { categoryRefs.current[cat.category_id] = el; }}
              className="mb-8"
            >
              <h2 className="mb-4 text-base font-bold">{cat.category_name}</h2>
              <div className="space-y-3">
                {cat.products.map((product) => {
                  const price = product.promotional_price ?? product.base_price;
                  return (
                    <motion.button
                      key={product.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedProduct(product)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-left transition-shadow hover:shadow-soft"
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5">
                          {product.is_featured && (
                            <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor" />
                          )}
                          <p className="text-sm font-semibold leading-snug">{product.name}</p>
                        </div>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {product.description}
                          </p>
                        )}
                        {product.prep_time && (
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />{product.prep_time}min
                          </p>
                        )}
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-sm font-bold" style={{ color: 'hsl(var(--primary))' }}>
                            {formatCurrency(price)}
                          </span>
                          {product.promotional_price && product.promotional_price < product.base_price && (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatCurrency(product.base_price)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Imagem + botão */}
                      <div className="relative shrink-0">
                        <div className="h-20 w-20 overflow-hidden rounded-xl bg-muted">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              width={80} height={80}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ChefHat className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div
                          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
                          style={{ background: 'hsl(var(--primary))' }}
                        >
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
        {cartItemCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-0 right-0 z-30 flex justify-center px-4"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="flex w-full max-w-sm items-center justify-between rounded-2xl px-5 py-3.5 text-white shadow-glow"
              style={{ background: 'hsl(var(--primary))' }}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                {cartItemCount}
              </div>
              <span className="font-semibold">Ver carrinho</span>
              <span className="font-mono font-bold">{formatCurrency(cartTotal)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal do produto */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={addToCart}
          />
        )}
      </AnimatePresence>

      {/* Carrinho / Checkout drawer */}
      <AnimatePresence>
        {cartOpen && (
          <CartDrawer
            cart={cart}
            settings={settings}
            onClose={() => setCartOpen(false)}
            onUpdateQty={updateQty}
            onRemove={removeFromCart}
            onCheckout={handleCheckout}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer do carrinho + checkout
// ---------------------------------------------------------------------------

function CartDrawer({
  cart, settings, onClose, onUpdateQty, onRemove, onCheckout,
}: {
  cart        : CartItem[];
  settings    : DeliverySettings;
  onClose     : () => void;
  onUpdateQty : (id: string, qty: number) => void;
  onRemove    : (id: string) => void;
  onCheckout  : (data: {
    type: 'delivery' | 'pickup';
    customerName: string;
    customerPhone: string;
    deliveryAddress?: Record<string, string>;
  }) => Promise<void>;
}) {
  const [step,  setStep]  = useState<'cart' | 'checkout'>('cart');
  const [type,  setType]  = useState<'delivery' | 'pickup'>('delivery');
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [addr,  setAddr]  = useState({ street: '', number: '', neighborhood: '', city: '', state: '', zip: '' });
  const [submitting, setSubmitting] = useState(false);

  const subtotal    = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const deliveryFee = type === 'delivery' ? (settings.base_delivery_fee > 0
    && (!settings.free_delivery_above || subtotal < settings.free_delivery_above)
    ? settings.base_delivery_fee : 0) : 0;
  const total = subtotal + deliveryFee;

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Nome e telefone são obrigatórios.'); return; }
    if (type === 'delivery' && !addr.street.trim()) { toast.error('Endereço de entrega obrigatório.'); return; }
    if (subtotal < settings.min_order_value) {
      toast.error(`Pedido mínimo de ${formatCurrency(settings.min_order_value)}.`);
      return;
    }

    setSubmitting(true);
    try {
      await onCheckout({
        type, customerName: name, customerPhone: phone,
        deliveryAddress: type === 'delivery' ? addr : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-background"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-base font-bold">
            {step === 'cart' ? `Carrinho (${cart.length})` : 'Finalizar Pedido'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'cart' ? (
            <div className="p-5 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.product.name}</p>
                    {item.variationName && (
                      <p className="text-xs text-muted-foreground">{item.variationName}</p>
                    )}
                    {item.additionals.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {item.additionals.map((a) => a.name).join(', ')}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-sm font-semibold" style={{ color: 'hsl(24 100% 50%)' }}>
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 hover:bg-muted transition-colors">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <button onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 hover:bg-muted transition-colors">
                      <Plus className="h-3 w-3" />
                    </button>
                    <button onClick={() => onRemove(item.id)}
                      className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Tipo de entrega */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Como deseja receber?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'delivery', label: 'Delivery', icon: Bike, available: settings.is_delivery_enabled },
                    { value: 'pickup',   label: 'Retirada',  icon: Package, available: settings.is_pickup_enabled },
                  ].filter((o) => o.available).map((opt) => (
                    <button key={opt.value}
                      onClick={() => setType(opt.value as 'delivery' | 'pickup')}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all',
                        type === opt.value ? 'border-primary/60 bg-primary/5 text-primary' : 'border-border/60 hover:border-border',
                      )}
                    >
                      <opt.icon className="h-4 w-4" />{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dados pessoais */}
              {['name', 'phone'].map((field) => (
                <div key={field} className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground capitalize">
                    {field === 'name' ? 'Seu nome' : 'WhatsApp / Telefone'} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type={field === 'phone' ? 'tel' : 'text'}
                    value={field === 'name' ? name : phone}
                    onChange={(e) => field === 'name' ? setName(e.target.value) : setPhone(e.target.value)}
                    placeholder={field === 'name' ? 'Ex: João Silva' : '(84) 99999-0000'}
                    className="h-9 w-full rounded-xl border border-border/60 bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  />
                </div>
              ))}

              {/* Endereço (somente delivery) */}
              {type === 'delivery' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Endereço de entrega <span className="text-destructive">*</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={addr.street} onChange={(e) => setAddr({...addr, street: e.target.value})}
                      placeholder="Rua" className="col-span-2 h-9 rounded-xl border border-border/60 bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                    <input value={addr.number} onChange={(e) => setAddr({...addr, number: e.target.value})}
                      placeholder="Nº" className="h-9 rounded-xl border border-border/60 bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                  <input value={addr.neighborhood} onChange={(e) => setAddr({...addr, neighborhood: e.target.value})}
                    placeholder="Bairro" className="h-9 w-full rounded-xl border border-border/60 bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={addr.city} onChange={(e) => setAddr({...addr, city: e.target.value})}
                      placeholder="Cidade" className="h-9 rounded-xl border border-border/60 bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                    <input value={addr.zip} onChange={(e) => setAddr({...addr, zip: e.target.value})}
                      placeholder="CEP" className="h-9 rounded-xl border border-border/60 bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/60 p-4 space-y-3">
          {/* Totais */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            {step === 'checkout' && type === 'delivery' && (
              <div className="flex justify-between text-muted-foreground">
                <span>Entrega</span>
                <span className="tabular-nums">
                  {deliveryFee === 0 ? <span className="text-emerald-400">Grátis</span> : formatCurrency(deliveryFee)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border/60 pt-2 font-bold">
              <span>Total</span>
              <span className="font-mono tabular-nums" style={{ color: 'hsl(24 100% 50%)' }}>
                {formatCurrency(step === 'checkout' ? total : subtotal)}
              </span>
            </div>
          </div>

          {step === 'cart' ? (
            <button
              onClick={() => setStep('checkout')}
              className="flex w-full items-center justify-between rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
              style={{ background: 'hsl(24 100% 50%)' }}
            >
              <span>Continuar</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setStep('cart')}
                className="rounded-xl border border-border/60 px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                ← Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'hsl(24 100% 50%)' }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                {submitting ? 'Enviando...' : 'Confirmar pedido'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Loader2 import fix
function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
