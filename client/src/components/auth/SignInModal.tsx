'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/Icons';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape & focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus email input
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    // Client-side validation
    if (!email || !email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    // Simulate API processing with honest response
    setTimeout(() => {
      setIsSubmitting(false);
      // Since live backend authentication endpoint is in migration/integration phase:
      setNoticeMessage(
        'FlyWithSafe Member Portal integration is currently in scheduled maintenance. For immediate booking assistance or account inquiries, please reach our 24/7 desk.'
      );
    }, 800);
  };

  const handleGoogleSignIn = () => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (googleClientId) {
      // In production OAuth flow, redirect to Google OAuth URL
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        googleClientId
      )}&redirect_uri=${encodeURIComponent(
        window.location.origin
      )}/api/auth/callback/google&response_type=code&scope=openid%20email%20profile`;
    } else {
      setNoticeMessage(
        'Google OAuth client credentials are not configured in environment variables. Please continue with agency support or email login.'
      );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Modal Container - rounded-xs */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            className="relative w-full max-w-[880px] sm:max-w-[920px] bg-white rounded-xs shadow-[0_25px_60px_rgba(0,0,0,0.25)] overflow-hidden z-10 grid grid-cols-1 md:grid-cols-12 max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Panel: Welcome and Benefits (Dark surface) */}
            <div className="md:col-span-5 bg-[#0B1528] text-white p-7 sm:p-9 flex flex-col justify-between relative overflow-hidden">
              {/* Subtle Ambient Decorative Gradient */}
              <div
                className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-[#8B1D24]/30 via-transparent to-transparent rounded-xs blur-2xl pointer-events-none"
                aria-hidden="true"
              />

              {/* Brand Header */}
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-8">
                  <div className="w-8 h-8 rounded-xs bg-[#8B1D24] flex items-center justify-center text-white shadow-xs">
                    <Icon name="plane" size={17} className="transform -rotate-45" />
                  </div>
                  <span className="tracking-tight font-black text-white text-xl">
                    FlyWith<span className="text-[#8B1D24]">Safe</span>
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2 tracking-tight">
                  Welcome back.
                </h3>
                <h4 className="text-xl sm:text-2xl font-bold text-red-300 leading-tight mb-4">
                  Where to next?
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Sign in to manage your bookings, saved travellers, and seamless flight updates.
                </p>

                {/* Benefits List */}
                <div className="mt-8 space-y-4">
                  {[
                    'Flights, Hotels, Holidays & Visas in One Place.',
                    'An easier checkout experience.',
                    'Convenient access to bookings and traveller details.',
                  ].map((benefit, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-xs bg-red-900/60 border border-red-500/40 text-red-300 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <Icon name="check" size={12} />
                      </div>
                      <span className="text-xs text-slate-200 font-medium leading-snug">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Desk note */}
              <div className="relative z-10 pt-6 mt-6 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Need immediate support? Contact our </span>
                <Link
                  href="/contact"
                  onClick={onClose}
                  className="text-red-300 hover:text-white underline font-semibold"
                >
                  24/7 Human Desk
                </Link>
                .
              </div>
            </div>

            {/* Right Panel: Sign In Form (Clean White Surface) */}
            <div className="md:col-span-7 p-7 sm:p-9 bg-white text-neutral-900 flex flex-col justify-between relative overflow-y-auto max-h-[85vh] md:max-h-none">
              {/* Close Button - rounded-xs */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 p-2 rounded-xs text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#8B1D24]"
                aria-label="Close dialog"
              >
                <Icon name="x" size={19} />
              </button>

              <div>
                <h2
                  id="signin-modal-title"
                  className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight"
                >
                  Sign In
                </h2>
                <p className="text-xs text-neutral-500 mt-1 mb-6">
                  Welcome back. Enter your details to continue.
                </p>

                {/* Google Sign In Button - rounded-xs */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xs border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50/80 text-xs sm:text-sm font-bold text-neutral-700 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8B1D24]"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className="h-[1px] bg-neutral-200 flex-1" />
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    or continue with email
                  </span>
                  <div className="h-[1px] bg-neutral-200 flex-1" />
                </div>

                {/* Feedback notices */}
                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xs bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <Icon name="alertCircle" size={15} className="shrink-0 text-red-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {noticeMessage && (
                  <div className="mb-4 p-3 rounded-xs bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <Icon name="info" size={15} className="shrink-0 text-amber-700" />
                    <span>{noticeMessage}</span>
                  </div>
                )}

                {/* Sign In Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="signin-email"
                      className="block text-xs font-bold text-neutral-700 mb-1"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        ref={emailInputRef}
                        id="signin-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xs border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#8B1D24] focus:border-[#8B1D24] text-neutral-900 placeholder-neutral-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="signin-password"
                        className="block text-xs font-bold text-neutral-700"
                      >
                        Password
                      </label>
                      <Link
                        href="/contact"
                        onClick={onClose}
                        className="text-xs font-semibold text-[#8B1D24] hover:underline"
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xs border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#8B1D24] focus:border-[#8B1D24] text-neutral-900 placeholder-neutral-400 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Keep Me Signed In */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="keep-signed-in"
                      type="checkbox"
                      checked={keepSignedIn}
                      onChange={(e) => setKeepSignedIn(e.target.checked)}
                      className="w-4 h-4 rounded-xs border-neutral-300 text-[#8B1D24] focus:ring-[#8B1D24]"
                    />
                    <label
                      htmlFor="keep-signed-in"
                      className="text-xs font-medium text-neutral-600 select-none cursor-pointer"
                    >
                      Keep Me Signed In
                    </label>
                  </div>

                  {/* Submit Button - rounded-xs */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-6 rounded-xs bg-[#8B1D24] hover:bg-[#74181E] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-xs animate-spin" />
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>
              </div>

              {/* Account Creation Prompt */}
              <div className="pt-6 mt-6 border-t border-neutral-100 text-center text-xs text-neutral-500">
                <span>New to FlyWithSafe? </span>
                <Link
                  href="/contact"
                  onClick={onClose}
                  className="font-bold text-[#8B1D24] hover:underline"
                >
                  Create an Account
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
