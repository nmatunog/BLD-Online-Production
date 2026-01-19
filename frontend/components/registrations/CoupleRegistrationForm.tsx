'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { registrationsService, type RegisterCoupleRequest } from '@/services/registrations.service';
import { membersService } from '@/services/members.service';

interface CoupleRegistrationFormProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CoupleRegistrationForm({
  eventId,
  isOpen,
  onClose,
  onSuccess,
}: CoupleRegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [searchingHusband, setSearchingHusband] = useState(false);
  const [searchingWife, setSearchingWife] = useState(false);
  const [formData, setFormData] = useState<RegisterCoupleRequest>({
    husbandCommunityId: '',
    husbandLastName: '',
    husbandFirstName: '',
    husbandMiddleName: '',
    husbandNickname: '',
    wifeCommunityId: '',
    wifeLastName: '',
    wifeFirstName: '',
    wifeMiddleName: '',
    wifeNickname: '',
    specialRequirements: '',
    emergencyContact: '',
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        husbandCommunityId: '',
        husbandLastName: '',
        husbandFirstName: '',
        husbandMiddleName: '',
        husbandNickname: '',
        wifeCommunityId: '',
        wifeLastName: '',
        wifeFirstName: '',
        wifeMiddleName: '',
        wifeNickname: '',
        specialRequirements: '',
        emergencyContact: '',
      });
    }
  }, [isOpen]);

  const handleHusbandCommunityIdChange = async (communityId: string) => {
    const upperId = communityId.toUpperCase().trim();
    setFormData({ ...formData, husbandCommunityId: upperId });

    if (upperId.length < 3) {
      return;
    }

    try {
      setSearchingHusband(true);
      const member = await membersService.getByCommunityId(upperId);
      setFormData({
        ...formData,
        husbandCommunityId: upperId,
        husbandLastName: member.lastName,
        husbandFirstName: member.firstName,
        husbandMiddleName: member.middleName || '',
        husbandNickname: member.nickname || '',
      });
      toast.success('Husband Found', {
        description: `Found: ${member.firstName} ${member.lastName}`,
      });
    } catch (error) {
      console.error('Error looking up husband:', error);
    } finally {
      setSearchingHusband(false);
    }
  };

  const handleWifeCommunityIdChange = async (communityId: string) => {
    const upperId = communityId.toUpperCase().trim();
    setFormData({ ...formData, wifeCommunityId: upperId });

    if (upperId.length < 3) {
      return;
    }

    try {
      setSearchingWife(true);
      const member = await membersService.getByCommunityId(upperId);
      setFormData({
        ...formData,
        wifeCommunityId: upperId,
        wifeLastName: member.lastName,
        wifeFirstName: member.firstName,
        wifeMiddleName: member.middleName || '',
        wifeNickname: member.nickname || '',
      });
      toast.success('Wife Found', {
        description: `Found: ${member.firstName} ${member.lastName}`,
      });
    } catch (error) {
      console.error('Error looking up wife:', error);
    } finally {
      setSearchingWife(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.husbandCommunityId ||
      !formData.husbandLastName ||
      !formData.husbandFirstName ||
      !formData.wifeCommunityId ||
      !formData.wifeLastName ||
      !formData.wifeFirstName
    ) {
      toast.error('Validation Error', {
        description: 'Please fill in all required fields for both Husband and Wife.',
      });
      return;
    }

    try {
      setLoading(true);
      const result = await registrationsService.registerCouple(eventId, formData);

      if (result.success) {
        const husbandName = `${formData.husbandFirstName} ${formData.husbandLastName}`;
        const wifeName = `${formData.wifeFirstName} ${formData.wifeLastName}`;
        toast.success('Couple Registration Successful', {
          description: `${husbandName} and ${wifeName} have been registered successfully.`,
        });
        onSuccess();
        onClose();
      } else {
        toast.error('Registration Failed', {
          description: result.error || 'Failed to register couple.',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to register couple.';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Register Couple</DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            Register both husband and wife for this Marriage Encounter event
          </DialogDescription>
        </DialogHeader>

        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-4">
          <div className="text-sm font-medium text-pink-900 mb-1">💑 Marriage Encounter Event</div>
          <div className="text-xs text-pink-700">
            Registration fee applies once for the couple. Room assignment will be shared.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Husband Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-blue-900 mb-3">👨 Husband</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="husbandCommunityId" className="text-base font-semibold text-gray-700">
                  Husband Community ID *
                </Label>
                <div className="relative">
                  <Input
                    id="husbandCommunityId"
                    value={formData.husbandCommunityId}
                    onChange={(e) => handleHusbandCommunityIdChange(e.target.value)}
                    className="h-12 text-lg uppercase pr-10"
                    placeholder="e.g., CEB-ME1801"
                    required
                  />
                  {searchingHusband && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />
                  )}
                  {!searchingHusband && formData.husbandCommunityId.length >= 3 && (
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="husbandLastName" className="text-base font-semibold text-gray-700">
                    Last Name *
                  </Label>
                  <Input
                    id="husbandLastName"
                    value={formData.husbandLastName}
                    onChange={(e) => setFormData({ ...formData, husbandLastName: e.target.value })}
                    className="h-12 text-lg"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="husbandFirstName" className="text-base font-semibold text-gray-700">
                    First Name *
                  </Label>
                  <Input
                    id="husbandFirstName"
                    value={formData.husbandFirstName}
                    onChange={(e) => setFormData({ ...formData, husbandFirstName: e.target.value })}
                    className="h-12 text-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="husbandMiddleName" className="text-base font-semibold text-gray-700">
                    Middle Name
                  </Label>
                  <Input
                    id="husbandMiddleName"
                    value={formData.husbandMiddleName}
                    onChange={(e) => setFormData({ ...formData, husbandMiddleName: e.target.value })}
                    className="h-12 text-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="husbandNickname" className="text-base font-semibold text-gray-700">
                    Nickname
                  </Label>
                  <Input
                    id="husbandNickname"
                    value={formData.husbandNickname}
                    onChange={(e) => setFormData({ ...formData, husbandNickname: e.target.value })}
                    className="h-12 text-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Wife Section */}
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-pink-900 mb-3">👩 Wife</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="wifeCommunityId" className="text-base font-semibold text-gray-700">
                  Wife Community ID *
                </Label>
                <div className="relative">
                  <Input
                    id="wifeCommunityId"
                    value={formData.wifeCommunityId}
                    onChange={(e) => handleWifeCommunityIdChange(e.target.value)}
                    className="h-12 text-lg uppercase pr-10"
                    placeholder="e.g., CEB-ME1801"
                    required
                  />
                  {searchingWife && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />
                  )}
                  {!searchingWife && formData.wifeCommunityId.length >= 3 && (
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wifeLastName" className="text-base font-semibold text-gray-700">
                    Last Name *
                  </Label>
                  <Input
                    id="wifeLastName"
                    value={formData.wifeLastName}
                    onChange={(e) => setFormData({ ...formData, wifeLastName: e.target.value })}
                    className="h-12 text-lg"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="wifeFirstName" className="text-base font-semibold text-gray-700">
                    First Name *
                  </Label>
                  <Input
                    id="wifeFirstName"
                    value={formData.wifeFirstName}
                    onChange={(e) => setFormData({ ...formData, wifeFirstName: e.target.value })}
                    className="h-12 text-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wifeMiddleName" className="text-base font-semibold text-gray-700">
                    Middle Name
                  </Label>
                  <Input
                    id="wifeMiddleName"
                    value={formData.wifeMiddleName}
                    onChange={(e) => setFormData({ ...formData, wifeMiddleName: e.target.value })}
                    className="h-12 text-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="wifeNickname" className="text-base font-semibold text-gray-700">
                    Nickname
                  </Label>
                  <Input
                    id="wifeNickname"
                    value={formData.wifeNickname}
                    onChange={(e) => setFormData({ ...formData, wifeNickname: e.target.value })}
                    className="h-12 text-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Shared Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="emergencyContact" className="text-base font-semibold text-gray-700">
                Emergency Contact *
              </Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                className="h-12 text-lg"
                required
                placeholder="Phone number or contact info"
              />
            </div>

            <div>
              <Label htmlFor="specialRequirements" className="text-base font-semibold text-gray-700">
                Special Requirements
              </Label>
              <Textarea
                id="specialRequirements"
                value={formData.specialRequirements}
                onChange={(e) => setFormData({ ...formData, specialRequirements: e.target.value })}
                className="text-lg min-h-[100px]"
                placeholder="Dietary restrictions, accessibility needs, etc."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="h-12 text-lg px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 text-lg px-6 bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Couple'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

