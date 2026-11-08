'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, IconName } from '@/components/ui/Icons';
import { SignInModal } from '@/components/auth/SignInModal';
import { useAuth } from '@/components/auth/AuthProvider';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  matchPrefix?: string;
}

const primaryNavItems: NavItem[] = [
  { id: 'flight', label: 'Flight', href: '/', icon: 'plane', matchPrefix: '/flights' },
  { id: 'visa', label: 'Visa', href: '/visa-info', icon: 'fileText', matchPrefix: '/visa-info' },
  { id: 'hotel', label: 'Hotel', href: '/hotels', icon: 'hotel', matchPrefix: '/hotels' },
  {
    id: 'holiday',
    label: 'Holiday',
    href: '/packages',
    icon: 'palmtree',
    matchPrefix: '/packages',
  },
];

const secondaryNavItems = [
  { label: 'Track Booking', href: '/track-booking', icon: 'ticket' as IconName },
  { label: 'Contact Support', href: '/contact', icon: 'phone' as IconName },
  { label: 'Privacy Policy', href: '/privacy', icon: 'shield' as IconName },
  { label: 'Terms of Use', href: '/terms', icon: 'fileText' as IconName },
];

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  // Close 'More' dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isItemActive = (item: NavItem) => {
    if (item.id === 'flight') {
      return pathname === '/' || pathname.startsWith('/flights');
    }
    return item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.href;
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
      role="banner"
    >
      <nav className="max-w-11/12 mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-17.5 items-center justify-between">
          {/* Left: Brand Identity */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-xs py-1 px-1 transition-opacity hover:opacity-90"
              aria-label="FlyWithSafety Home"
            >
              <div className="w-8 h-8 rounded-xs bg-brand-red flex items-center justify-center text-white shadow-xs">
                <Icon name="plane" size={18} className="transform -rotate-45" />
              </div>
              <span className="tracking-tight font-black text-neutral-900 text-xl sm:text-2xl">
                FlyWith<span className="text-brand-red">Safety</span>
              </span>
            </Link>
          </div>

          {/* Center: Primary Navigation */}
          <div className="hidden lg:flex items-center gap-1 lg:gap-3">
            {primaryNavItems.map((item) => {
              const active = isItemActive(item);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors duration-150 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${
                    active
                      ? 'text-brand-red'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    name={item.icon}
                    size={17}
                    className={`transition-colors ${
                      active ? 'text-brand-red' : 'text-neutral-500'
                    }`}
                  />
                  <span>{item.label}</span>
                  {active && (
                    <span
                      className="absolute -bottom-3.75 left-2 right-2 h-[2.5px] bg-brand-red rounded-xs"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}

            {/* More Dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red cursor-pointer ${
                  isMoreOpen
                    ? 'text-neutral-900 bg-neutral-100/80'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
                aria-expanded={isMoreOpen}
                aria-haspopup="true"
                aria-label="More navigation options"
              >
                <Icon name="more" size={16} className="text-neutral-500" />
                <span>More</span>
                <Icon
                  name="chevronDown"
                  size={14}
                  className={`text-neutral-400 transition-transform duration-150 ${
                    isMoreOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isMoreOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xs bg-white border border-neutral-200/90 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {secondaryNavItems.map((sec) => (
                    <Link
                      key={sec.href}
                      href={sec.href}
                      onClick={() => setIsMoreOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:text-brand-red hover:bg-red-50/50 transition-colors rounded-xs"
                      role="menuitem"
                    >
                      <Icon name={sec.icon} size={15} className="text-neutral-400" />
                      <span>{sec.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Support and Sign In Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Support button - rounded-xs */}
            <Link
              href="/contact"
              className="w-9 h-9 rounded-xs bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
              aria-label="24/7 Support Desk"
              title="24/7 Support Desk"
            >
              <Icon name="headphones" size={17} />
            </Link>

            {user ? (
              <div className="flex items-center gap-2">
                {(['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) && (
                  <Link
                    href={user.role === 'SUPER_ADMIN' ? '/owner' : user.role === 'STAFF' ? '/staff' : '/admin'}
                    className="px-2.5 py-1 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded-xs transition-colors"
                  >
                    Staff Portal
                  </Link>
                )}
                <Link href="/account" className="text-sm font-bold text-neutral-700 hover:text-brand-red">{user.name || 'My Account'}</Link>
                <button type="button" onClick={() => void logout()} className="px-3 py-2 text-xs font-bold text-brand-red hover:bg-brand-red-light rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red">Sign out</button>
              </div>
            ) : !isLoading && (
              <button type="button" onClick={() => setIsSignInOpen(true)} className="inline-flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-brand-red hover:bg-[#74181E] active:scale-[0.98] rounded-xs shadow-xs hover:shadow transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 cursor-pointer" aria-label="Sign in to your FlyWithSafety account">
                <Icon name="user" size={16} /><span>Sign In</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href="/contact"
              className="w-9 h-9 rounded-xs bg-neutral-100 text-neutral-700 flex items-center justify-center"
              aria-label="Support Desk"
            >
              <Icon name="headphones" size={17} />
            </Link>
            <button
              type="button"
              className="p-2 rounded-xs text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              <Icon name={isMobileMenuOpen ? 'x' : 'menu'} size={24} />
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        <div
          id="mobile-menu"
          inert={!isMobileMenuOpen}
          aria-hidden={!isMobileMenuOpen}
          className={`md:hidden overflow-hidden transition-all duration-200 ease-in-out ${
            isMobileMenuOpen ? 'max-h-[calc(100dvh-70px)] overflow-y-auto opacity-100 pb-5' : 'max-h-0 opacity-0'
          }`}
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="pt-2 pb-3 space-y-1 border-t border-neutral-100">
            {primaryNavItems.map((item) => {
              const active = isItemActive(item);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xs transition-colors ${
                    active
                      ? 'text-brand-red bg-red-50/60 font-bold'
                      : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon
                    name={item.icon}
                    size={18}
                    className={active ? 'text-brand-red' : 'text-neutral-400'}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 pb-1 border-t border-neutral-100">
              <p className="px-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                More Services
              </p>
              {secondaryNavItems.map((sec) => (
                <Link
                  key={sec.href}
                  href={sec.href}
                  className="flex items-center gap-3 px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded-xs"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon name={sec.icon} size={15} className="text-neutral-400" />
                  <span>{sec.label}</span>
                </Link>
              ))}
            </div>

            <div className="pt-3 border-t border-neutral-100 space-y-2">
              {user ? (
                <>
                  {(['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) && (
                    <Link
                      href={user.role === 'SUPER_ADMIN' ? '/owner' : user.role === 'STAFF' ? '/staff' : '/admin'}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="inline-flex items-center gap-2 w-full justify-center px-4 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xs transition-colors"
                    >
                      <Icon name="shield" size={15} />
                      <span>Staff Portal</span>
                    </Link>
                  )}
                  <Link
                    href="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="inline-flex items-center gap-2 w-full justify-center px-4 py-2 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-xs transition-colors"
                  >
                    <Icon name="user" size={15} />
                    <span>My Account ({user.name || user.email})</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      void logout();
                    }}
                    className="inline-flex items-center gap-2 w-full justify-center px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xs transition-colors cursor-pointer"
                  >
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSignInOpen(true);
                  }}
                  className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 text-sm font-bold text-white bg-brand-red hover:bg-[#74181E] rounded-xs shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red cursor-pointer"
                >
                  <Icon name="user" size={17} />
                  <span>Sign In</span>
                </button>
              )}
              <Link
                href="/contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex items-center gap-2 w-full justify-center px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 rounded-xs transition-colors"
              >
                <Icon name="headphones" size={15} />
                <span>24/7 Support Desk</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Akij Air-style Animated Sign In Modal */}
      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </header>
  );
}
