import React, { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { HelpCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  tooltip?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, tooltip, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <label htmlFor={inputId} className="form-label" style={{ marginBottom: 0 }}>
            {label}
          </label>
          {tooltip && (
            <span className="has-tooltip" style={{ color: 'var(--text-tertiary)', cursor: 'help' }}>
              <HelpCircle size={14} />
              <span className="tooltip">{tooltip}</span>
            </span>
          )}
        </div>
        <input
          ref={ref}
          id={inputId}
          className={`form-input ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <span id={`${inputId}-error`} className="text-sm" style={{ color: 'var(--status-error)' }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
