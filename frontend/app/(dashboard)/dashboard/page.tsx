'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Users, Calendar, FileText, LogOut } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Define admin roles
  const adminRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR'];
  const isAdmin = user?.role && adminRoles.includes(user.role);
  const isSuperUserOrAdmin = user?.role === 'SUPER_USER' || user?.role === 'ADMINISTRATOR';
  const isMember = user?.role === 'MEMBER';

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const token = authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.sub,
          email: payload.email,
          phone: payload.phone,
          role: payload.role,
        });
      } catch (error) {
        console.error('Error decoding token:', error);
        authService.logout();
      }
    }
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    authService.logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Get user display name
  const getUserDisplayName = () => {
    // For now, use email or phone as fallback
    // Later we'll fetch full member profile
    return user.email || user.phone || 'User';
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                {isMember 
                  ? `Welcome, ${getUserDisplayName()}!`
                  : 'Welcome to BLD Attendance Monitor'
                }
              </h1>
              <p className="text-rose-100 text-sm md:text-base">
                {isMember 
                  ? 'Check in to events and manage your profile'
                  : 'Manage events, track attendance, and engage with your community'
                }
              </p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-3 xl:grid-cols-4' : 'lg:grid-cols-2'} gap-4 md:gap-6`}>
          <Link 
            href="/checkin"
            className="bg-card p-4 md:p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-3">
              <div className="flex-shrink-0">
                <CheckCircle className="text-green-600" size={28} />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg md:text-xl font-semibold text-card-foreground mb-1">Check-in</h3>
                <p className="text-sm md:text-base text-muted-foreground">Track attendance</p>
              </div>
            </div>
          </Link>
          
          {isAdmin && (
            <>
              <Link 
                href="/members"
                className="bg-card p-4 md:p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
              >
                <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-3">
                  <div className="flex-shrink-0">
                    <Users className="text-purple-600" size={28} />
                  </div>
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg md:text-xl font-semibold text-card-foreground mb-1">Members</h3>
                    <p className="text-sm md:text-base text-muted-foreground">Manage profiles</p>
                  </div>
                </div>
              </Link>
              
              <Link 
                href="/events"
                className="bg-card p-4 md:p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
              >
                <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-3">
                  <div className="flex-shrink-0">
                    <Calendar className="text-purple-600" size={28} />
                  </div>
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg md:text-xl font-semibold text-card-foreground mb-1">Events</h3>
                    <p className="text-sm md:text-base text-muted-foreground">Create events</p>
                  </div>
                </div>
              </Link>

              <Link 
                href="/event-registrations"
                className="bg-card p-4 md:p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
              >
                <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-3">
                  <div className="flex-shrink-0">
                    <FileText className="text-rose-600" size={28} />
                  </div>
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg md:text-xl font-semibold text-card-foreground mb-1">Registrations</h3>
                    <p className="text-sm md:text-base text-muted-foreground">Event signups</p>
                  </div>
                </div>
              </Link>
            </>
          )}
        </div>

        {/* System Status - Only show to Super User and Administrator */}
        {isSuperUserOrAdmin && (
          <Card>
            <CardContent className="p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-card-foreground mb-4">System Status</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-3 h-3 md:w-4 md:h-4 bg-green-600 rounded-full flex-shrink-0"></div>
                  <span className="text-sm md:text-base text-gray-700">Next.js App</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-3 h-3 md:w-4 md:h-4 bg-green-600 rounded-full flex-shrink-0"></div>
                  <span className="text-sm md:text-base text-gray-700">PostgreSQL</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-3 h-3 md:w-4 md:h-4 bg-green-600 rounded-full flex-shrink-0"></div>
                  <span className="text-sm md:text-base text-gray-700">Authentication</span>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-3 h-3 md:w-4 md:h-4 bg-green-600 rounded-full flex-shrink-0"></div>
                  <span className="text-sm md:text-base text-gray-700">Backend API</span>
                </div>
              </div>
              
              <div className="mt-4 md:mt-6 bg-green-50 border border-green-200 p-3 md:p-4 rounded-lg">
                <p className="text-sm md:text-base text-green-800">
                  🎉 <strong>Success!</strong> Your BLD Cebu Online Portal is fully operational.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
