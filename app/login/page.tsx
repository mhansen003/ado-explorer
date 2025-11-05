'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Focus first OTP input when step changes
  useEffect(() => {
    if (step === 'otp' && otpInputs.current[0]) {
      otpInputs.current[0].focus();
    }
  }, [step]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Construct full email
      const fullEmail = `${username.trim()}@cmgfi.com`;

      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fullEmail }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setStep('otp');
      setCountdown(300); // 5 minutes
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const code = otp.join('');
      const fullEmail = `${username.trim()}@cmgfi.com`;

      if (code.length !== 6) {
        throw new Error('Please enter all 6 digits');
      }

      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fullEmail, code }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Success! Force full page reload to update auth state
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    // Check if pasted data is 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);

      // Focus last input
      otpInputs.current[5]?.focus();

      // Auto-submit if all 6 digits are filled
      setTimeout(() => {
        const form = document.querySelector('form');
        form?.requestSubmit();
      }, 100);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);

    try {
      const fullEmail = `${username.trim()}@cmgfi.com`;

      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fullEmail }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend code');
      }

      setCountdown(300);
      setOtp(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-rh-dark flex items-center justify-center p-4">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-50">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-rh-green rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-rh-green rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-rh-green rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-rh-card border border-rh-border rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm">
          {/* Header */}
          <div className="bg-gradient-to-br from-rh-green/20 to-transparent border-b border-rh-border p-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-rh-green/20 rounded-2xl flex items-center justify-center border border-rh-green/30">
                <span className="text-4xl">🔐</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center text-rh-text mb-2">
              ADO Explorer
            </h1>
            <p className="text-center text-rh-text-secondary text-sm">
              {step === 'email' ? 'Secure Access' : 'Verify Your Identity'}
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Email Step */}
            {step === 'email' && (
              <form onSubmit={handleSendOTP} className="space-y-6">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-rh-text mb-2">
                    CMG Username
                  </label>
                  <div className="relative">
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-3 bg-rh-dark border border-rh-border rounded-xl text-rh-text placeholder-rh-text-secondary focus:outline-none focus:border-rh-green focus:ring-2 focus:ring-rh-green/20 transition-all"
                      placeholder="Enter your username"
                      required
                      autoComplete="username"
                      autoFocus
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-rh-text-secondary text-sm pointer-events-none">
                      @cmgfi.com
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-rh-text-secondary">
                    Only @cmgfi.com email addresses are allowed
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="w-full py-3 px-4 bg-rh-green text-rh-dark font-semibold rounded-xl hover:bg-rh-green/90 focus:outline-none focus:ring-2 focus:ring-rh-green/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>
            )}

            {/* OTP Step */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-sm text-rh-text-secondary mb-2">
                    Enter the 6-digit code sent to
                  </p>
                  <p className="text-rh-text font-medium">
                    {username}@cmgfi.com
                  </p>
                </div>

                <div className="flex justify-center gap-2 mb-4">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpInputs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(index, e)}
                      onPaste={index === 0 ? handleOTPPaste : undefined}
                      className="w-12 h-14 text-center text-2xl font-bold bg-rh-dark border-2 border-rh-border rounded-xl text-rh-text focus:outline-none focus:border-rh-green focus:ring-2 focus:ring-rh-green/20 transition-all"
                    />
                  ))}
                </div>

                {countdown > 0 && (
                  <div className="text-center">
                    <p className="text-sm text-rh-text-secondary">
                      Code expires in{' '}
                      <span className="text-rh-green font-mono font-semibold">
                        {formatTime(countdown)}
                      </span>
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.some((digit) => !digit)}
                  className="w-full py-3 px-4 bg-rh-green text-rh-dark font-semibold rounded-xl hover:bg-rh-green/90 focus:outline-none focus:ring-2 focus:ring-rh-green/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setError('');
                      setOtp(['', '', '', '', '', '']);
                    }}
                    className="text-rh-text-secondary hover:text-rh-text transition-colors"
                  >
                    ← Change Email
                  </button>

                  {countdown === 0 ? (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={loading}
                      className="text-rh-green hover:text-rh-green/80 transition-colors disabled:opacity-50"
                    >
                      Resend Code
                    </button>
                  ) : (
                    <span className="text-rh-text-secondary">
                      Resend available in {formatTime(countdown)}
                    </span>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-rh-dark/50 border-t border-rh-border text-center">
            <p className="text-xs text-rh-text-secondary">
              Protected by email verification
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-rh-card/50 border border-rh-border/50 rounded-xl backdrop-blur-sm">
          <p className="text-xs text-rh-text-secondary text-center">
            🔒 Your session will remain active for 5 days
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
