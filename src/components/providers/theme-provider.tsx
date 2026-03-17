/**
 * @file components/providers/theme-provider.tsx
 * @description Wrapper do next-themes para suporte a dark/light mode.
 *
 * @module providers/theme
 */

'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps }             from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
