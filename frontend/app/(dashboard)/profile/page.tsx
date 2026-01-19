'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, QrCode, Download, X } from 'lucide-react';
import { membersService, type Member } from '@/services/members.service';
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
    city: '',
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
        const profile = await membersService.getMe();
        setMember(profile);
        setEditForm({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          middleName: profile.middleName || '',
          suffix: profile.suffix || '',
          nickname: profile.nickname || '',
          email: profile.user.email || '',
          phone: profile.user.phone || '',
          apostolate: profile.apostolate || '',
          ministry: profile.ministry || '',
          city: profile.city || '',
          encounterType: getEncounterTypeDisplay(profile.encounterType),
          classNumber: profile.classNumber.toString(),
          serviceArea: profile.serviceArea || '',
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
      // Only send fields that are actually part of the member/user update
      // Remove fields that aren't in the DTO (like gender, profession, etc.)
      const updateData: Record<string, string | null> = {
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
        apostolate: editForm.apostolate || null,
        ministry: editForm.ministry || null,
        serviceArea: editForm.serviceArea || null,
      };
      
      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      await membersService.updateMe(updateData);
      toast.success('Profile Updated', {
        description: 'Your profile has been updated successfully.',
      });
      setIsEditing(false);
      
      // Reload profile
      const updatedProfile = await membersService.getMe();
      setMember(updatedProfile);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error('Error', {
        description: errorMessage,
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
                        serviceArea: member.serviceArea || '',
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

              {/* Community Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Community Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Community ID</Label>
                    <p className="mt-2 text-lg font-mono text-gray-800 bg-gray-100 px-3 py-2 rounded">
                      {member.communityId}
                    </p>
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">City</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.city}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Encounter Type</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.encounterType}
                        onValueChange={(value) => setEditForm({...editForm, encounterType: value})}
                      >
                        <SelectTrigger className="mt-2 h-12 text-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENCOUNTER_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.label}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{getEncounterTypeDisplay(member.encounterType)}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Class Number</Label>
                    {isEditing ? (
                      <Input
                        type="text"
                        value={editForm.classNumber}
                        onChange={(e) => setEditForm({...editForm, classNumber: e.target.value})}
                        className="mt-2 h-12 text-lg"
                      />
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.classNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Ministry Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Ministry Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Apostolate</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.apostolate}
                        onValueChange={(value) => handleInputChange('apostolate', value)}
                      >
                        <SelectTrigger className="mt-2 h-12 text-lg">
                          <SelectValue placeholder="Select Apostolate" />
                        </SelectTrigger>
                        <SelectContent>
                          {APOSTOLATES.map(apostolate => (
                            <SelectItem key={apostolate} value={apostolate}>{apostolate}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-2 text-lg text-gray-800">{member.apostolate || '-'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-gray-700">Ministry</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.ministry}
                        onValueChange={(value) => handleInputChange('ministry', value)}
                        disabled={!editForm.apostolate}
                      >
                        <SelectTrigger className="mt-2 h-12 text-lg">
                          <SelectValue placeholder="Select Ministry" />
                        </SelectTrigger>
                        <SelectContent>
                          {getMinistriesForApostolate(editForm.apostolate).map(ministry => (
                            <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

