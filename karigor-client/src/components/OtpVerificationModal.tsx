import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './ui/Modal';
import { CloseIcon, KeyIcon, WrenchIcon, CheckIcon } from './icons/Icons';

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number;
  customerName?: string;
  categoryName?: string;
  onVerify: (code: string) => Promise<void> | void;
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  customerName,
  categoryName,
  onVerify,
}) => {
  const { t } = useTranslation();
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isSubmittingRef = useRef(false);

  // Auto-focus first input and reset state when opened
  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', '']);
      setStatus('idle');
      setInlineError(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp.join('');
    if (code.length !== 6 || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setInlineError(null);
    setStatus('idle');

    try {
      await onVerify(code);

      // SUCCESS: green border/background with scale pulse, then close
      setStatus('success');
      setTimeout(() => {
        onClose();
        setStatus('idle');
        setOtp(['', '', '', '', '', '']);
      }, 650);
    } catch {
      // FAILURE: red border/background with horizontal shake animation, clear inputs, refocus first box
      setStatus('error');
      setInlineError(t('otp.errorMessage', 'Incorrect code. Please try again.'));

      setTimeout(() => {
        setOtp(['', '', '', '', '', '']);
        setStatus('idle');
        inputRefs.current[0]?.focus();
      }, 450);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const digit = val.replace(/\D/g, '').slice(-1);

    if (!digit) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setInlineError(null);

    // Trigger nod/pulse on this specific box
    setAnimatingIndex(index);
    setTimeout(() => {
      setAnimatingIndex((curr) => (curr === index ? null : curr));
    }, 160);

    // Auto-advance focus to next box
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits are filled
    const fullCode = newOtp.join('');
    if (fullCode.length === 6) {
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
        setInlineError(null);
      } else if (index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
        setInlineError(null);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const fullCode = otp.join('');
      if (fullCode.length === 6 && !isSubmitting) {
        handleVerify(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = digits[i] || '';
    }
    setOtp(newOtp);
    setInlineError(null);

    // Trigger brief pulse animation across boxes
    setAnimatingIndex(-1);
    setTimeout(() => setAnimatingIndex(null), 160);

    // Focus appropriate input
    const nextIndex = Math.min(digits.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (digits.length === 6) {
      handleVerify(digits);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      ariaLabelledBy="otp-modal-title"
      backdropClassName="bg-black/70 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-[360px] sm:max-w-[400px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 animate-modal-pop relative"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer disabled:opacity-50"
          aria-label={t('common.close', 'Close')}
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800 flex items-center justify-center mx-auto shadow-xs text-sky-600 dark:text-sky-400">
            <KeyIcon className="w-6 h-6 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h3 id="otp-modal-title" className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
              {t('otp.title', 'Check-In Verification')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
              {t('otp.subtitle', { name: customerName || 'the customer', defaultValue: 'Enter the 6-digit start code provided by customer to verify arrival and start the job.' })}
            </p>
          </div>
          {(categoryName || bookingId) && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1">
                <WrenchIcon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                {t('otp.bookingTag', { id: bookingId, defaultValue: `Booking #${bookingId}` })}
              </span>
              {categoryName && <span>• {categoryName}</span>}
            </div>
          )}
        </div>

        {/* 6-Digit Inputs Row */}
        <div className="space-y-3">
          <div
            className={`flex justify-center items-center gap-1.5 sm:gap-2.5 ${
              status === 'error' ? 'animate-shake' : ''
            }`}
          >
            {otp.map((digit, index) => {
              const isPulsing = animatingIndex === index || (animatingIndex === -1 && !!digit);

              return (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  disabled={isSubmitting || status === 'success'}
                  onChange={(e) => handleChange(index, e)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  aria-label={`Digit ${index + 1}`}
                  className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black rounded-2xl border-2 transition-all duration-150 outline-none select-none
                    ${
                      status === 'error'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                        : status === 'success'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 animate-success-pulse'
                        : digit
                        ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20 text-gray-900 dark:text-white shadow-xs'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 text-gray-900 dark:text-white focus:border-sky-500 focus:bg-white dark:focus:bg-gray-800 focus:ring-4 focus:ring-sky-500/10'
                    }
                    ${isPulsing ? 'animate-digit-nod border-sky-500' : ''}
                  `}
                />
              );
            })}
          </div>

          {/* Inline Feedback / Error Message */}
          <div className="min-h-[22px] flex items-center justify-center">
            {inlineError ? (
              <div className="text-center text-xs font-semibold text-rose-600 dark:text-rose-400 animate-fade-in flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>{inlineError}</span>
              </div>
            ) : status === 'success' ? (
              <div className="text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in flex items-center justify-center gap-1.5">
                <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('otp.successMessage', 'Code verified! Starting job…')}</span>
              </div>
            ) : (
              <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
                {t('otp.hint', 'Ask the customer for the code shown in their booking view.')}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 btn-press cursor-pointer disabled:opacity-50 transition"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={() => handleVerify()}
            disabled={otp.join('').length !== 6 || isSubmitting || status === 'success'}
            className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-sky-500/20 disabled:opacity-50 btn-press cursor-pointer flex items-center justify-center gap-1.5 transition"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('otp.verifying', 'Verifying...')}</span>
              </>
            ) : (
              <span>{t('otp.verifyButton', 'Verify & Start Job')}</span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
