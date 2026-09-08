import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons/Icons';
import { cn } from '../lib/utils';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
  showPasswordAriaLabel?: string;
  hidePasswordAriaLabel?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className = '',
      wrapperClassName = '',
      showPasswordAriaLabel = 'Show password',
      hidePasswordAriaLabel = 'Hide password',
      style,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className={cn('relative flex items-center w-full', wrapperClassName)}>
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={cn('w-full !pr-11', className)}
          style={{ paddingRight: '2.75rem', ...style }}
          {...props}
        />
        <button
          type="button"
          tabIndex={0}
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-md cursor-pointer select-none flex items-center justify-center z-10"
          aria-label={showPassword ? hidePasswordAriaLabel : showPasswordAriaLabel}
          title={showPassword ? hidePasswordAriaLabel : showPasswordAriaLabel}
        >
          {showPassword ? (
            <EyeOffIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          ) : (
            <EyeIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
