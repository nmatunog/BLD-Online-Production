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
import { registrationsService, type RegisterMemberRequest } from '@/services/registrations.service';
import { membersService } from '@/services/members.service';

interface MemberRegistrationFormProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MemberRegistrationForm({
  eventId,
  isOpen,
  onClose,
  onSuccess,
}: MemberRegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [formData, setFormData] = useState<RegisterMemberRequest>({
    memberCommunityId: '',
    lastName: '',
    firstName: '',
    middleName: '',
    nickname: '',
    specialRequirements: '',
    emergencyContact: '',
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        memberCommunityId: '',
        lastName: '',
        firstName: '',
        middleName: '',
        nickname: '',
        specialRequirements: '',
        emergencyContact: '',
      });
    }
  }, [isOpen]);

  const handleCommunityIdChange = async (communityId: string) => {
    const upperId = communityId.toUpperCase().trim();
    setFormData({ ...formData, memberCommunityId: upperId });

    // Only lookup if Community ID looks valid (has at least 3 characters)
    if (upperId.length < 3) {
      return;
    }

    try {
      setSearching(true);
      const result = await membersService.getByCommunityId(upperId);
      if (result) {
        const member = result;
        setFormData({
          ...formData,
          memberCommunityId: upperId,
          lastName: member.lastName,
          firstName: member.firstName,
          middleName: member.middleName || '',
          nickname: member.nickname || '',
          emergencyContact: member.user?.phone || '',
        });
        toast.success('Member Found', {
          description: `Found: ${member.firstName} ${member.lastName}`,
        });
      }
    } catch (error) {
      // Don't show error for lookup failures, just silently fail
      console.error('Error looking up member:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.memberCommunityId || !formData.lastName || !formData.firstName) {
      toast.error('Validation Error', {
        description: 'Please fill in all required fields (Community ID, Last Name, First Name).',
      });
      return;
    }

    try {
      setLoading(true);
      const result = await registrationsService.registerMember(eventId, formData);

      if (result.success) {
        toast.success('Registration Successful', {
          description: `${formData.firstName} ${formData.lastName} has been registered successfully.`,
        });
        onSuccess();
        onClose();
      } else {
        toast.error('Registration Failed', {
          description: result.error || 'Failed to register member.',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to register member.';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Register Member</DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            Register an existing member for this event
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="memberCommunityId" className="text-base font-semibold text-gray-700">
              Community ID *
            </Label>
            <div className="relative">
              <Input
                id="memberCommunityId"
                value={formData.memberCommunityId}
                onChange={(e) => handleCommunityIdChange(e.target.value)}
                className="h-12 text-lg uppercase pr-10"
                placeholder="e.g., CEB-ME1801"
                required
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />
              )}
              {!searching && formData.memberCommunityId.length >= 3 && (
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Enter the member's Community ID to auto-populate their information
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lastName" className="text-base font-semibold text-gray-700">
                Last Name *
              </Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="h-12 text-lg"
                required
              />
            </div>
            <div>
              <Label htmlFor="firstName" className="text-base font-semibold text-gray-700">
                First Name *
              </Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="h-12 text-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="middleName" className="text-base font-semibold text-gray-700">
                Middle Name
              </Label>
              <Input
                id="middleName"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                className="h-12 text-lg"
              />
            </div>
            <div>
              <Label htmlFor="nickname" className="text-base font-semibold text-gray-700">
                Nickname
              </Label>
              <Input
                id="nickname"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                className="h-12 text-lg"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="emergencyContact" className="text-base font-semibold text-gray-700">
              Emergency Contact
            </Label>
            <Input
              id="emergencyContact"
              value={formData.emergencyContact}
              onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
              className="h-12 text-lg"
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
              className="h-12 text-lg px-6 bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Member'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

