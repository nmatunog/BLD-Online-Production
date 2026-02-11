'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, QrCode, Download, X } from 'lucide-react';
import { membersService, type Member, type UpdateMemberRequest } from '@/services/members.service';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import DashboardHeader from '@/components/layout/DashboardHeader';
import {
  APOSTOLATES,
  MINISTRIES_BY_APOSTOLATE,
  ENCOUNTER_TYPES,
  CIVIL_STATUSES,
  GENDERS,
  ENCOUNTER_CITY_OPTIONS,
  resolveCityCode,
  getCityLabel,
  getMinistriesForApostolate,
  getEncounterTypeDisplay,
  getEncounterTypeShort,
  capitalizeName,
  capitalizeLocation,
} from '@/lib/member-constants';
import { generateMemberQR, downloadQRCode, type MemberData } from '@/lib/qr-service';

export default function ProfilePage() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    suffix: '',
    nickname: '',
    email: '',
    phone: '',
    apostolate: '',
    ministry: '',
    communityId: '',
    city: '',
    cityOthers: '',
    encounterType: '',
    classNumber: '',
    serviceArea: '',
    gender: '',
    profession: '',
    civilStatus: '',
    dateOfBirth: '',
    spouseName: '',
    dateOfMarriage: '',
    numberOfChildren: 0,
    children: [] as Array<{ name: string; gender: string; dateOfBirth: string }>,
    dateOfEncounter: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!authService.isAuthenticated()) {
        router.push('/login');
        return;
      }

      setLoading(true);
      try {
        const authData = typeof window !== 'undefined' ? localStorage.getItem('authData') : null;
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            setUserRole(parsed.user?.role || '');
          } catch {
            // ignore
          }
        }
        const profile = await membersService.getMe();
        setMember(profile);
        const childrenArray = Array.isArray(profile.children)
          ? (profile.children as Array<{ name?: string; gender?: string; dateOfBirth?: string }>).map((c) => ({
              name: c?.name ?? '',
              gender: c?.gender ?? '',
              dateOfBirth: c?.dateOfBirth ?? '',
            }))
          : [];
        setEditForm({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          middleName: profile.middleName || '',
          suffix: profile.suffix || '',
          nickname: profile.nickname || '',
          email: profile.user?.email || '',
          phone: profile.user?.phone || '',
          apostolate: profile.apostolate || '',
          ministry: profile.ministry || '',
          communityId: profile.communityId || '',
          city: ENCOUNTER_CITY_OPTIONS.some((o) => o.value === (profile.city || '')) ? (profile.city || '') : 'OTHERS',
          cityOthers: ENCOUNTER_CITY_OPTIONS.some((o) => o.value === (profile.city || '')) ? '' : (profile.city || ''),
          encounterType: getEncounterTypeDisplay(profile.encounterType),
          classNumber: profile.classNumber.toString(),
          serviceArea: profile.serviceArea || '',
          gender: profile.gender ?? '',
          profession: profile.profession ?? '',
          civilStatus: profile.civilStatus ?? '',
          dateOfBirth: profile.dateOfBirth ?? '',
          spouseName: profile.spouseName ?? '',
          dateOfMarriage: profile.dateOfMarriage ?? '',
          numberOfChildren: typeof profile.numberOfChildren === 'number' ? profile.numberOfChildren : 0,
          children: childrenArray,
          dateOfEncounter: profile.dateOfEncounter ?? '',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load profile';
        toast.error('Error Loading Profile', {
          description: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleInputChange = (field: string, value: string) => {
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
      ...(field === 'apostolate' ? { ministry: '' } : {}), // Clear ministry when apostolate changes
    });
  };

  const handleSave = async () => {
    if (!member) return;

    setSaving(true);
    try {
      // Only send fields that are actually part of the member/user update (match Members management)
      const updateData: Record<string, string | number | string[] | Array<{ name: string; gender: string; dateOfBirth: string }> | null> = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        middleName: editForm.middleName || null,
        suffix: editForm.suffix || null,
        nickname: editForm.nickname || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        city: resolveCityCode(editForm.city, editForm.cityOthers),
        encounterType: getEncounterTypeShort(editForm.encounterType),
        classNumber: editForm.classNumber,
        apostolate: editForm.apostolate?.trim() || null,
        ministry: editForm.ministry?.trim() || null,
        serviceArea: editForm.serviceArea || null,
        gender: editForm.gender?.trim() || null,
        profession: editForm.profession?.trim() || null,
        civilStatus: editForm.civilStatus?.trim() || null,
        dateOfBirth: editForm.dateOfBirth?.trim() || null,
        spouseName: editForm.spouseName?.trim() || null,
        dateOfMarriage: editForm.dateOfMarriage?.trim() || null,
        numberOfChildren: editForm.numberOfChildren,
        children: editForm.children,
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

      await membersService.updateMe(updateData as UpdateMemberRequest);
      toast.success('Profile Updated', {
        description: 'Your profile has been updated successfully.',
      });
      setIsEditing(false);
      
      // Reload profile
      const updatedProfile = await membersService.getMe();
      setMember(updatedProfile);
    } catch (error: unknown) {
      // Surface backend message (e.g. validation, duplicate email/phone/Community ID)
      let errorMessage = 'Failed to update profile';
      const err = error as { response?: { data?: { message?: string | string[] }; status?: number } };
      if (err?.response?.data?.message) {
        const msg = err.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join(', ') : msg;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      const isDuplicateCommunityId = /community id|already in use/i.test(errorMessage);
      const is409 = err?.response?.status === 409;
      const title = isDuplicateCommunityId
        ? 'Duplicate Community ID'
        : is409
          ? 'Duplicate email or phone'
          : 'Profile update failed';
      toast.error(title, {
        description: errorMessage,
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!member) return;

    try {
      const memberData: MemberData = {
        communityId: member.communityId,
        firstName: member.firstName,
        lastName: member.lastName,
        nickname: member.nickname,
        email: member.user.email,
      };
      
      const qrCodeDataURL = await generateMemberQR(memberData);
      setShowQRCode(qrCodeDataURL);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate QR code';
      toast.error('Error', { description: errorMessage });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
          <div className="text-2xl text-gray-700">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Profile Not Found</h2>
            <p className="text-lg text-gray-600 mb-4">
              Your member profile could not be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = member.nickname
    ? `${member.nickname} ${member.lastName}`
    : `${member.firstName} ${member.lastName}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent mb-2">
                My Profile
              </h1>
              <p className="text-lg text-gray-600">
                View and edit your member profile
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <>
                  <Button
                    onClick={handleGenerateQR}
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    View QR Code
                  </Button>
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Edit Profile
                  </Button>
                </>
              )}
              {isEditing && (
                <>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      // Reset form to original values
                      const childrenArray = Array.isArray(member.children)
                        ? (member.children as Array<{ name?: string; gender?: string; dateOfBirth?: string }>).map((c) => ({
                            name: c?.name ?? '',
                            gender: c?.gender ?? '',
                            dateOfBirth: c?.dateOfBirth ?? '',
                          }))
                        : [];
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
                        communityId: member.communityId || '',
                        city: ENCOUNTER_CITY_OPTIONS.some((o) => o.value === (member.city || '')) ? (member.city || '') : 'OTHERS',
                        cityOthers: ENCOUNTER_CITY_OPTIONS.some((o) => o.value === (member.city || '')) ? '' : (member.city || ''),
                        encounterType: getEncounterTypeDisplay(member.encounterType),
                        classNumber: member.classNumber.toString(),
                        serviceArea: member.serviceArea || '',
                        gender: member.gender ?? '',
                        profession: member.profession ?? '',
                        civilStatus: member.civilStatus ?? '',
                        dateOfBirth: member.dateOfBirth ?? '',
                        spouseName: member.spouseName ?? '',
                        dateOfMarriage: member.dateOfMarriage ?? '',
                        numberOfChildren: typeof member.numberOfChildren === 'number' ? member.numberOfChildren : 0,
                        children: childrenArray,
                        dateOfEncounter: member.dateOfEncounter ?? '',
                      });
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Profile Information */}
          <Card className="bg-white border border-gray-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-lg">
              <CardTitle className="text-2xl text-white">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base font-semibold text-gray-700">First Name</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.firstName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Last Name</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.lastName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Middle Name</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.middleName}
                        onChange={(e) => handleInputChange('middleName', e.target.value)}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.middleName || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Suffix</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.suffix}
                        onChange={(e) => setEditForm({...editForm, suffix: e.target.value})}
                        placeholder="e.g. Jr., Sr., III"
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.suffix || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Nickname</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.nickname}
                        onChange={(e) => handleInputChange('nickname', e.target.value)}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.nickname || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Email</Label>
                    {isEditing ? (
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.user.email || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Phone</Label>
                    {isEditing ? (
                      <Input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.user.phone || '-'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Information (all fields optional) */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information <span className="text-sm font-normal text-gray-500">(optional)</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Gender</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.gender || undefined}
                        onValueChange={(value) => setEditForm({ ...editForm, gender: value })}
                      >
                        <SelectTrigger className="mt-2 h-12 text-lg">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDERS.map((g) => (
                            <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.gender || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Civil Status</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.civilStatus || undefined}
                        onValueChange={(value) => setEditForm({ ...editForm, civilStatus: value })}
                      >
                        <SelectTrigger className="mt-2 h-12 text-lg">
                          <SelectValue placeholder="Select civil status" />
                        </SelectTrigger>
                        <SelectContent>
                          {CIVIL_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.civilStatus || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Profession</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.profession}
                        onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                        className="mt-2 h-12 text-lg"
                        placeholder="e.g. Engineer, Teacher"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.profession || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Date of Birth</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editForm.dateOfBirth}
                        onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.dateOfBirth || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Date of Encounter</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editForm.dateOfEncounter}
                        onChange={(e) => setEditForm({ ...editForm, dateOfEncounter: e.target.value })}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.dateOfEncounter || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Name of Spouse</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.spouseName}
                        onChange={(e) => setEditForm({ ...editForm, spouseName: e.target.value })}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.spouseName || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Date of Marriage</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editForm.dateOfMarriage}
                        onChange={(e) => setEditForm({ ...editForm, dateOfMarriage: e.target.value })}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.dateOfMarriage || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Number of Children</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={editForm.numberOfChildren}
                        onChange={(e) => {
                          const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                          const prev = editForm.children;
                          const next =
                            n >= prev.length
                              ? [...prev, ...Array(n - prev.length).fill(null).map(() => ({ name: '', gender: '', dateOfBirth: '' }))]
                              : prev.slice(0, n);
                          setEditForm({ ...editForm, numberOfChildren: n, children: next });
                        }}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.numberOfChildren ?? '-'}</p>
                    )}
                  </div>
                </div>
                {/* Children details (optional) - same as Members edit */}
                {isEditing && editForm.numberOfChildren > 0 && (
                  <div className="mt-6 space-y-4">
                    <h4 className="text-base font-semibold text-gray-800">Children Information (optional)</h4>
                    {Array.from({ length: editForm.numberOfChildren }, (_, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                        <h5 className="text-sm font-medium text-gray-600 mb-3">Child {index + 1}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                            <Input
                              className="mt-1"
                              value={editForm.children[index]?.name ?? ''}
                              onChange={(e) => {
                                const next = [...(editForm.children || [])];
                                while (next.length <= index) next.push({ name: '', gender: '', dateOfBirth: '' });
                                next[index] = { ...next[index], name: e.target.value };
                                setEditForm({ ...editForm, children: next });
                              }}
                              placeholder="Child's full name"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Gender</Label>
                            <Select
                              value={(editForm.children[index]?.gender ?? '') || undefined}
                              onValueChange={(value) => {
                                const next = [...(editForm.children || [])];
                                while (next.length <= index) next.push({ name: '', gender: '', dateOfBirth: '' });
                                next[index] = { ...next[index], gender: value };
                                setEditForm({ ...editForm, children: next });
                              }}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {GENDERS.map((g) => (
                                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Date of Birth</Label>
                            <Input
                              type="date"
                              className="mt-1"
                              value={editForm.children[index]?.dateOfBirth ?? ''}
                              onChange={(e) => {
                                const next = [...(editForm.children || [])];
                                while (next.length <= index) next.push({ name: '', gender: '', dateOfBirth: '' });
                                next[index] = { ...next[index], dateOfBirth: e.target.value };
                                setEditForm({ ...editForm, children: next });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isEditing && member.numberOfChildren && member.numberOfChildren > 0 && Array.isArray(member.children) && member.children.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h4 className="text-base font-semibold text-gray-800">Children Information</h4>
                    {member.children.map((c: { name?: string; gender?: string; dateOfBirth?: string }, i: number) => (
                      <div key={i} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                        <p className="text-sm font-medium text-gray-700">
                          Child {i + 1}: {c?.name || '—'} {c?.gender ? `(${c.gender})` : ''} {c?.dateOfBirth ? `· DOB ${c.dateOfBirth}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Community Information (align with Members management: Super User can edit Community ID, City, Encounter) */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Community Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base font-semibold text-gray-700">
                      Community ID
                      {userRole === 'SUPER_USER' && isEditing && (
                        <span className="ml-2 text-xs font-normal text-blue-600">(Editable for Super User)</span>
                      )}
                    </Label>
                    {isEditing && userRole === 'SUPER_USER' ? (
                      <Input
                        value={editForm.communityId}
                        onChange={(e) => setEditForm({...editForm, communityId: e.target.value.toUpperCase()})}
                        className="mt-2 h-12 text-lg font-mono"
                        placeholder="e.g. CEB-ME-1801"
                      />
                    ) : (
                      <p className="mt-2 text-lg font-mono text-gray-800 bg-gray-100 px-3 py-2 rounded">
                        {member.communityId}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">City / Location</Label>
                    {isEditing && userRole === 'SUPER_USER' ? (
                      <>
                        <Select
                          value={editForm.city || undefined}
                          onValueChange={(value) => setEditForm({ ...editForm, city: value, ...(value !== 'OTHERS' ? { cityOthers: '' } : {}) })}
                        >
                          <SelectTrigger className="mt-2 h-12 text-lg">
                            <SelectValue placeholder="Select city or location" />
                          </SelectTrigger>
                          <SelectContent>
                            {ENCOUNTER_CITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editForm.city === 'OTHERS' && (
                          <Input
                            type="text"
                            placeholder="Enter location (Talisay, Don Bosco, etc. → saved as Cebu)"
                            value={editForm.cityOthers}
                            onChange={(e) => setEditForm({ ...editForm, cityOthers: e.target.value })}
                            className="mt-2 h-12 text-lg"
                          />
                        )}
                      </>
                    ) : isEditing ? (
                      <p className="mt-2 text-lg text-gray-800 bg-gray-100 px-3 py-2 rounded">{getCityLabel(member.city) || member.city}</p>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{getCityLabel(member.city) || member.city}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Encounter Type</Label>
                    {isEditing && userRole === 'SUPER_USER' ? (
                      <Select
                        value={editForm.encounterType || undefined}
                        onValueChange={(value) => setEditForm({...editForm, encounterType: value})}
                      >
                        <SelectTrigger className="mt-2 h-12 text-lg">
                          <SelectValue placeholder="Select encounter type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ENCOUNTER_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.label}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : isEditing ? (
                      <p className="mt-2 text-lg text-gray-800 bg-gray-100 px-3 py-2 rounded">{getEncounterTypeDisplay(member.encounterType)}</p>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{getEncounterTypeDisplay(member.encounterType)}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Class Number</Label>
                    {isEditing && userRole === 'SUPER_USER' ? (
                      <Input
                        type="text"
                        value={editForm.classNumber}
                        onChange={(e) => setEditForm({...editForm, classNumber: e.target.value})}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : isEditing ? (
                      <p className="mt-2 text-lg text-gray-800 bg-gray-100 px-3 py-2 rounded">{member.classNumber}</p>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.classNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Ministry Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Ministry Information <span className="text-sm font-normal text-gray-500">(optional)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Apostolate</Label>
                    {isEditing ? (
                      <div className="mt-2 flex flex-wrap gap-2" role="listbox" aria-label="Apostolate">
                        {APOSTOLATES.map((ap) => (
                          <button
                            key={ap}
                            type="button"
                            onClick={() => {
                              const apostolateValue = capitalizeLocation(ap);
                              setEditForm((prev) => {
                                const next = { ...prev, apostolate: apostolateValue };
                                if (prev.ministry) {
                                  const valid = getMinistriesForApostolate(apostolateValue);
                                  if (!valid.includes(prev.ministry)) next.ministry = '';
                                }
                                return next;
                              });
                            }}
                            className={`rounded-md border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                              editForm.apostolate === ap
                                ? 'border-purple-600 bg-purple-600 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {ap}
                          </button>
                        ))}
                        {editForm.apostolate && (
                          <button
                            type="button"
                            onClick={() => setEditForm((prev) => ({ ...prev, apostolate: '', ministry: '' }))}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.apostolate || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Ministry</Label>
                    {isEditing ? (
                      <div className="mt-2">
                        {editForm.apostolate ? (
                          <div className="flex flex-wrap gap-2" role="listbox" aria-label="Ministry">
                            {getMinistriesForApostolate(editForm.apostolate).map((min) => (
                              <button
                                key={min}
                                type="button"
                                onClick={() => setEditForm((prev) => ({ ...prev, ministry: capitalizeLocation(min) }))}
                                className={`rounded-md border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                                  editForm.ministry === min
                                    ? 'border-purple-600 bg-purple-600 text-white'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {min}
                              </button>
                            ))}
                            {editForm.ministry && (
                              <button
                                type="button"
                                onClick={() => setEditForm((prev) => ({ ...prev, ministry: '' }))}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">Select an apostolate above first</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.ministry || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">
                      Service Area
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (Optional - e.g., geographic area, zone, or specific program)
                      </span>
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editForm.serviceArea}
                        onChange={(e) => setEditForm({...editForm, serviceArea: e.target.value})}
                        placeholder="e.g., North Cebu, Zone 1, LSS Program"
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.serviceArea || '-'}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRCode && member && (
        <Dialog open={!!showQRCode} onOpenChange={() => setShowQRCode(null)}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>QR Code for {displayName}</DialogTitle>
            </DialogHeader>
            <div className="text-center">
              <img src={showQRCode} alt="Member QR Code" className="mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                Community ID: <span className="font-mono font-bold">{member.communityId}</span>
              </p>
              <p className="text-xs text-gray-500 mb-4">
                This QR code can be used for quick check-in at events
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                onClick={() => {
                  if (showQRCode) {
                    downloadQRCode(showQRCode, member.communityId);
                  }
                }}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowQRCode(null)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

