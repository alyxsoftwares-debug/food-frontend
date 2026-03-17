/**
 * @file lib/utils.ts
 * @description Utilitários compartilhados do frontend.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge }               from 'tailwind-merge';

/**
 * Mescla classes Tailwind sem conflitos.
 * Combina clsx (condicionais) + tailwind-merge (resolução de conflitos).
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formata valor monetário em BRL.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style   : 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata data/hora de forma relativa (ex: "há 5 minutos").
 */
export function formatRelative(date: string | Date): string {
  const d   = typeof date === 'string' ? new Date(date) : date;
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60)   return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400)return `há ${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata data completa em pt-BR.
 */
export function formatDate(date: string | Date, withTime = false): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    day  : '2-digit',
    month: '2-digit',
    year : 'numeric',
    ...(withTime && { hour: '2-digit', minute: '2-digit' }),
  });
}

/**
 * Trunca texto com reticências.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Retorna as iniciais de um nome (máx. 2 letras).
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

/**
 * Gera um número de pedido formatado.
 */
export function formatOrderNumber(seq: number): string {
  return `#${String(seq).padStart(4, '0')}`;
}

/** Mapeia status de pedido para label em português. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending   : 'Pendente',
  confirmed : 'Confirmado',
  preparing : 'Preparando',
  ready     : 'Pronto',
  dispatched: 'Em entrega',
  delivered : 'Entregue',
  cancelled : 'Cancelado',
  rejected  : 'Rejeitado',
};

/** Mapeia status de pedido para cor Tailwind. */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending   : 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  confirmed : 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  preparing : 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  ready     : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  dispatched: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  delivered : 'text-green-400 bg-green-400/10 border-green-400/20',
  cancelled : 'text-red-400 bg-red-400/10 border-red-400/20',
  rejected  : 'text-slate-400 bg-slate-400/10 border-slate-400/20',
};

export const TABLE_STATUS_LABELS: Record<string, string> = {
  available  : 'Disponível',
  occupied   : 'Ocupada',
  reserved   : 'Reservada',
  maintenance: 'Manutenção',
};
