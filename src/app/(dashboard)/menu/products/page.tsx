/**
 * @file app/(dashboard)/menu/products/page.tsx
 * @description Gestão de produtos do cardápio — listagem, busca, toggle,
 * upload de imagem e exclusão. Formulário de criação/edição em modal lateral.
 *
 * @module app/(dashboard)/menu/products/page
 */

'use client';

import { useState, useRef }                      from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }               from 'framer-motion';
import Image                                     from 'next/image';
import {
  Plus, Search, Filter, Pencil, Trash2, Image as ImageIcon,
  ToggleLeft, ToggleRight, X, Upload, Loader2,
  Tag, Clock, Users, ChevronDown, Star,
} from 'lucide-react';
import { toast }            from 'sonner';
import { useDebounce }      from 'use-debounce';
import { useForm }          from 'react-hook-form';
import { zodResolver }      from '@hookform/resolvers/zod';
import { z }                from 'zod';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, api } from '@/lib/api';
import { useAuth }          from '@/hooks/use-auth';
import { formatCurrency, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Category { id: string; name: string; }

interface Product {
  id              : string;
  category_id     : string | null;
  category_name   : string | null;
  name            : string;
  description     : string | null;
  image_url       : string | null;
  base_price      : number;
  promotional_price: number | null;
  is_active       : boolean;
  is_featured     : boolean;
  sort_order      : number;
  prep_time       : number | null;
  serves          : number;
  stock_control   : boolean;
  stock_quantity  : number | null;
  tags            : string[];
  variations      : Array<{ id: string; name: string; price: number }> | null;
}

interface ProductsResponse {
  products  : Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ---------------------------------------------------------------------------
// Schema do formulário
// ---------------------------------------------------------------------------

const productFormSchema = z.object({
  categoryId      : z.string().uuid().optional().or(z.literal('')),
  name            : z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(200),
  description     : z.string().max(1000).optional(),
  basePrice       : z.coerce.number().nonnegative('Preço não pode ser negativo.'),
  promotionalPrice: z.coerce.number().nonnegative().optional().or(z.literal('')),
  costPrice       : z.coerce.number().nonnegative().optional().or(z.literal('')),
  prepTime        : z.coerce.number().int().min(1).max(480).optional().or(z.literal('')),
  serves          : z.coerce.number().int().min(1).max(100).default(1),
  isActive        : z.boolean().default(true),
  isFeatured      : z.boolean().default(false),
  stockControl    : z.boolean().default(false),
  stockQuantity   : z.coerce.number().int().min(0).optional().or(z.literal('')),
  tags            : z.string().optional(),             // CSV "a,b,c" → split no submit
});

type ProductFormValues = z.infer<typeof productFormSchema>;

// ---------------------------------------------------------------------------
// Componente: ProductFormModal
// ---------------------------------------------------------------------------

function ProductFormModal({
  product, categories, onClose,
}: {
  product?   : Product;
  categories : Category[];
  onClose    : () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit      = !!product;

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<ProductFormValues>({
      resolver: zodResolver(productFormSchema),
      defaultValues: product ? {
        categoryId      : product.category_id ?? '',
        name            : product.name,
        description     : product.description ?? '',
        basePrice       : product.base_price,
        promotionalPrice: product.promotional_price ?? '',
        prepTime        : product.prep_time ?? '',
        serves          : product.serves,
        isActive        : product.is_active,
        isFeatured      : product.is_featured,
        stockControl    : product.stock_control,
        stockQuantity   : product.stock_quantity ?? '',
        tags            : product.tags?.join(', ') ?? '',
      } : {
        isActive: true, isFeatured: false, stockControl: false, serves: 1,
      },
    });

  const stockControl = watch('stockControl');

  const onSubmit = async (data: ProductFormValues) => {
    const payload = {
      ...data,
      categoryId      : data.categoryId || undefined,
      promotionalPrice: data.promotionalPrice === '' ? undefined : data.promotionalPrice,
      costPrice       : data.costPrice === '' ? undefined : data.costPrice,
      prepTime        : data.prepTime === '' ? undefined : data.prepTime,
      stockQuantity   : data.stockQuantity === '' ? undefined : data.stockQuantity,
      tags            : data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };

    try {
      if (isEdit) {
        await apiPut(`/products/${product!.id}`, payload);
        toast.success('Produto atualizado!');
      } else {
        await apiPost('/products', payload);
        toast.success('Produto criado!');
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? 'Erro ao salvar produto.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-border bg-card"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-base font-bold">{isEdit ? 'Editar Produto' : 'Novo Produto'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">

            {/* Categoria */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">Categoria</label>
              <div className="relative">
                <select
                  {...register('categoryId')}
                  className="h-9 w-full appearance-none rounded-lg border border-border/60 bg-muted/30 pl-3 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Nome <span className="text-destructive">*</span>
              </label>
              <input
                {...register('name')}
                placeholder="Ex: Hambúrguer Artesanal"
                className={cn(
                  'h-9 w-full rounded-lg border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all',
                  errors.name ? 'border-destructive/60' : 'border-border/60',
                )}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">Descrição</label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Descreva os ingredientes, modo de preparo..."
                className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
              />
            </div>

            {/* Preços */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">
                  Preço <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <input
                    {...register('basePrice')}
                    type="number" step="0.01" min="0"
                    placeholder="0,00"
                    className={cn(
                      'h-9 w-full rounded-lg border bg-muted/30 pl-8 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all',
                      errors.basePrice ? 'border-destructive/60' : 'border-border/60',
                    )}
                  />
                </div>
                {errors.basePrice && <p className="text-xs text-destructive">{errors.basePrice.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Preço Promocional</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <input
                    {...register('promotionalPrice')}
                    type="number" step="0.01" min="0"
                    placeholder="0,00"
                    className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 pl-8 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Tempo de preparo + Serve */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />Preparo (min)
                </label>
                <input
                  {...register('prepTime')}
                  type="number" min="1" placeholder="Ex: 20"
                  className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">
                  <Users className="mr-1 inline h-3 w-3" />Serve (pessoas)
                </label>
                <input
                  {...register('serves')}
                  type="number" min="1" placeholder="1"
                  className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                <Tag className="mr-1 inline h-3 w-3" />Tags (separadas por vírgula)
              </label>
              <input
                {...register('tags')}
                placeholder="Ex: vegano, sem glúten, destaque"
                className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              {[
                { field: 'isActive'     as const, label: 'Produto ativo',        desc: 'Visível no cardápio' },
                { field: 'isFeatured'   as const, label: 'Destaque',             desc: 'Aparece primeiro no cardápio' },
                { field: 'stockControl' as const, label: 'Controle de estoque',  desc: 'Limita quantidade disponível' },
              ].map(({ field, label, desc }) => (
                <label key={field} className="flex cursor-pointer items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <input type="checkbox" {...register(field)} className="sr-only peer" />
                  <div className="relative h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors">
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                </label>
              ))}
            </div>

            {/* Estoque (condicional) */}
            {stockControl && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Quantidade em estoque</label>
                <input
                  {...register('stockQuantity')}
                  type="number" min="0" placeholder="Ex: 50"
                  className="h-9 w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border/60 p-4">
            <div className="flex gap-2">
              <button
                type="button" onClick={onClose}
                className="flex-1 rounded-lg border border-border/60 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={isSubmitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 active:scale-[0.98] transition-all shadow-glow-sm disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Salvar alterações' : 'Criar produto'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Componente: ImageUpload (inline)
// ---------------------------------------------------------------------------

function ImageUploadButton({ product, onSuccess }: { product: Product; onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    setLoading(true);
    try {
      await api.post(`/products/${product.id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Imagem atualizada!');
      onSuccess();
    } catch {
      toast.error('Erro ao fazer upload da imagem.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="sr-only" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        title="Upload de imagem"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const queryClient            = useQueryClient();
  const { hasRole }            = useAuth();

  const [search,   setSearch]   = useState('');
  const [catFilter,setCatFilter]= useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Product | undefined>();
  const [page,     setPage]     = useState(1);

  const [debouncedSearch] = useDebounce(search, 350);
  const canEdit = hasRole('owner', 'admin', 'manager');

  // Queries
  const { data: catsData } = useQuery<Category[]>({
    queryKey: ['categories-list'],
    queryFn : () => apiGet<Category[]>('/products/categories'),
  });
  const categories = catsData ?? [];

  const { data, isLoading, isFetching } = useQuery<ProductsResponse>({
    queryKey: ['products', { search: debouncedSearch, catFilter, page }],
    queryFn : () => {
      const p = new URLSearchParams({
        page: String(page), limit: '24',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(catFilter        && { categoryId: catFilter }),
      });
      return apiGet(`/products?${p}`);
    },
    placeholderData: (prev) => prev,
  });

  const products   = data?.products   ?? [];
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  // Mutations
  const { mutate: toggleProduct } = useMutation({
    mutationFn: (id: string) => apiPatch(`/products/${id}/toggle`),
    onSuccess : (res: unknown) => {
      const r = res as { is_active: boolean };
      toast.success(r.is_active ? 'Produto ativado.' : 'Produto desativado.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Erro ao alterar status.'),
  });

  const { mutate: deleteProduct } = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess : () => {
      toast.success('Produto removido.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Não foi possível remover o produto.'),
  });

  const handleEdit = (product: Product) => { setEditing(product); setShowForm(true); };
  const handleNew  = ()                   => { setEditing(undefined); setShowForm(true); };
  const handleClose = ()                  => { setShowForm(false); setEditing(undefined); };

  const handleDelete = (product: Product) => {
    if (confirm(`Remover "${product.name}"? Esta ação não pode ser desfeita.`)) {
      deleteProduct(product.id);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total} produto{pagination.total !== 1 ? 's' : ''} cadastrado{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar produtos..."
            className="h-9 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/50 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            value={catFilter}
            onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
            className="h-9 appearance-none rounded-lg border border-border/60 bg-card pl-9 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid de produtos */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-20">
          <Tag className="h-12 w-12 text-muted-foreground/30" strokeWidth={1} />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
          {canEdit && (
            <button
              onClick={handleNew}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Criar primeiro produto
            </button>
          )}
        </div>
      ) : (
        <div className={cn(
          'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          isFetching && 'opacity-70 pointer-events-none',
        )}>
          {products.map((product) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft transition-shadow hover:shadow-soft-md',
                !product.is_active && 'opacity-60',
              )}
            >
              {/* Imagem */}
              <div className="relative h-40 bg-muted/40 overflow-hidden">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
                  </div>
                )}

                {/* Badges */}
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {product.is_featured && (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Star className="h-2.5 w-2.5" />Destaque
                    </span>
                  )}
                  {!product.is_active && (
                    <span className="rounded-full bg-slate-700/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Inativo
                    </span>
                  )}
                  {product.promotional_price && (
                    <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Promoção
                    </span>
                  )}
                </div>

                {/* Ações overlay */}
                {canEdit && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <ImageUploadButton
                      product={product}
                      onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
                    />
                  </div>
                )}
              </div>

              {/* Conteúdo */}
              <div className="flex flex-1 flex-col p-3.5">
                {/* Categoria */}
                {product.category_name && (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {product.category_name}
                  </p>
                )}

                <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {product.name}
                </p>

                {/* Preço */}
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono text-base font-bold text-foreground">
                    {formatCurrency(
                      product.promotional_price ?? product.base_price,
                    )}
                  </span>
                  {product.promotional_price && (
                    <span className="font-mono text-xs text-muted-foreground line-through">
                      {formatCurrency(product.base_price)}
                    </span>
                  )}
                </div>

                {/* Metadados */}
                {(product.prep_time || product.serves > 1) && (
                  <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                    {product.prep_time && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />{product.prep_time}min
                      </span>
                    )}
                    {product.serves > 1 && (
                      <span className="flex items-center gap-0.5">
                        <Users className="h-3 w-3" />{product.serves} pessoas
                      </span>
                    )}
                  </div>
                )}

                {/* Tags */}
                {product.tags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {product.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="tag-chip">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer de ações */}
              {canEdit && (
                <div className="flex items-center justify-between border-t border-border/40 px-3.5 py-2.5">
                  {/* Toggle ativo */}
                  <button
                    onClick={() => toggleProduct(product.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      product.is_active
                        ? 'text-emerald-400 hover:bg-emerald-400/10'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {product.is_active
                      ? <ToggleRight className="h-4 w-4" />
                      : <ToggleLeft className="h-4 w-4" />
                    }
                    {product.is_active ? 'Ativo' : 'Inativo'}
                  </button>

                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleEdit(product)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-40 transition-all"
          >
            ← Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-40 transition-all"
          >
            Próxima →
          </button>
        </div>
      )}

      {/* Modal de formulário */}
      <AnimatePresence>
        {showForm && (
          <ProductFormModal
            product={editing}
            categories={categories}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
