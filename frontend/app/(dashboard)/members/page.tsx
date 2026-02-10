'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Users, X, Edit, Trash2, QrCode, Plus, ArrowLeft, Loader2, RefreshCw, Download, Save } from 'lucide-react';
import { membersService, type Member, type MemberQueryParams, type UpdateMemberRequest } from '@/services/members.service';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import {
  APOSTOLATES,
  MINISTRIES_BY_APOSTOLATE,
  ENCOUNTER_TYPES,
  USER_ROLES,
  MEMBER_STATUSES,
  CIVIL_STATUSES,
  GENDERS,
  getMinistriesForApostolate,
  getEncounterTypeDisplay,
  getEncounterTypeShort,
  getRoleDisplayName,
  capitalizeName,
  capitalizeLocation,
  getMiddleInitial,
} from '@/lib/member-constants';
import { generateMemberQR, downloadQRCode, type MemberData } from '@/lib/qr-service';

interface EditFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  nickname: string;
  email: string;
  phone: string;
  apostolate: string;
  ministry: string;
  city: string;
  encounterType: string;
  classNumber: string;
  communityId: string;
  serviceArea: string;
  // Personal Information
  gender: string;
  profession: string;
  civilStatus: string;
  dateOfBirth: string;
  // Family Information
  spouseName: string;
  dateOfMarriage: string;
  numberOfChildren: number;
  children: Array<{ name: string; gender: string; dateOfBirth: string }>;
  // Encounter Information
  dateOfEncounter: string;
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('Active');
  const [filterMinistry, setFilterMinistry] = useState<string>('ALL');
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [userMinistry, setUserMinistry] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showRoleAssignmentDialog, setShowRoleAssignmentDialog] = useState(false);
  const [roleAssignmentMember, setRoleAssignmentMember] = useState<Member | null>(null);
  const [roleAssignmentForm, setRoleAssignmentForm] = useState({
    role: 'MEMBER' as string,
    shepherdEncounterType: '',
    shepherdClassNumber: '',
    ministry: '',
  });
  const [pendingRoleByMemberId, setPendingRoleByMemberId] = useState<Record<string, string>>({});
  const [roleSaveLoading, setRoleSaveLoading] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    firstName: '',
    lastName: '',
    middleName: '',
    suffix: '',
    nickname: '',
    email: '',
    phone: '',
    apostolate: '',
    ministry: '',
    city: '',
    encounterType: '',
    classNumber: '',
    communityId: '',
    serviceArea: '',
    gender: '',
    profession: '',
    civilStatus: '',
    dateOfBirth: '',
    spouseName: '',
    dateOfMarriage: '',
    numberOfChildren: 0,
    children: [],
    dateOfEncounter: '',
  });

  // Check authentication and permissions
  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true);
      
      if (!authService.isAuthenticated()) {
        router.push('/login');
        return;
      }

      // Get user role from localStorage
      const authData = localStorage.getItem('authData');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          setUserRole(parsed.user?.role || '');
          setUserMinistry(parsed.user?.ministry || '');
          setCurrentUserId(parsed.user?.id || '');
        } catch (error) {
          console.error('Error parsing auth data:', error);
        }
      }

      setAuthLoading(false);
      loadMembers();
    };

    checkAuth();
  }, [router]);

  const allowedRoles = ['SUPER_USER', 'ADMINISTRATOR', 'DCS', 'MINISTRY_COORDINATOR', 'CLASS_SHEPHERD'];
  const canAccess = !authLoading && allowedRoles.includes(userRole);

  const loadMembers = async () => {
    setMembersLoading(true);
    setLoading(true);
    try {
      const params: MemberQueryParams = {
        search: searchTerm || undefined,
        city: undefined,
        encounterType: undefined,
        ministry: filterMinistry !== 'ALL' ? filterMinistry : undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 1000,
      };

      // Filter by ministry if user is MINISTRY_COORDINATOR
      if (userRole === 'MINISTRY_COORDINATOR' && userMinistry) {
        params.ministry = userMinistry;
      }

      const result = await membersService.getAll(params);
      setMembers(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load members';
      toast.error('Error Loading Members', {
        description: errorMessage,
      });
    } finally {
      setMembersLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      const timeoutId = setTimeout(() => {
        loadMembers();
      }, 300); // Debounce search

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, filterRole, filterStatus, filterMinistry, authLoading]);

  // Get unique ministries for filter dropdown
  const uniqueMinistries = useMemo(() => {
    if (!members || members.length === 0) return [];
    const ministries = new Set<string>();
    members.forEach(member => {
      if (member.ministry && member.ministry.trim()) {
        ministries.add(member.ministry);
      }
    });
    return Array.from(ministries).sort();
  }, [members]);

  // Filtered and sorted members
  const filteredMembers = useMemo(() => {
    let filtered = members.filter(member => {
      const firstName = member.firstName || '';
      const lastName = member.lastName || '';
      const communityId = member.communityId || '';
      
      const fullName = `${firstName} ${lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                           communityId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesMinistry = filterMinistry === 'ALL' || member.ministry === filterMinistry;
      const matchesRole = filterRole === 'ALL' || member.user?.role === filterRole;
      const matchesStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'Active' && member.user?.isActive) ||
        (filterStatus === 'Inactive' && !member.user?.isActive);

      return matchesSearch && matchesMinistry && matchesRole && matchesStatus;
    });

    // Sort alphabetically if enabled
    if (sortAlphabetically) {
      filtered = [...filtered].sort((a, b) => {
        const aLastName = (a.lastName || '').toLowerCase();
        const bLastName = (b.lastName || '').toLowerCase();
        const aFirstName = (a.firstName || '').toLowerCase();
        const bFirstName = (b.firstName || '').toLowerCase();
        
        if (aLastName !== bLastName) {
          return aLastName.localeCompare(bLastName);
        }
        return aFirstName.localeCompare(bFirstName);
      });
    }

    return filtered;
  }, [members, searchTerm, filterRole, filterStatus, filterMinistry, sortAlphabetically]);

  // Permission checks
  const canEditMember = (member: Member): boolean => {
    if (userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS') {
      return true;
    }
    if (userRole === 'MINISTRY_COORDINATOR') {
      return member.ministry === userMinistry;
    }
    // CLASS_SHEPHERD can edit members from their assigned encounter class
    // Note: This will be enforced on the backend, but we check here for UI purposes
    if (userRole === 'CLASS_SHEPHERD') {
      // Get user's shepherd assignment from auth data
      const authData = localStorage.getItem('authData');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          const shepherdEncounterType = parsed.user?.shepherdEncounterType;
          const shepherdClassNumber = parsed.user?.shepherdClassNumber;
          if (shepherdEncounterType && shepherdClassNumber) {
            return (
              member.encounterType.toUpperCase() === shepherdEncounterType.toUpperCase() &&
              member.classNumber === shepherdClassNumber
            );
          }
        } catch (error) {
          console.error('Error parsing auth data:', error);
        }
      }
      return false;
    }
    return false;
  };

  const canAddMembers = (): boolean => {
    return userRole === 'SUPER_USER' || 
           userRole === 'ADMINISTRATOR' || 
           userRole === 'DCS' ||
           userRole === 'MINISTRY_COORDINATOR';
  };

  // Handle input changes with proper capitalization
  const handleProfileInputChange = (field: keyof EditFormData, value: string) => {
    let processedValue = value;
    
    if (field === 'firstName' || field === 'lastName' || field === 'middleName' || field === 'nickname') {
      processedValue = capitalizeName(value);
    } else if (field === 'city') {
      processedValue = value.toUpperCase();
    } else if (field === 'apostolate' || field === 'ministry') {
      processedValue = capitalizeLocation(value);
    }
    
    setEditForm({
      ...editForm,
      [field]: processedValue,
    });
  };

  // Handle role dropdown change (sets pending role; Save button persists)
  const handleRoleSelectChange = (memberId: string, newRole: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    // For CLASS_SHEPHERD and MINISTRY_COORDINATOR, open dialog for additional info
    if (newRole === 'CLASS_SHEPHERD' || newRole === 'MINISTRY_COORDINATOR') {
      setRoleAssignmentMember(member);
      setRoleAssignmentForm({
        role: newRole,
        shepherdEncounterType: '',
        shepherdClassNumber: '',
        ministry: '',
      });
      setShowRoleAssignmentDialog(true);
      return;
    }

    // Same as current role: clear any pending
    if (newRole === member.user.role) {
      setPendingRoleByMemberId((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
      return;
    }

    // Set pending role; user clicks Save to persist
    setPendingRoleByMemberId((prev) => ({ ...prev, [memberId]: newRole }));
  };

  // Save pending role (Super User / Admin / DCS)
  const handleSaveRole = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    const pendingRole = pendingRoleByMemberId[memberId];
    if (!member || pendingRole === undefined) return;

    setRoleSaveLoading(memberId);
    try {
      const { usersService } = await import('@/services/users.service');
      await usersService.assignRole(member.userId, { role: pendingRole as any });
      setPendingRoleByMemberId((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
      toast.success('Role Updated', {
        description: `Role updated to ${getRoleDisplayName(pendingRole)}`,
      });
      loadMembers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update role';
      toast.error('Error', { description: errorMessage });
    } finally {
      setRoleSaveLoading(null);
    }
  };

  // Handle role assignment submission
  const handleRoleAssignmentSubmit = async () => {
    if (!roleAssignmentMember) return;

    try {
      const { usersService } = await import('@/services/users.service');
      
      const assignData: any = {
        role: roleAssignmentForm.role,
      };

      if (roleAssignmentForm.role === 'CLASS_SHEPHERD') {
        if (!roleAssignmentForm.shepherdEncounterType || !roleAssignmentForm.shepherdClassNumber) {
          toast.error('Validation Error', {
            description: 'Encounter Type and Class Number are required for Class Shepherd role',
          });
          return;
        }
        assignData.shepherdEncounterType = roleAssignmentForm.shepherdEncounterType;
        assignData.shepherdClassNumber = parseInt(roleAssignmentForm.shepherdClassNumber, 10);
      } else if (roleAssignmentForm.role === 'MINISTRY_COORDINATOR') {
        if (!roleAssignmentForm.ministry) {
          toast.error('Validation Error', {
            description: 'Ministry is required for Ministry Coordinator role',
          });
          return;
        }
        assignData.ministry = roleAssignmentForm.ministry;
      }

      await usersService.assignRole(roleAssignmentMember.userId, assignData);
      
      toast.success('Role Assigned', {
        description: `Successfully assigned ${getRoleDisplayName(roleAssignmentForm.role)} role`,
      });
      
      setShowRoleAssignmentDialog(false);
      setRoleAssignmentMember(null);
      loadMembers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign role';
      toast.error('Error', { description: errorMessage });
    }
  };

  // Handle role removal
  const handleRemoveRole = async (memberId: string, role: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) {
      toast.error('Error', { description: 'Member not found' });
      return;
    }

    if (!confirm(`Are you sure you want to remove the ${getRoleDisplayName(role)} role from this member?`)) {
      return;
    }

    try {
      const { usersService } = await import('@/services/users.service');
      await usersService.removeRole(member.userId, role as any);
      
      toast.success('Role Removed', {
        description: `Successfully removed ${getRoleDisplayName(role)} role`,
      });
      loadMembers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove role';
      toast.error('Error', { description: errorMessage });
    }
  };

  // Handle status toggle
  const handleToggleStatus = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const newStatus = member.user.isActive ? 'Inactive' : 'Active';
    
    try {
      // Note: This would need a backend endpoint to update user status
      toast.info('Status update feature coming soon');
      // await membersService.updateStatus(memberId, newStatus);
      // toast.success('Member status updated', { description: `Status updated to ${newStatus}` });
      // loadMembers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update status';
      toast.error('Error', { description: errorMessage });
    }
  };

  // Handle delete member (backend also blocks deleting self)
  const handleDeleteMember = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (member && member.userId === currentUserId) {
      toast.error('Cannot deactivate your own account', {
        description: 'You cannot deactivate the account you are currently logged in with.',
      });
      return;
    }
    if (!confirm('Are you sure you want to deactivate this member?')) {
      return;
    }

    try {
      await membersService.delete(memberId);
      toast.success('Member Deactivated', {
        description: 'The member has been deactivated successfully.',
      });
      loadMembers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message[0]
        : err.response?.data?.message ?? (error instanceof Error ? error.message : 'Failed to deactivate member');
      toast.error('Error', { description: msg });
    }
  };

  // Permanently remove a deactivated member and account (hard delete)
  const handlePermanentDelete = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (member && member.userId === currentUserId) {
      toast.error('Cannot remove your own account', {
        description: 'You cannot permanently remove the account you are logged in with.',
      });
      return;
    }
    if (member && member.user?.isActive) {
      toast.error('Deactivate first', {
        description: 'Deactivate the member first, then use "Remove permanently" to delete the account from the system.',
      });
      return;
    }
    if (!confirm('Permanently remove this member and their account? This cannot be undone. Attendance and registration links will be removed or unlinked.')) {
      return;
    }
    try {
      await membersService.deletePermanent(memberId);
      toast.success('Account removed', {
        description: 'The member and account have been permanently removed.',
      });
      loadMembers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message[0]
        : err.response?.data?.message ?? (error instanceof Error ? error.message : 'Failed to remove member');
      toast.error('Error', { description: msg });
    }
  };

  // Handle generate QR code
  const handleGenerateQR = async (member: Member) => {
    try {
      const memberData: MemberData = {
        communityId: member.communityId,
        firstName: member.firstName,
        lastName: member.lastName,
        nickname: member.nickname,
        email: member.user.email,
      };
      
      const qrCodeDataURL = await generateMemberQR(memberData);
      setSelectedMember(member);
      setShowQRCode(qrCodeDataURL);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate QR code';
      toast.error('Error', { description: errorMessage });
    }
  };

  // Handle edit member
  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setEditForm({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      middleName: member.middleName || '',
      suffix: member.suffix || '',
      nickname: member.nickname || '',
      email: member.user.email || '',
      phone: member.user.phone || '',
      apostolate: member.apostolate || '',
      ministry: member.ministry || '',
      city: member.city || '',
      encounterType: getEncounterTypeDisplay(member.encounterType),
      classNumber: member.classNumber.toString(),
      communityId: member.communityId || '',
      serviceArea: member.serviceArea || '',
      gender: member.gender || '',
      profession: member.profession || '',
      civilStatus: member.civilStatus || '',
      dateOfBirth: member.dateOfBirth || '',
      spouseName: member.spouseName || '',
      dateOfMarriage: member.dateOfMarriage || '',
      numberOfChildren: member.numberOfChildren ?? 0,
      children: Array.isArray(member.children) ? member.children.map((c: { name?: string; gender?: string; dateOfBirth?: string }) => ({ name: c?.name || '', gender: c?.gender || '', dateOfBirth: c?.dateOfBirth || '' })) : [],
      dateOfEncounter: member.dateOfEncounter || '',
    });
    setShowEditDialog(true);
  };

  // Handle update member
  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingMember) return;

    // Only send fields that are allowed by the backend DTO
    // Apostolate/ministry: send null when empty so backend validation accepts (valid apostolates list)
    const apostolate = (editForm.apostolate || '').trim() || null;
    const ministry = (editForm.ministry || '').trim() || null;

    const updateData: Record<string, string | number | null | Array<{ name?: string; gender?: string; dateOfBirth?: string }>> = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      middleName: editForm.middleName || null,
      suffix: editForm.suffix || null,
      nickname: editForm.nickname || null,
      email: editForm.email || null,
      phone: editForm.phone || null,
      city: editForm.city,
      encounterType: getEncounterTypeShort(editForm.encounterType),
      classNumber: editForm.classNumber,
      apostolate,
      ministry,
      serviceArea: editForm.serviceArea || null,
      gender: editForm.gender?.trim() || null,
      profession: editForm.profession?.trim() || null,
      civilStatus: editForm.civilStatus?.trim() || null,
      dateOfBirth: editForm.dateOfBirth?.trim() || null,
      spouseName: editForm.spouseName?.trim() || null,
      dateOfMarriage: editForm.dateOfMarriage?.trim() || null,
      numberOfChildren: editForm.numberOfChildren,
      children: editForm.children?.length ? editForm.children : [],
      dateOfEncounter: editForm.dateOfEncounter?.trim() || null,
    };
    if (userRole === 'SUPER_USER' && editForm.communityId?.trim()) {
      updateData.communityId = editForm.communityId.trim();
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    try {
      await membersService.update(editingMember.id, updateData as UpdateMemberRequest);
      toast.success('Member Updated', {
        description: 'The member has been updated successfully.',
      });
      setShowEditDialog(false);
      setEditingMember(null);
      loadMembers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message[0]
        : err.response?.data?.message ?? (error instanceof Error ? error.message : 'Failed to update member');
      toast.error('Update failed', { description: msg });
    }
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
          <div className="text-2xl text-gray-700">Loading...</div>
        </div>
      </div>
    );
  }

  // Only show access denied after auth check is complete
  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Access Denied</h2>
            <p className="text-lg text-gray-600 mb-4">
              You don't have permission to access Members Management.
            </p>
            <Link href="/dashboard">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="p-4 md:p-6">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Members Management</h2>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              {canAddMembers() && (
                <Button 
                  onClick={() => {
                    const signupUrl = `${window.location.origin}/register`;
                    window.open(signupUrl, '_blank');
                  }}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Open Signup Page
                </Button>
              )}
              <Button 
                onClick={loadMembers}
                disabled={loading}
                variant="outline"
                className="bg-gray-600 text-white hover:bg-gray-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Members</label>
              <div className="flex space-x-2">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or community ID..."
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Role</label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  {USER_ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  {MEMBER_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Ministry</label>
              <Select value={filterMinistry} onValueChange={setFilterMinistry}>
                <SelectTrigger>
                  <SelectValue placeholder="All Ministries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Ministries</SelectItem>
                  {uniqueMinistries.map(ministry => (
                    <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sort Toggle */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sortAlphabetically}
                  onChange={(e) => setSortAlphabetically(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700">Sort Alphabetically (by Last Name)</span>
              </label>
            </div>

            {(filterRole !== 'ALL' || filterStatus !== 'ALL' || filterMinistry !== 'ALL' || searchTerm.trim() || sortAlphabetically) && (
              <Button
                variant="outline"
                onClick={() => {
                  setFilterRole('ALL');
                  setFilterStatus('ALL');
                  setFilterMinistry('ALL');
                  setSearchTerm('');
                  setSortAlphabetically(false);
                }}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Clear All Filters
              </Button>
            )}
          </div>

          {/* Members Table */}
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-200">
                    <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</TableHead>
                    <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-700">Community ID</TableHead>
                    <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ministry/Apostolate</TableHead>
                    <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</TableHead>
                    <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</TableHead>
                    <TableHead className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200">
                  {membersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        Loading members...
                      </TableCell>
                    </TableRow>
                  ) : filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        {searchTerm.trim() || filterRole !== 'ALL' || filterStatus !== 'ALL' || filterMinistry !== 'ALL'
                          ? 'No members match your filters'
                          : 'No members found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => {
                      const displayName = member.nickname
                        ? `${member.nickname} ${member.lastName}`
                        : `${member.firstName} ${getMiddleInitial(member.middleName) ? getMiddleInitial(member.middleName) + ' ' : ''}${member.lastName}`;
                      
                      return (
                        <TableRow key={member.id} className="hover:bg-gray-100">
                          <TableCell className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{displayName}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">
                              {member.communityId}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{member.ministry || '-'}</p>
                              <p className="text-xs text-gray-500">{member.apostolate || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Select
                                value={pendingRoleByMemberId[member.id] ?? member.user.role}
                                onValueChange={(value) => handleRoleSelectChange(member.id, value)}
                                disabled={userRole !== 'SUPER_USER' && userRole !== 'ADMINISTRATOR' && userRole !== 'DCS'}
                              >
                                <SelectTrigger className="text-sm border border-gray-300 rounded px-2 py-1 w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {USER_ROLES.map(role => {
                                    // Only Super User can assign Administrator or Super User
                                    if ((role.value === 'SUPER_USER' || role.value === 'ADMINISTRATOR') && userRole !== 'SUPER_USER') {
                                      return null;
                                    }
                                    return (
                                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              {(userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS') &&
                               pendingRoleByMemberId[member.id] !== undefined &&
                               pendingRoleByMemberId[member.id] !== member.user.role && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 px-2 text-xs bg-purple-600 hover:bg-purple-700"
                                  onClick={() => handleSaveRole(member.id)}
                                  disabled={roleSaveLoading === member.id}
                                >
                                  {roleSaveLoading === member.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Save className="w-3.5 h-3.5 mr-1" />
                                      Save
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Button
                              onClick={() => handleToggleStatus(member.id)}
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                member.user.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-800 hover:bg-red-200'
                              }`}
                            >
                              {member.user.isActive ? 'Active' : 'Inactive'}
                            </Button>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost"
                                size="sm"
                                onClick={() => handleGenerateQR(member)}
                                className="text-green-600 hover:text-green-800"
                              >
                                QR Code
                              </Button>
                              {canEditMember(member) && (
                                <Button 
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditMember(member)}
                                  className="text-purple-600 hover:text-purple-800"
                                >
                                  Edit
                                </Button>
                              )}
                              {(userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS') && member.user?.isActive && (
                                <Button 
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMember(member.id)}
                                  disabled={member.userId === currentUserId}
                                  title={member.userId === currentUserId ? 'You cannot deactivate your own account' : 'Deactivate member'}
                                  className="text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Delete
                                </Button>
                              )}
                              {(userRole === 'SUPER_USER' || userRole === 'ADMINISTRATOR' || userRole === 'DCS') && !member.user?.isActive && (
                                <Button 
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePermanentDelete(member.id)}
                                  disabled={member.userId === currentUserId}
                                  title={member.userId === currentUserId ? 'You cannot remove your own account' : 'Permanently remove member and account'}
                                  className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Remove permanently
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredMembers.length} of {members.length} members
          </div>
        </div>

        {/* QR Code Modal */}
        {showQRCode && selectedMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">
                QR Code for {selectedMember.nickname || selectedMember.firstName} {selectedMember.lastName}
              </h3>
              <div className="text-center">
                <img src={showQRCode} alt="Member QR Code" className="mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  Community ID: <span className="font-mono font-bold">{selectedMember.communityId}</span>
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  This QR code can be used for quick check-in at events
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => {
                    if (showQRCode) {
                      downloadQRCode(showQRCode, selectedMember.communityId);
                    }
                  }}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowQRCode(null);
                    setSelectedMember(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Member Dialog - Part 1: Personal Information */}
        {showEditDialog && editingMember && (
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Edit Member Profile</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateMember} className="space-y-6">
                {/* Personal Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-semibold text-gray-800 mb-4">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">First Name *</Label>
                      <Input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => handleProfileInputChange('firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</Label>
                      <Input
                        type="text"
                        value={editForm.lastName}
                        onChange={(e) => handleProfileInputChange('lastName', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</Label>
                    <Input
                      type="text"
                      value={editForm.middleName}
                      onChange={(e) => handleProfileInputChange('middleName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">Nickname</Label>
                    <Input
                      type="text"
                      value={editForm.nickname}
                      onChange={(e) => handleProfileInputChange('nickname', e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">Email</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">Phone</Label>
                      <Input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">Gender *</Label>
                      <Select value={editForm.gender} onValueChange={(value) => setEditForm({...editForm, gender: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDERS.map(gender => (
                            <SelectItem key={gender.value} value={gender.value}>{gender.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">Profession/Occupation</Label>
                      <Input
                        type="text"
                        value={editForm.profession}
                        onChange={(e) => setEditForm({...editForm, profession: e.target.value})}
                        placeholder="e.g., Teacher, Engineer, Doctor"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">Civil Status *</Label>
                      <Select value={editForm.civilStatus} onValueChange={(value) => setEditForm({...editForm, civilStatus: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Civil Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {CIVIL_STATUSES.map(status => (
                            <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</Label>
                      <Input
                        type="date"
                        value={editForm.dateOfBirth}
                        onChange={(e) => setEditForm({...editForm, dateOfBirth: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                {editForm.civilStatus === 'Married' && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="text-md font-semibold text-gray-800 mb-4">Family Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">Full Name of Spouse</Label>
                        <Input
                          type="text"
                          value={editForm.spouseName}
                          onChange={(e) => setEditForm({...editForm, spouseName: e.target.value})}
                          placeholder="Full name of spouse"
                        />
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">Date of Marriage</Label>
                        <Input
                          type="date"
                          value={editForm.dateOfMarriage}
                          onChange={(e) => setEditForm({...editForm, dateOfMarriage: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">Number of Children</Label>
                      <Input
                        type="number"
                        min="0"
                        value={editForm.numberOfChildren}
                        onChange={(e) => setEditForm({...editForm, numberOfChildren: parseInt(e.target.value) || 0})}
                        placeholder="0"
                      />
                    </div>
                    {editForm.numberOfChildren > 0 && (
                      <div className="space-y-4 mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Children Information</h5>
                        {Array.from({ length: editForm.numberOfChildren }, (_, index) => (
                          <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                            <h6 className="text-sm font-medium text-gray-600 mb-3">Child {index + 1}</h6>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="block text-sm font-medium text-gray-700 mb-2">Full Name</Label>
                                <Input
                                  type="text"
                                  value={editForm.children[index]?.name || ''}
                                  onChange={(e) => {
                                    const newChildren = [...editForm.children];
                                    newChildren[index] = { ...newChildren[index], name: e.target.value };
                                    setEditForm({...editForm, children: newChildren});
                                  }}
                                  placeholder="Child's full name"
                                />
                              </div>
                              <div>
                                <Label className="block text-sm font-medium text-gray-700 mb-2">Gender</Label>
                                <Select
                                  value={editForm.children[index]?.gender || ''}
                                  onValueChange={(value) => {
                                    const newChildren = [...editForm.children];
                                    newChildren[index] = { ...newChildren[index], gender: value };
                                    setEditForm({...editForm, children: newChildren});
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Gender" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {GENDERS.map(gender => (
                                      <SelectItem key={gender.value} value={gender.value}>{gender.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="mt-4">
                              <Label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</Label>
                              <Input
                                type="date"
                                value={editForm.children[index]?.dateOfBirth || ''}
                                onChange={(e) => {
                                  const newChildren = [...editForm.children];
                                  newChildren[index] = { ...newChildren[index], dateOfBirth: e.target.value };
                                  setEditForm({...editForm, children: newChildren});
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Ministry Information */}
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="text-md font-semibold text-gray-800 mb-4">Ministry Information</h4>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">Apostolate *</Label>
                    <Select
                      value={editForm.apostolate}
                      onValueChange={(value) => setEditForm({...editForm, apostolate: value, ministry: ''})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Apostolate" />
                      </SelectTrigger>
                      <SelectContent>
                        {APOSTOLATES.map(apostolate => (
                          <SelectItem key={apostolate} value={apostolate}>{apostolate}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">Ministry *</Label>
                    <Select
                      value={editForm.ministry}
                      onValueChange={(value) => setEditForm({...editForm, ministry: value})}
                      disabled={!editForm.apostolate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Ministry" />
                      </SelectTrigger>
                      <SelectContent>
                        {getMinistriesForApostolate(editForm.apostolate).map(ministry => (
                          <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Area
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (Optional - e.g., geographic area, zone, or specific program)
                      </span>
                    </Label>
                    <Input
                      type="text"
                      value={editForm.serviceArea}
                      onChange={(e) => setEditForm({...editForm, serviceArea: e.target.value})}
                      placeholder="e.g., North Cebu, Zone 1, LSS Program"
                    />
                  </div>
                </div>

                {/* Community Information */}
                <div className={`p-4 rounded-lg ${userRole === 'SUPER_USER' ? 'bg-blue-50' : 'bg-gray-100 opacity-60'}`}>
                  <h4 className={`text-md font-semibold mb-4 ${userRole === 'SUPER_USER' ? 'text-gray-800' : 'text-gray-600'}`}>
                    Community Information
                    {userRole === 'SUPER_USER' && (
                      <span className="ml-2 text-xs text-blue-600 font-normal">(Editable for Super User)</span>
                    )}
                    {userRole !== 'SUPER_USER' && (
                      <span className="ml-2 text-xs text-gray-500 font-normal">(Read Only)</span>
                    )}
                  </h4>
                  <div>
                    <Label className={`block text-sm font-medium mb-2 ${userRole === 'SUPER_USER' ? 'text-gray-700' : 'text-gray-500'}`}>Community ID</Label>
                    <Input
                      type="text"
                      value={editForm.communityId}
                      onChange={(e) => setEditForm({...editForm, communityId: e.target.value.toUpperCase()})}
                      disabled={userRole !== 'SUPER_USER'}
                      readOnly={userRole !== 'SUPER_USER'}
                      className={userRole !== 'SUPER_USER' ? 'bg-gray-200 cursor-not-allowed' : ''}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className={`block text-sm font-medium mb-2 ${userRole === 'SUPER_USER' ? 'text-gray-700' : 'text-gray-500'}`}>City</Label>
                      <Input
                        type="text"
                        value={editForm.city}
                        onChange={(e) => handleProfileInputChange('city', e.target.value)}
                        disabled={userRole !== 'SUPER_USER'}
                        readOnly={userRole !== 'SUPER_USER'}
                        className={userRole !== 'SUPER_USER' ? 'bg-gray-200 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div>
                      <Label className={`block text-sm font-medium mb-2 ${userRole === 'SUPER_USER' ? 'text-gray-700' : 'text-gray-500'}`}>Encounter Type</Label>
                      {userRole === 'SUPER_USER' ? (
                        <Select
                          value={editForm.encounterType}
                          onValueChange={(value) => setEditForm({...editForm, encounterType: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ENCOUNTER_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.label}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="text"
                          value={editForm.encounterType}
                          disabled
                          readOnly
                          className="bg-gray-200 cursor-not-allowed"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className={`block text-sm font-medium mb-2 ${userRole === 'SUPER_USER' ? 'text-gray-700' : 'text-gray-500'}`}>Class Number</Label>
                    <Input
                      type="number"
                      min="1"
                      max="1000"
                      value={editForm.classNumber}
                      onChange={(e) => setEditForm({...editForm, classNumber: e.target.value})}
                      disabled={userRole !== 'SUPER_USER'}
                      readOnly={userRole !== 'SUPER_USER'}
                      className={userRole !== 'SUPER_USER' ? 'bg-gray-200 cursor-not-allowed' : ''}
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of {editForm.encounterType || 'Encounter'}
                    </Label>
                    <Input
                      type="date"
                      value={editForm.dateOfEncounter}
                      onChange={(e) => setEditForm({...editForm, dateOfEncounter: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false);
                      setEditingMember(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Role Assignment Dialog */}
        {showRoleAssignmentDialog && roleAssignmentMember && (
          <Dialog open={showRoleAssignmentDialog} onOpenChange={setShowRoleAssignmentDialog}>
            <DialogContent className="max-w-md bg-white">
              <DialogHeader>
                <DialogTitle>Assign Role: {getRoleDisplayName(roleAssignmentForm.role)}</DialogTitle>
                <DialogDescription>
                  Assigning role to {roleAssignmentMember.nickname || roleAssignmentMember.firstName} {roleAssignmentMember.lastName}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {roleAssignmentForm.role === 'CLASS_SHEPHERD' && (
                  <>
                    <div>
                      <Label className="text-base font-semibold text-gray-700">
                        Encounter Type *
                      </Label>
                      <Select
                        value={roleAssignmentForm.shepherdEncounterType}
                        onValueChange={(value) => setRoleAssignmentForm({...roleAssignmentForm, shepherdEncounterType: value})}
                      >
                        <SelectTrigger className="mt-2 h-12 text-lg">
                          <SelectValue placeholder="Select Encounter Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENCOUNTER_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-base font-semibold text-gray-700">
                        Class Number *
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          (The encounter class they will shepherd, e.g., 101)
                        </span>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max="999"
                        value={roleAssignmentForm.shepherdClassNumber}
                        onChange={(e) => setRoleAssignmentForm({...roleAssignmentForm, shepherdClassNumber: e.target.value})}
                        placeholder="e.g., 101"
                        className="mt-2 h-12 text-lg"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Note: A member cannot be a shepherd of 2 encounter classes at the same time.
                      </p>
                    </div>
                  </>
                )}

                {roleAssignmentForm.role === 'MINISTRY_COORDINATOR' && (
                  <div>
                    <Label className="text-base font-semibold text-gray-700">
                      Ministry *
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (The ministry they will coordinate)
                      </span>
                    </Label>
                    <Select
                      value={roleAssignmentForm.ministry}
                      onValueChange={(value) => setRoleAssignmentForm({...roleAssignmentForm, ministry: value})}
                    >
                      <SelectTrigger className="mt-2 h-12 text-lg">
                        <SelectValue placeholder="Select Ministry" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(MINISTRIES_BY_APOSTOLATE).flat().map(ministry => (
                          <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-sm text-gray-500">
                      Note: Ministry coordinators can only be such for one ministry at a time.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRoleAssignmentDialog(false);
                    setRoleAssignmentMember(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleRoleAssignmentSubmit}>
                  Assign Role
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
