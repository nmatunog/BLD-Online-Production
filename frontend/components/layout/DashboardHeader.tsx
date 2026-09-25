'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  Users,
  Calendar,
  CheckCircle,
  FileText,
  LogOut,
  Menu,
  User,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getDashboardPageTitle,
  getVisibleNavItems,
  isNavItemActive,
  type NavIconKey,
} from '@/lib/nav-items';
import { MobileNavDrawer, type MobileNavDrawerItem } from '@/components/layout/MobileNavDrawer';

const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  home: Home,
  checkin: CheckCircle,
  members: Users,
  events: Calendar,
  registrations: FileText,
  reports: BarChart3,
  profile: User,
};

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

  const handleLogout = () => {
    authService.logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const getUserDisplayName = () => {
    if (user?.member) {
      const nickname = user.member.nickname || user.member.firstName;
      return `${nickname} ${user.member.lastName}`;
    }
    return user?.email || user?.phone || 'User';
  };

  if (!user) {
    return null;
  }

  const navItems: MobileNavDrawerItem[] = getVisibleNavItems(user.role).map((item) => ({
    ...item,
    icon: NAV_ICONS[item.iconKey],
  }));
  const displayName = getUserDisplayName();
  const communityId = user.member?.communityId;
  const pageTitle = getDashboardPageTitle(pathname);

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

          <nav className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href);
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

        {/* Mobile Header: hamburger + visible page title */}
        <div className="md:hidden py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-xl border-2 border-gray-400 bg-white px-2 text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
            >
              <Menu className="h-6 w-6" aria-hidden />
              <span className="sr-only">Menu</span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.375rem] font-bold leading-tight text-gray-900">{pageTitle}</p>
              <p className="truncate text-[1rem] font-medium text-gray-800">{displayName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <MobileNavDrawer
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          items={navItems}
          pathname={pathname}
          displayName={displayName}
          communityId={communityId}
          role={user.role}
          onLogout={handleLogout}
        />
      </div>
    </header>
  );
}
