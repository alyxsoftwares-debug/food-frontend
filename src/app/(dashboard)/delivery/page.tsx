/**
 * @file app/(dashboard)/delivery/page.tsx
 * @description Configurações de entrega — zonas, horários e métodos de pagamento.
 *
 * @module app/(dashboard)/delivery/page
 */

'use client';

import { useState }                              from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }               from 'framer-motion';
import {
  Bike, Package, UtensilsCrossed, Clock, Plus,
  Trash2, Pencil, Check, X, MapPin, DollarSign,
  CreditCard, Banknote, Smartphone, Save, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { toast }       from 'sonner';
import { useForm }     from 'react-hook-form';
import { apiGet, apiPut, apiPatch, apiPost, apiDelete } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface DeliverySettings {
  is_delivery_enabled     : boolean;
  is_pickup_enabled       : boolean;
  is_table_enabled        : boolean;
  min_order_value         : number;
  base_delivery_fee       : number;
  free_delivery_above     : number | null;
  estimated_delivery_time : number;
  estimated_pickup_time   : number;
  accepted_payments       : string[];
  allow_scheduling        : boolean;
  business_hours          : Record<string, { open: string; close: string; enabled: boolean }>;
}

interface DeliveryZone {
  id           : string;
  name         : string;
  description  : string | null;
  fee          : number;
  min_time     : number | null;
  max_time     : number | null;
  neighborhoods: string[];
  is_active    : boolean;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DAYS = [
  { key: 'monday',    label: 'Segunda' },
  { key: 'tuesday',   label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday',  label: 'Quinta' },
  { key: 'friday',    label: 'Sexta' },
  { key: 'saturday',  label: 'Sábado' },
  { key: 'sunday',    label: 'Domingo' },
];

const DEFAULT_HOURS = {
  open: '10:00', close: '22:00', enabled: true,
};

const PAYMENT_OPTIONS = [
  { value: 'cash',        label: 'Dinheiro',  icon: Banknote },
  { value: 'credit_card', label: 'Crédito',   icon: CreditCard },
  { value: 'debit_card',  label: 'Débito',    icon: CreditCard },
  { value: 'pix',         label: 'PIX',       icon: Smartphone },
  { value: 'voucher',     label: 'Vale',      icon: DollarSign },
  { value: 'online',      label: 'Online',    icon: Smartphone },
];

// ---------------------------------------------------------------------------
// Seção: Toggle de Tipos de Pedido
// ---------------------------------------------------------------------------

function OrderTypesSection({
  settings, onSave,
}: { settings: DeliverySettings; onSave: (data: Partial<DeliverySettings>) => void }) {
  const types = [
    { key: 'is_delivery_enabled', label: 'Delivery',  icon: Bike,            desc: 'Pedidos com entrega no endereço do cliente' },
    { key: 'is_pickup_enabled',   label: 'Retirada',  icon: Package,         desc: 'Cliente retira no estabelecimento' },
    { key: 'is_table_enabled',    label: 'Mesas',     icon: UtensilsCrossed, desc: 'Pedidos feitos na mesa (QR Code / garçom)' },
  ] as const;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Tipos de Pedido</h2>
      {types.map(({ key, label, icon: Icon, desc }) => (
        <label key={key} className="flex cursor-pointer items-center gap-4 rounded-lg border border-border/40 p-3.5 hover:bg-muted/20 transition-colors">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4.5 w-4.5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
          <button
            type="button"
            onClick={() => onSave({ [key]: !settings[key] })}
            className={cn('transition-colors', settings[key] ? 'text-emerald-400' : 'text-muted-foreground')}
          >
            {settings[key] ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
          </button>
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: Configurações Gerais de Entrega
// ---------------------------------------------------------------------------

function GeneralSettingsSection({
  settings, onSave,
}: { settings: DeliverySettings; onSave: (data: Partial<DeliverySettings>) => void }) {
  const { register, handleSubmit, formState: { isDirty, isSubmitting } } = useForm({
    defaultValues: {
      min_order_value        : settings.min_order_value,
      base_delivery_fee      : settings.base_delivery_fee,
      free_delivery_above    : settings.free_delivery_above ?? '',
      estimated_delivery_time: settings.estimated_delivery_time,
      estimated_pickup_time  : settings.estimated_pickup_time,
    },
  });

  const onSubmit = (data: Record<string, unknown>) => {
    onSave({
      min_order_value        : Number(data.min_order_value),
      base_delivery_fee      : Number(data.base_delivery_fee),
      free_delivery_above    : data.free_delivery_above ? Number(data.free_delivery_above) : null,
      estimated_delivery_time: Number(data.estimated_delivery_time),
      estimated_pickup_time  : Number(data.estimated_pickup_time),
    });
  };

  const Field = ({ label, name, prefix = '', suffix = '' }: {
    label: string; name: string; prefix?: string; suffix?: string;
  }) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-xs text-muted-foreground">{prefix}</span>
        )}
        <input
          {...register(name as Parameters<typeof register>[0])}
          type="number" step="0.01" min="0"
          className={cn(
            'h-9 w-full rounded-lg border border-border/60 bg-muted/30 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all',
            prefix ? 'pl-8 pr-3' : 'px-3',
            suffix ? 'pr-10' : '',
          )}
        />
        {suffix && (
          <span className="absolute right-3 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-border/60 bg-card p-5 shadow-soft space-y-4">
      <h2 className="text-sm font-semibold">Valores e Tempos</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pedido mínimo"       name="min_order_value"         prefix="R$" />
        <Field label="Taxa de entrega base" name="base_delivery_fee"      prefix="R$" />
        <Field label="Frete grátis acima de" name="free_delivery_above"   prefix="R$" />
        <Field label="Tempo de entrega"    name="estimated_delivery_time" suffix="min" />
        <Field label="Tempo de retirada"   name="estimated_pickup_time"   suffix="min" />
      </div>
      {isDirty && (
        <button type="submit" disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm disabled:opacity-60">
          <Save className="h-3.5 w-3.5" />
          {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
        </button>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Seção: Horários de Funcionamento
// ---------------------------------------------------------------------------

function BusinessHoursSection({
  settings, onSave,
}: { settings: DeliverySettings; onSave: (data: Partial<DeliverySettings>) => void }) {
  const [hours, setHours] = useState<Record<string, { open: string; close: string; enabled: boolean }>>(
    () => {
      const h: Record<string, { open: string; close: string; enabled: boolean }> = {};
      for (const d of DAYS) {
        h[d.key] = settings.business_hours?.[d.key] ?? { ...DEFAULT_HOURS };
      }
      return h;
    },
  );
  const [dirty, setDirty] = useState(false);

  const update = (day: string, field: string, value: string | boolean) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    setDirty(true);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Horários de Funcionamento</h2>
        {dirty && (
          <button
            onClick={() => { onSave({ business_hours: hours }); setDirty(false); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-all"
          >
            <Save className="h-3.5 w-3.5" />Salvar
          </button>
        )}
      </div>

      <div className="space-y-2">
        {DAYS.map((day) => {
          const h = hours[day.key];
          return (
            <div key={day.key} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
              <button onClick={() => update(day.key, 'enabled', !h.enabled)}
                className={cn('transition-colors shrink-0', h.enabled ? 'text-emerald-400' : 'text-muted-foreground')}>
                {h.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              </button>

              <span className={cn('w-16 text-xs font-medium', !h.enabled && 'text-muted-foreground')}>
                {day.label}
              </span>

              {h.enabled ? (
                <div className="flex flex-1 items-center gap-2">
                  <input type="time" value={h.open}
                    onChange={(e) => update(day.key, 'open', e.target.value)}
                    className="h-7 flex-1 rounded-lg border border-border/60 bg-muted/30 px-2 text-xs outline-none focus:ring-1 focus:ring-primary/50" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input type="time" value={h.close}
                    onChange={(e) => update(day.key, 'close', e.target.value)}
                    className="h-7 flex-1 rounded-lg border border-border/60 bg-muted/30 px-2 text-xs outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
              ) : (
                <span className="flex-1 text-xs text-muted-foreground">Fechado</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: Pagamentos Aceitos
// ---------------------------------------------------------------------------

function PaymentsSection({
  settings, onSave,
}: { settings: DeliverySettings; onSave: (data: Partial<DeliverySettings>) => void }) {
  const [accepted, setAccepted] = useState<string[]>(settings.accepted_payments ?? []);
  const [dirty, setDirty]       = useState(false);

  const toggle = (value: string) => {
    setAccepted((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
    setDirty(true);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Formas de Pagamento</h2>
        {dirty && (
          <button
            onClick={() => { onSave({ accepted_payments: accepted as DeliverySettings['accepted_payments'] }); setDirty(false); }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-all"
          >
            <Save className="h-3.5 w-3.5" />Salvar
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => {
          const on = accepted.includes(value);
          return (
            <button key={value} type="button" onClick={() => toggle(value)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-all',
                on ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border/60 text-muted-foreground hover:border-border',
              )}>
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', on ? 'bg-primary text-white' : 'bg-muted')}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium">{label}</span>
              {on && <Check className="ml-auto h-3 w-3 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: Zonas de Entrega
// ---------------------------------------------------------------------------

function ZonesSection() {
  const queryClient = useQueryClient();
  const [showForm,  setShowForm] = useState(false);
  const [editing,   setEditing]  = useState<DeliveryZone | undefined>();

  const { data: zones = [], isLoading } = useQuery<DeliveryZone[]>({
    queryKey: ['delivery-zones'],
    queryFn : () => apiGet('/delivery/zones'),
  });

  const { mutate: deleteZone } = useMutation({
    mutationFn: (id: string) => apiDelete(`/delivery/zones/${id}`),
    onSuccess : () => { toast.success('Zona removida.'); queryClient.invalidateQueries({ queryKey: ['delivery-zones'] }); },
  });

  const handleEdit  = (z: DeliveryZone) => { setEditing(z); setShowForm(true); };
  const handleClose = () => { setEditing(undefined); setShowForm(false); };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Zonas de Entrega</h2>
          <p className="text-xs text-muted-foreground">Defina bairros ou regiões com taxas diferenciadas</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm">
          <Plus className="h-3.5 w-3.5" />Nova Zona
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <ZoneForm zone={editing} onClose={handleClose} />
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : zones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground/30" strokeWidth={1} />
          <p className="mt-2 text-xs text-muted-foreground">Nenhuma zona cadastrada. Taxa base será usada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{zone.name}</p>
                {zone.neighborhoods.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    {zone.neighborhoods.slice(0, 3).join(', ')}{zone.neighborhoods.length > 3 && ` +${zone.neighborhoods.length - 3}`}
                  </p>
                )}
              </div>
              <span className="font-mono text-sm font-semibold text-primary shrink-0">
                {zone.fee === 0 ? 'Grátis' : formatCurrency(zone.fee)}
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => handleEdit(zone)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => confirm(`Remover "${zone.name}"?`) && deleteZone(zone.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ZoneForm({ zone, onClose }: { zone?: DeliveryZone; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name,   setName]   = useState(zone?.name ?? '');
  const [fee,    setFee]    = useState(String(zone?.fee ?? 0));
  const [hoods,  setHoods]  = useState(zone?.neighborhoods.join(', ') ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error('Nome obrigatório.'); return; }
    setSaving(true);
    try {
      const payload = {
        name, fee: Number(fee),
        neighborhoods: hoods.split(',').map((h) => h.trim()).filter(Boolean),
      };
      if (zone) await apiPut(`/delivery/zones/${zone.id}`, payload);
      else      await apiPost('/delivery/zones', payload);
      toast.success(zone ? 'Zona atualizada!' : 'Zona criada!');
      queryClient.invalidateQueries({ queryKey: ['delivery-zones'] });
      onClose();
    } catch { toast.error('Erro ao salvar zona.'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Nome da zona *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Centro, Zona Sul..."
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Taxa de entrega (R$)</label>
            <input value={fee} onChange={(e) => setFee(e.target.value)} type="number" min="0" step="0.50"
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground">Bairros (separados por vírgula)</label>
            <input value={hoods} onChange={(e) => setHoods(e.target.value)} placeholder="Ex: Tirol, Petrópolis, Candelária..."
              className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-all disabled:opacity-60">
            <Check className="h-3.5 w-3.5" />{saving ? 'Salvando...' : zone ? 'Salvar' : 'Criar zona'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function DeliveryPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<DeliverySettings>({
    queryKey: ['delivery-settings'],
    queryFn : () => apiGet('/delivery/settings'),
  });

  const { mutate: updateSettings } = useMutation({
    mutationFn: (data: Partial<DeliverySettings>) => apiPut('/delivery/settings', data),
    onSuccess : () => {
      toast.success('Configurações salvas!');
      queryClient.invalidateQueries({ queryKey: ['delivery-settings'] });
    },
    onError: () => toast.error('Erro ao salvar configurações.'),
  });

  const { mutate: updateHours } = useMutation({
    mutationFn: (businessHours: Record<string, unknown>) =>
      apiPatch('/delivery/hours', { businessHours }),
    onSuccess: () => {
      toast.success('Horários salvos!');
      queryClient.invalidateQueries({ queryKey: ['delivery-settings'] });
    },
  });

  if (isLoading || !settings) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Configurações de Entrega</h1>
        <p className="text-sm text-muted-foreground">Gerencie horários, taxas e formas de pagamento</p>
      </div>

      <OrderTypesSection   settings={settings} onSave={(d) => updateSettings(d)} />
      <GeneralSettingsSection settings={settings} onSave={(d) => updateSettings(d)} />
      <BusinessHoursSection settings={settings} onSave={(d) => updateHours(d.business_hours as Record<string, unknown>)} />
      <PaymentsSection     settings={settings} onSave={(d) => updateSettings(d)} />
      <ZonesSection />
    </div>
  );
}
