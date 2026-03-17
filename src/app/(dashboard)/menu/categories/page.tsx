/**
 * @file app/(dashboard)/menu/categories/page.tsx
 * @description Gestão de categorias do cardápio com reordenação drag-and-drop.
 *
 * @module app/(dashboard)/menu/categories/page
 */

'use client';

import { useState }                              from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, Reorder }      from 'framer-motion';
import {
  Plus, Pencil, Trash2, GripVertical, Check, X,
  Clock, Calendar, ToggleLeft, ToggleRight, Tag,
} from 'lucide-react';
import { toast }         from 'sonner';
import { useForm }       from 'react-hook-form';
import { zodResolver }   from '@hookform/resolvers/zod';
import { z }             from 'zod';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api';
import { useAuth }       from '@/hooks/use-auth';
import { cn }            from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Category {
  id              : string;
  name            : string;
  description     : string | null;
  color           : string | null;
  sort_order      : number;
  is_active       : boolean;
  available_from  : string | null;
  available_until : string | null;
  available_days  : string[] | null;
  active_product_count: number;
  total_product_count : number;
}

// ---------------------------------------------------------------------------
// Schema do formulário
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name          : z.string().min(2, 'Mínimo 2 caracteres.').max(100),
  description   : z.string().max(500).optional(),
  color         : z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.').optional().or(z.literal('')),
  isActive      : z.boolean().default(true),
  availableFrom : z.string().optional().or(z.literal('')),
  availableUntil: z.string().optional().or(z.literal('')),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const DAY_LABELS: Record<string, string> = {
  sunday: 'Dom', monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua',
  thursday: 'Qui', friday: 'Sex', saturday: 'Sáb',
};

const ALL_DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const PRESET_COLORS = [
  '#FF6B35','#E53E3E','#DD6B20','#D69E2E','#38A169',
  '#3182CE','#805AD5','#D53F8C','#718096','#2D3748',
];

// ---------------------------------------------------------------------------
// Formulário inline de categoria
// ---------------------------------------------------------------------------

function CategoryForm({
  category, onClose,
}: {
  category?: Category;
  onClose  : () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit      = !!category;

  const [selectedDays, setSelectedDays] = useState<string[]>(
    category?.available_days ?? ALL_DAYS,
  );

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<CategoryFormValues>({
      resolver: zodResolver(categorySchema),
      defaultValues: {
        name          : category?.name ?? '',
        description   : category?.description ?? '',
        color         : category?.color ?? '',
        isActive      : category?.is_active ?? true,
        availableFrom : category?.available_from ?? '',
        availableUntil: category?.available_until ?? '',
      },
    });

  const color = watch('color');

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const onSubmit = async (data: CategoryFormValues) => {
    const payload = {
      name          : data.name,
      description   : data.description || undefined,
      color         : data.color || undefined,
      is_active     : data.isActive,
      available_from : data.availableFrom || undefined,
      available_until: data.availableUntil || undefined,
      available_days : selectedDays.length === 7 ? undefined : selectedDays,
    };

    try {
      if (isEdit) {
        await apiPut(`/products/categories/${category!.id}`, payload);
        toast.success('Categoria atualizada!');
      } else {
        await apiPost('/products/categories', payload);
        toast.success('Categoria criada!');
      }
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? 'Erro ao salvar.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="m-4 space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {isEdit ? 'Editar Categoria' : 'Nova Categoria'}
          </h3>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Nome */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">
              Nome <span className="text-destructive">*</span>
            </label>
            <input
              {...register('name')}
              placeholder="Ex: Entradas, Pizzas, Bebidas..."
              className={cn(
                'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all',
                errors.name ? 'border-destructive/60' : 'border-border/60',
              )}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Cor */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Cor de destaque</label>
            <div className="flex items-center gap-2">
              <input
                {...register('color')}
                type="text"
                placeholder="#FF6B35"
                maxLength={7}
                className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
              />
              <div
                className="h-9 w-9 shrink-0 rounded-lg border border-border/60"
                style={{ background: color || '#718096' }}
              />
            </div>
            {/* Paleta de cores predefinidas */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setValue('color', c)}
                  className={cn(
                    'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                    color === c ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground">Descrição</label>
            <input
              {...register('description')}
              placeholder="Descrição opcional da categoria"
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          {/* Horário disponível */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">
              <Clock className="mr-1 inline h-3 w-3" />Disponível das
            </label>
            <div className="flex items-center gap-2">
              <input type="time" {...register('availableFrom')}
                className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
              <span className="text-xs text-muted-foreground">até</span>
              <input type="time" {...register('availableUntil')}
                className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>

          {/* Dias disponíveis */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">
              <Calendar className="mr-1 inline h-3 w-3" />Dias disponíveis
            </label>
            <div className="flex flex-wrap gap-1">
              {ALL_DAYS.map((day) => (
                <button
                  key={day} type="button"
                  onClick={() => toggleDay(day)}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition-all',
                    selectedDays.includes(day)
                      ? 'bg-primary text-white'
                      : 'border border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ativo toggle */}
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input type="checkbox" {...register('isActive')} className="sr-only peer" />
            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors">
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </div>
          </div>
          <span className="text-sm font-medium">Categoria ativa</span>
        </label>

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-lg border border-border/60 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60">
            <Check className="h-4 w-4" />
            {isEdit ? 'Salvar' : 'Criar categoria'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canEdit     = hasRole('owner', 'admin', 'manager');

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Category | undefined>();
  const [localOrder,setLocalOrder]= useState<Category[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Query
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn : () => apiGet<Category[]>('/products/categories'),
  });

  const ordered = localOrder ?? categories;

  // Mutations
  const { mutate: toggleCat } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPut(`/products/categories/${id}`, { is_active: !isActive }),
    onSuccess: () => {
      toast.success('Status atualizado.');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const { mutate: deleteCat } = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/categories/${id}`),
    onSuccess : () => {
      toast.success('Categoria removida.');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setLocalOrder(null);
    },
    onError: () => toast.error('Não foi possível remover a categoria.'),
  });

  const { mutate: saveOrder, isPending: savingOrder } = useMutation({
    mutationFn: (items: Category[]) =>
      apiPatch('/products/categories/reorder', {
        items: items.map((c, i) => ({ id: c.id, sort_order: i })),
      }),
    onSuccess: () => {
      toast.success('Ordem salva!');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setLocalOrder(null);
    },
    onError: () => toast.error('Erro ao salvar ordem.'),
  });

  const handleReorder = (newOrder: Category[]) => {
    setLocalOrder(newOrder);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditing(undefined);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditing(undefined);
  };

  const handleDelete = (cat: Category) => {
    if (cat.total_product_count > 0) {
      toast.warning(`Esta categoria tem ${cat.total_product_count} produto(s). Os produtos ficarão sem categoria.`);
    }
    if (confirm(`Remover "${cat.name}"?`)) deleteCat(cat.id);
  };

  const hasOrderChanged = localOrder !== null &&
    localOrder.some((c, i) => c.id !== categories[i]?.id);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Categorias</h1>
          <p className="text-sm text-muted-foreground">
            {categories.length} categoria{categories.length !== 1 ? 's' : ''} · Arraste para reordenar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Salvar nova ordem */}
          <AnimatePresence>
            {hasOrderChanged && (
              <motion.button
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onClick={() => saveOrder(localOrder!)}
                disabled={savingOrder}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                <Check className="h-3.5 w-3.5" />
                {savingOrder ? 'Salvando...' : 'Salvar ordem'}
              </motion.button>
            )}
          </AnimatePresence>

          {canEdit && (
            <button
              onClick={handleNew}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm"
            >
              <Plus className="h-4 w-4" />
              Nova Categoria
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      <AnimatePresence>
        {showForm && (
          <div className="-mx-1 rounded-2xl border border-border/60 bg-card shadow-soft">
            <CategoryForm category={editing} onClose={handleClose} />
          </div>
        )}
      </AnimatePresence>

      {/* Lista com drag-and-drop */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
          <Tag className="h-12 w-12 text-muted-foreground/30" strokeWidth={1} />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma categoria criada.</p>
          {canEdit && (
            <button onClick={handleNew} className="mt-2 text-xs text-primary hover:underline">
              Criar primeira categoria
            </button>
          )}
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={ordered}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {ordered.map((cat) => (
            <Reorder.Item
              key={cat.id}
              value={cat}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              className={cn(
                'rounded-xl border border-border/60 bg-card shadow-soft',
                isDragging && 'cursor-grabbing',
              )}
              whileDrag={{ scale: 1.02, shadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 10 }}
            >
              <div className="flex items-center gap-3 p-4">
                {/* Handle de drag */}
                {canEdit && (
                  <div className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground transition-colors active:cursor-grabbing">
                    <GripVertical className="h-5 w-5" />
                  </div>
                )}

                {/* Cor */}
                <div
                  className="h-9 w-1.5 shrink-0 rounded-full"
                  style={{ background: cat.color ?? '#718096' }}
                />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      'text-sm font-semibold',
                      !cat.is_active && 'text-muted-foreground line-through',
                    )}>
                      {cat.name}
                    </p>
                    {!cat.is_active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        Inativa
                      </span>
                    )}
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span>
                      {cat.active_product_count}/{cat.total_product_count} produto{cat.total_product_count !== 1 ? 's' : ''}
                    </span>
                    {cat.available_from && cat.available_until && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {cat.available_from} – {cat.available_until}
                      </span>
                    )}
                    {cat.available_days && cat.available_days.length < 7 && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {cat.available_days.map((d) => DAY_LABELS[d]).join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                {canEdit && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => toggleCat({ id: cat.id, isActive: cat.is_active })}
                      className={cn(
                        'rounded-md p-1.5 transition-colors',
                        cat.is_active
                          ? 'text-emerald-400 hover:bg-emerald-400/10'
                          : 'text-muted-foreground hover:bg-muted',
                      )}
                      title={cat.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {cat.is_active
                        ? <ToggleRight className="h-4 w-4" />
                        : <ToggleLeft className="h-4 w-4" />
                      }
                    </button>
                    <button
                      onClick={() => handleEdit(cat)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {/* Dica */}
      {canEdit && ordered.length > 1 && (
        <p className="text-center text-xs text-muted-foreground/60">
          Arraste os itens para reordenar. A ordem aqui reflete no cardápio público.
        </p>
      )}
    </div>
  );
}
