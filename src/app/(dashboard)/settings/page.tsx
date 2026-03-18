/**
 * @file app/(dashboard)/settings/page.tsx
 * @description Configurações da empresa — informações, personalização e integrações.
 *
 * @module app/(dashboard)/settings/page
 */

'use client';

import { useState, useRef }                      from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion }                                from 'framer-motion';
import Image                                     from 'next/image';
import {
  Save, Upload, Building2, Palette, Smartphone,
  Globe, Bell, QrCode, Copy, Check, ExternalLink, Loader2,
} from 'lucide-react';
import { toast }       from 'sonner';
import { useForm }     from 'react-hook-form';
import { api, apiGet } from '@/lib/api';
import { useAuth }     from '@/hooks/use-auth';
import { cn }          from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface CompanyData {
  id                : string;
  slug              : string;
  name              : string;
  legal_name        : string | null;
  document          : string | null;
  email             : string;
  phone             : string | null;
  whatsapp          : string | null;
  logo_url          : string | null;
  cover_url         : string | null;
  description       : string | null;
  address_street    : string | null;
  address_number    : string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city      : string | null;
  address_state     : string | null;
  address_zip       : string | null;
  primary_color     : string;
  secondary_color   : string;
  timezone          : string;
}

interface CompanySettings {
  pix_key             : string | null;
  pix_key_type        : string | null;
  whatsapp_enabled    : boolean;
  whatsapp_api_key    : string | null;
  notify_new_order_sound: boolean;
  notify_new_order_email: boolean;
  notify_email_address : string | null;
  google_analytics_id  : string | null;
  facebook_pixel_id    : string | null;
  custom_domain        : string | null;
  welcome_message      : string | null;
}

// ---------------------------------------------------------------------------
// Seção genérica com formulário
// ---------------------------------------------------------------------------

function SettingsSection({ title, icon: Icon, children, onSave, isDirty, isSaving }: {
  title    : string;
  icon     : React.ElementType;
  children : React.ReactNode;
  onSave?  : () => void;
  isDirty? : boolean;
  isSaving?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-soft overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {onSave && isDirty && (
          <button
            type="button" onClick={onSave} disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campo de formulário reutilizável
// ---------------------------------------------------------------------------

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputClass = 'h-9 w-full rounded-lg border border-border/60 bg-muted/30 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground';

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const queryClient      = useQueryClient();
  const { updateCompany } = useAuth();
  const logoRef          = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Queries
  const { data: company, isLoading: loadingCompany } = useQuery<CompanyData>({
    queryKey: ['company-me'],
    queryFn : () => apiGet('/companies/me'),
  });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['company-settings'],
    queryFn : () => apiGet('/companies/me/settings'),
  });

  // Formulário — informações gerais
  const companyForm = useForm({
    values: company ? {
      name              : company.name,
      legal_name        : company.legal_name ?? '',
      document          : company.document ?? '',
      email             : company.email,
      phone             : company.phone ?? '',
      whatsapp          : company.whatsapp ?? '',
      description       : company.description ?? '',
      address_street    : company.address_street ?? '',
      address_number    : company.address_number ?? '',
      address_complement: company.address_complement ?? '',
      address_neighborhood: company.address_neighborhood ?? '',
      address_city      : company.address_city ?? '',
      address_state     : company.address_state ?? '',
      address_zip       : company.address_zip ?? '',
      primary_color     : company.primary_color ?? '#FF6B35',
      secondary_color   : company.secondary_color ?? '#2D3748',
    } : undefined,
  });

  // Formulário — integrações / PIX
  const settingsForm = useForm({
    values: settings ? {
      pix_key          : settings.pix_key ?? '',
      pix_key_type     : settings.pix_key_type ?? 'pix',
      whatsapp_api_key : settings.whatsapp_api_key ?? '',
      google_analytics_id: settings.google_analytics_id ?? '',
      facebook_pixel_id: settings.facebook_pixel_id ?? '',
      custom_domain    : settings.custom_domain ?? '',
      welcome_message  : settings.welcome_message ?? '',
      notify_email_address: settings.notify_email_address ?? '',
    } : undefined,
  });

  // Mutations
  const { mutate: saveCompany, isPending: savingCompany } = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put('/companies/me', data),
    onSuccess : (_, data) => {
      toast.success('Informações salvas!');
      queryClient.invalidateQueries({ queryKey: ['company-me'] });
      if (data.name) updateCompany({ name: data.name as string });
    },
    onError: () => toast.error('Erro ao salvar.'),
  });

  const { mutate: saveSettings, isPending: savingSettings } = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put('/companies/me/settings', data),
    onSuccess : () => {
      toast.success('Configurações salvas!');
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    },
    onError: () => toast.error('Erro ao salvar.'),
  });

  // Upload de logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo muito grande. Máximo 2MB.'); return; }
    const fd = new FormData();
    fd.append('logo', file);
    setUploadingLogo(true);
    try {
      await api.post('/companies/me/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Logo atualizada!');
      queryClient.invalidateQueries({ queryKey: ['company-me'] });
    } catch { toast.error('Erro ao fazer upload.'); }
    finally { setUploadingLogo(false); }
  };

  const copySlugUrl = () => {
    if (!company) return;
    const url = `${window.location.origin}/menu/${company.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copiado!');
  };

  if (loadingCompany) {
    return (
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-64 rounded-xl" />)}
      </div>
    );
  }

  const menuUrl = typeof window !== 'undefined' ? `${window.location.origin}/menu/${company?.slug}` : `/menu/${company?.slug}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie as informações e preferências do seu estabelecimento</p>
      </div>

      {/* Link do Cardápio */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <QrCode className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-primary">Seu cardápio digital</p>
          <p className="truncate text-xs text-muted-foreground">{menuUrl}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={copySlugUrl}
            className="flex items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <a href={menuUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />Abrir
          </a>
        </div>
      </div>

      {/* Logo + Capa */}
      <SettingsSection title="Identidade Visual" icon={Palette}>
        <div className="flex items-center gap-5">
          {/* Logo */}
          <div className="relative">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border border-border bg-muted">
              {company?.logo_url ? (
                <Image src={company.logo_url} alt="Logo" fill className="object-cover" sizes="80px" />
              ) : (
                <div className="flex h-full items-center justify-center bg-primary/10">
                  <Building2 className="h-8 w-8 text-primary/40" />
                </div>
              )}
            </div>
            <button
              onClick={() => logoRef.current?.click()}
              disabled={uploadingLogo}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-soft transition-colors disabled:opacity-60"
            >
              {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </button>
            <input ref={logoRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
          </div>
          <div>
            <p className="text-sm font-medium">{company?.name}</p>
            <p className="text-xs text-muted-foreground">{company?.slug}</p>
            <button onClick={() => logoRef.current?.click()}
              className="mt-2 text-xs text-primary hover:underline">
              Alterar logo
            </button>
          </div>
        </div>

        {/* Cores */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cor primária" hint="Usada em botões e destaques no cardápio">
            <div className="flex items-center gap-2">
              <input type="color" {...companyForm.register('primary_color')}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border/60 bg-muted/30 p-0.5" />
              <input {...companyForm.register('primary_color')} placeholder="#FF6B35"
                className={inputClass} />
            </div>
          </Field>
          <Field label="Cor secundária">
            <div className="flex items-center gap-2">
              <input type="color" {...companyForm.register('secondary_color')}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border/60 bg-muted/30 p-0.5" />
              <input {...companyForm.register('secondary_color')} placeholder="#2D3748"
                className={inputClass} />
            </div>
          </Field>
        </div>

        <button
          onClick={() => saveCompany(companyForm.getValues())}
          disabled={savingCompany}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-all disabled:opacity-60"
        >
          {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar cores
        </button>
      </SettingsSection>

      {/* Informações gerais */}
      <SettingsSection title="Informações do Estabelecimento" icon={Building2}
        onSave={() => saveCompany(companyForm.getValues())}
        isDirty={companyForm.formState.isDirty}
        isSaving={savingCompany}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome fantasia *">
            <input {...companyForm.register('name')} className={inputClass} />
          </Field>
          <Field label="Razão social">
            <input {...companyForm.register('legal_name')} className={inputClass} />
          </Field>
          <Field label="CNPJ / CPF">
            <input {...companyForm.register('document')} placeholder="00.000.000/0001-00" className={inputClass} />
          </Field>
          <Field label="E-mail *">
            <input {...companyForm.register('email')} type="email" className={inputClass} />
          </Field>
          <Field label="Telefone">
            <input {...companyForm.register('phone')} placeholder="(84) 99999-0000" className={inputClass} />
          </Field>
          <Field label="WhatsApp">
            <input {...companyForm.register('whatsapp')} placeholder="5584999990000" className={inputClass} />
          </Field>
        </div>

        <Field label="Descrição do estabelecimento">
          <textarea {...companyForm.register('description')} rows={3} placeholder="Conte um pouco sobre o seu restaurante..."
            className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
        </Field>

        <p className="text-xs font-semibold text-muted-foreground pt-2">Endereço</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Rua" ><input {...companyForm.register('address_street')} className={cn(inputClass, 'sm:col-span-2')} /></Field>
          <Field label="Número"><input {...companyForm.register('address_number')} className={inputClass} /></Field>
          <Field label="Complemento"><input {...companyForm.register('address_complement')} className={inputClass} /></Field>
          <Field label="Bairro"  ><input {...companyForm.register('address_neighborhood')} className={inputClass} /></Field>
          <Field label="Cidade"  ><input {...companyForm.register('address_city')} className={inputClass} /></Field>
          <Field label="Estado"  ><input {...companyForm.register('address_state')} maxLength={2} className={inputClass} /></Field>
          <Field label="CEP"     ><input {...companyForm.register('address_zip')} placeholder="00000-000" className={inputClass} /></Field>
        </div>
      </SettingsSection>

      {/* PIX + Integrações */}
      <SettingsSection title="Pagamentos & Integrações" icon={Smartphone}
        onSave={() => saveSettings(settingsForm.getValues())}
        isDirty={settingsForm.formState.isDirty}
        isSaving={savingSettings}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chave PIX" hint="CPF, CNPJ, e-mail, telefone ou chave aleatória">
            <input {...settingsForm.register('pix_key')} placeholder="sua@chave.pix" className={inputClass} />
          </Field>
          <Field label="Tipo da chave PIX">
            <select {...settingsForm.register('pix_key_type')} className={cn(inputClass, 'appearance-none')}>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Chave aleatória</option>
            </select>
          </Field>
          <Field label="API Key do WhatsApp (Evolution/Z-API)"
            hint="Deixe em branco se não usar integração WhatsApp">
            <input {...settingsForm.register('whatsapp_api_key')} type="password"
              placeholder="••••••••••••••••" className={inputClass} />
          </Field>
          <Field label="Google Analytics ID">
            <input {...settingsForm.register('google_analytics_id')} placeholder="G-XXXXXXXXXX" className={inputClass} />
          </Field>
          <Field label="Facebook Pixel ID">
            <input {...settingsForm.register('facebook_pixel_id')} placeholder="000000000000000" className={inputClass} />
          </Field>
          <Field label="Domínio customizado do cardápio" hint="Ex: cardapio.meurestaurante.com.br">
            <input {...settingsForm.register('custom_domain')} placeholder="cardapio.meurestaurante.com.br" className={inputClass} />
          </Field>
        </div>
        <Field label="Mensagem de boas-vindas no cardápio">
          <textarea {...settingsForm.register('welcome_message')} rows={2}
            placeholder="Ex: Seja bem-vindo! Obrigado por escolher nosso restaurante."
            className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
        </Field>
      </SettingsSection>

      {/* Notificações */}
      <SettingsSection title="Notificações" icon={Bell}>
        <div className="space-y-3">
          {[
            { key: 'notify_new_order_sound', label: 'Som ao receber novo pedido', desc: 'Toque sonoro no painel quando chegar pedido' },
            { key: 'notify_new_order_email', label: 'Notificação por e-mail',      desc: 'Receba um e-mail para cada novo pedido' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex cursor-pointer items-center gap-4 rounded-lg border border-border/40 p-3.5">
              <div className="flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <input
                type="checkbox"
                defaultChecked={(settings as Record<string, boolean>)?.[key]}
                onChange={(e) => saveSettings({ [key]: e.target.checked })}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
            </label>
          ))}
        </div>

        <Field label="E-mail para notificações">
          <input {...settingsForm.register('notify_email_address')} type="email"
            placeholder="notificacoes@meurestaurante.com.br" className={inputClass} />
        </Field>
      </SettingsSection>

      {/* Link externo para o cardápio */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Cardápio Digital</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Compartilhe o link abaixo nas redes sociais ou imprima os QR Codes das mesas
            </p>
          </div>
          <a href={`/dashboard/tables`}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <QrCode className="h-3.5 w-3.5" />Ver QR Codes
          </a>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-xs text-muted-foreground font-mono">{menuUrl}</span>
          <button onClick={copySlugUrl}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
    </div>
  );
}
