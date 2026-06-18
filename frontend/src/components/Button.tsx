import React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', isLoading = false, className = '', disabled, ...props }, ref) => {
    
    let variantClass = 'btn-primary';
    if (variant === 'secondary') variantClass = 'btn-secondary';
    // Add danger if needed, fallback to primary for now
    
    return (
      <button 
        ref={ref}
        className={`btn ${variantClass} ${className}`}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && <Loader2 className="animate-spin" size={16} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
