import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-full border text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/20 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-slate-950 bg-slate-950 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:bg-slate-800',
        outline:
          'border-slate-300 bg-white/80 text-slate-900 backdrop-blur hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white',
        ghost:
          'border-transparent bg-transparent text-slate-700 hover:bg-slate-950/5',
        destructive:
          'border-rose-600 bg-rose-600 text-white shadow-[0_16px_40px_rgba(225,29,72,0.18)] hover:-translate-y-0.5 hover:bg-rose-500',
      },
      size: {
        sm: 'h-9 px-4 text-xs',
        md: 'h-11 px-5',
        lg: 'h-14 px-7 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
