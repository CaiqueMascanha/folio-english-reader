import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn('min-w-0 outline-none disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}
