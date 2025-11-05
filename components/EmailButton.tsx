/**
 * EmailButton Component
 * Button to send email reports with loading and success states
 */

'use client';

import { useState } from 'react';

interface EmailButtonProps {
  onClick: () => Promise<void>;
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function EmailButton({
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
}: EmailButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setError(false);
      setSuccess(false);

      await onClick();

      setSuccess(true);

      // Reset success state after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Email button error:', err);
      setError(true);

      // Reset error state after 3 seconds
      setTimeout(() => {
        setError(false);
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  // Variant classes
  const variantClasses = {
    primary: 'bg-rh-green hover:bg-rh-green/90 text-white',
    secondary: 'bg-rh-card hover:bg-rh-card/80 text-rh-green border border-rh-border',
    icon: 'bg-transparent hover:bg-rh-card/50 text-rh-green p-2',
  };

  // State-specific classes
  const stateClass = success
    ? 'bg-green-600 hover:bg-green-600'
    : error
    ? 'bg-red-600 hover:bg-red-600'
    : '';

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        ${variant === 'icon' ? '' : sizeClasses[size]}
        ${stateClass || variantClasses[variant]}
        rounded-lg font-medium
        transition-all duration-200
        flex items-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title="Email me this report"
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {variant !== 'icon' && <span>Sending...</span>}
        </>
      ) : success ? (
        <>
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          {variant !== 'icon' && <span>Sent!</span>}
        </>
      ) : error ? (
        <>
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {variant !== 'icon' && <span>Failed</span>}
        </>
      ) : (
        <>
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          {variant !== 'icon' && <span>Email Me</span>}
        </>
      )}
    </button>
  );
}
