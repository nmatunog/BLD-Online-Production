'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, Users, Calendar, CheckCircle, FileText, LogOut, Menu, X, User, BarChart3 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Role Badge Component
function RoleBadge({ role }: { role: string }) {
  const getRoleStyle = (role: string): string => {
    switch (role) {
      case 'SUPER_USER':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'ADMINISTRATOR':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'MINISTRY_COORDINATOR':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'STAFF':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleStyle(role)}`}>
      {role}
    </span>
  );
}

export default function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const adminRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR', 'CLASS_SHEPHERD'];
  const isAdmin = user?.role && adminRoles.includes(user.role);
  const isMember = user?.role === 'MEMBER';

  const handleLogout = () => {
    authService.logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  // Get user display name
const getUserDisplayName = () => {
    if (user?.member) {
      const nickname = user.member.nickname || user.member.firstName;
      return `${nickname} ${user.member.lastName}`;
    }
    return user?.email || user?.phone || 'User';
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, shortLabel: 'Home', show: true },
    { href: isMember ? '/checkin/self-checkin' : '/checkin', label: isMember ? 'Self Check-In' : 'Check-in', icon: CheckCircle, shortLabel: isMember ? 'Self Check-In' : 'Check-in', show: true },
    { href: '/members', label: 'Members', icon: Users, shortLabel: 'Members', show: isAdmin },
    { href: '/events', label: 'Events', icon: Calendar, shortLabel: 'Events', show: true }, // Show to all users
    { href: '/event-registrations', label: 'Event Registrations', icon: FileText, shortLabel: 'Registrations', show: true }, // Show to all users (members see non-recurring only)
    { href: '/reports', label: 'Reports', icon: BarChart3, shortLabel: 'Reports', show: isAdmin }, // Show to admins only
    { href: '/profile', label: 'Profile', icon: User, shortLabel: 'Profile', show: true },
  ].filter(link => link.show);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  if (!user) {
    return null;
  }

  const displayName = getUserDisplayName();
  const communityId = user.member?.communityId;

  return (
    <header className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Header */}
        <div className="hidden md:block py-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-rose-700">
                BLD Cebu Community Online Portal
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-sm lg:text-base text-gray-600">
                  Welcome, {displayName}!
                </p>
                {user.role && <RoleBadge role={user.role} />}
              </div>
              {communityId && (
                <p className="text-xs text-gray-500 mt-1">
                  ID: {communityId}
                </p>
              )}
            </div>
            {user && (
              <div className="flex items-center space-x-3">
                <Link
                  href="/profile"
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <User size={20} />
                  <span className="hidden lg:inline">Profile</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <LogOut size={20} />
                  <span className="hidden lg:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>

          {/* Navigation Bar */}
          <nav className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-md transition-colors text-sm',
                    active
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-rose-700 truncate">
                BLD Cebu Community Online Portal
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-600 truncate">
                  Welcome, {displayName}!
                </p>
                {user.role && <RoleBadge role={user.role} />}
              </div>
              {communityId && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  ID: {communityId}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2 ml-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="space-y-2">
              <nav className="grid grid-cols-2 gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center space-x-2 px-3 py-3 rounded-lg transition-colors text-sm',
                        active
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      <Icon size={18} />
                      <span>{item.shortLabel}</span>
                    </Link>
                  );
                })}
              </nav>

              {user && (
                <div className="flex space-x-2 pt-2 border-t border-gray-200">
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <User size={18} />
                    <span>Profile</span>
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
