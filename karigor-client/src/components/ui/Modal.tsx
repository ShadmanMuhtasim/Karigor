import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  backdropClassName?: string;
  containerClassName?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

let activeModalsCount = 0;
let originalBodyOverflow = '';

function lockBodyScroll() {
  if (activeModalsCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  activeModalsCount++;
}

function unlockBodyScroll() {
  activeModalsCount = Math.max(0, activeModalsCount - 1);
  if (activeModalsCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
  }
}

export function Modal({
  isOpen,
  onClose,
  children,
  backdropClassName = 'bg-black/70 backdrop-blur-sm',
  containerClassName = '',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    lockBodyScroll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unlockBodyScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 ${backdropClassName} animate-in fade-in duration-200 ${containerClassName}`}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      {children}
    </div>,
    document.body
  );
}
