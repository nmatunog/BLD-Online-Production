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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { registrationsService, type RegisterNonMemberRequest } from '@/services/registrations.service';
import { ENCOUNTER_TYPES } from '@/lib/member-constants';

interface NonMemberRegistrationFormProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isEncounterEvent?: boolean;
  isMarriageEncounter?: boolean;
}

export default function NonMemberRegistrationForm({
  eventId,
  isOpen,
  onClose,
  onSuccess,
  isEncounterEvent = false,
  isMarriageEncounter = false,
}: NonMemberRegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<RegisterNonMemberRequest>({
    firstName: '',
    lastName: '',
    middleName: '',
    nameSuffix: '',
    nickname: '',
    email: '',
    phone: '',
    address: '',
    emergencyContact: '',
    specialRequirements: '',
    city: '',
    encounterType: '',
    classNumber: '',
    apostolate: '',
    ministry: '',
    spouseFirstName: '',
    spouseLastName: '',
    spouseMiddleName: '',
    spouseNameSuffix: '',
    spouseNickname: '',
    spouseEmail: '',
    spousePhone: '',
    spouseCity: '',
    spouseEncounterType: '',
    spouseClassNumber: '',
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        firstName: '',
        lastName: '',
        middleName: '',
        nameSuffix: '',
        nickname: '',
        email: '',
        phone: '',
        address: '',
        emergencyContact: '',
        specialRequirements: '',
        city: '',
        encounterType: '',
        classNumber: '',
        apostolate: '',
        ministry: '',
        spouseFirstName: '',
        spouseLastName: '',
        spouseMiddleName: '',
        spouseNameSuffix: '',
        spouseNickname: '',
        spouseEmail: '',
        spousePhone: '',
        spouseCity: '',
        spouseEncounterType: '',
        spouseClassNumber: '',
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || (!formData.email && !formData.phone)) {
      toast.error('Validation Error', {
        description: 'Please fill in all required fields (First Name, Last Name, Email or Phone).',
      });
      return;
    }

    if (isMarriageEncounter && (!formData.spouseFirstName || !formData.spouseLastName)) {
      toast.error('Validation Error', {
        description: 'Please fill in spouse information for Marriage Encounter events.',
      });
      return;
    }

    try {
      setLoading(true);
      const result = await registrationsService.registerNonMember(eventId, formData);

      if (result.success) {
        const name = `${formData.firstName} ${formData.lastName}`;
        toast.success('Registration Successful', {
          description: `${name} has been registered successfully.`,
        });
        onSuccess();
        onClose();
      } else {
        toast.error('Registration Failed', {
          description: result.error || 'Failed to register non-member.',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to register non-member.';
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
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {isMarriageEncounter ? 'Register Couple (Non-Members)' : 'Register Non-Member'}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            {isMarriageEncounter
              ? 'Register a couple (both persons) for this Marriage Encounter event'
              : 'Register a non-member for this event'}
          </DialogDescription>
        </DialogHeader>

        {isMarriageEncounter && (
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-4">
            <div className="text-sm font-medium text-pink-900 mb-1">💑 Marriage Encounter Event</div>
            <div className="text-xs text-pink-700">
              This event requires both persons to register. Registration fee applies once for the couple.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Person 1 Section */}
          <div className={isMarriageEncounter ? 'bg-blue-50 border border-blue-200 rounded-lg p-4' : ''}>
            {isMarriageEncounter && (
              <h4 className="text-lg font-semibold text-blue-900 mb-3">👤 Person 1</h4>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="nameSuffix" className="text-base font-semibold text-gray-700">
                    Name Suffix
                  </Label>
                  <Input
                    id="nameSuffix"
                    value={formData.nameSuffix}
                    onChange={(e) => setFormData({ ...formData, nameSuffix: e.target.value })}
                    className="h-12 text-lg"
                    placeholder="Jr, III, Sr, etc."
                  />
                </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="text-base font-semibold text-gray-700">
                    Email {!isMarriageEncounter && '*'}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-12 text-lg"
                    required={!isMarriageEncounter}
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-base font-semibold text-gray-700">
                    Phone {!isMarriageEncounter && '*'}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-12 text-lg"
                    required={!isMarriageEncounter}
                  />
                </div>
              </div>

              {!isMarriageEncounter && (
                <>
                  <div>
                    <Label htmlFor="address" className="text-base font-semibold text-gray-700">
                      Address
                    </Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="text-lg min-h-[80px]"
                    />
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
                    />
                  </div>
                </>
              )}

              {/* Member Profile Creation Fields for Encounter Events */}
              {isEncounterEvent && !isMarriageEncounter && (
                <div className="border-t border-purple-200 pt-4 mt-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                    <div className="text-sm font-medium text-purple-900 mb-1">✨ Create Member Profile</div>
                    <div className="text-xs text-purple-700">
                      Fill in the fields below to automatically create a member profile after registration.
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city" className="text-base font-semibold text-gray-700">
                        City *
                      </Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value.toUpperCase() })}
                        className="h-12 text-lg uppercase"
                        placeholder="e.g., CEBU"
                      />
                    </div>
                    <div>
                      <Label htmlFor="encounterType" className="text-base font-semibold text-gray-700">
                        Encounter Type *
                      </Label>
                      <select
                        id="encounterType"
                        value={formData.encounterType}
                        onChange={(e) => setFormData({ ...formData, encounterType: e.target.value })}
                        className="w-full h-12 text-lg px-4 border border-gray-300 rounded-md"
                      >
                        <option value="">Select...</option>
                        {ENCOUNTER_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="classNumber" className="text-base font-semibold text-gray-700">
                        Class Number *
                      </Label>
                      <Input
                        id="classNumber"
                        type="number"
                        min="1"
                        max="999"
                        value={formData.classNumber}
                        onChange={(e) => setFormData({ ...formData, classNumber: e.target.value })}
                        className="h-12 text-lg"
                        placeholder="e.g., 18"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Spouse Section for ME Events */}
          {isMarriageEncounter && (
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-pink-900 mb-3">👤 Person 2 (Spouse)</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="spouseFirstName" className="text-base font-semibold text-gray-700">
                      First Name *
                    </Label>
                    <Input
                      id="spouseFirstName"
                      value={formData.spouseFirstName}
                      onChange={(e) => setFormData({ ...formData, spouseFirstName: e.target.value })}
                      className="h-12 text-lg"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="spouseLastName" className="text-base font-semibold text-gray-700">
                      Last Name *
                    </Label>
                    <Input
                      id="spouseLastName"
                      value={formData.spouseLastName}
                      onChange={(e) => setFormData({ ...formData, spouseLastName: e.target.value })}
                      className="h-12 text-lg"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="spouseMiddleName" className="text-base font-semibold text-gray-700">
                      Middle Name
                    </Label>
                    <Input
                      id="spouseMiddleName"
                      value={formData.spouseMiddleName}
                      onChange={(e) => setFormData({ ...formData, spouseMiddleName: e.target.value })}
                      className="h-12 text-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="spouseEmail" className="text-base font-semibold text-gray-700">
                      Email *
                    </Label>
                    <Input
                      id="spouseEmail"
                      type="email"
                      value={formData.spouseEmail}
                      onChange={(e) => setFormData({ ...formData, spouseEmail: e.target.value })}
                      className="h-12 text-lg"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="spousePhone" className="text-base font-semibold text-gray-700">
                    Phone *
                  </Label>
                  <Input
                    id="spousePhone"
                    type="tel"
                    value={formData.spousePhone}
                    onChange={(e) => setFormData({ ...formData, spousePhone: e.target.value })}
                    className="h-12 text-lg"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Shared Fields for ME Events */}
          {isMarriageEncounter && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="address" className="text-base font-semibold text-gray-700">
                  Address *
                </Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="text-lg min-h-[80px]"
                  required
                />
              </div>
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
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="specialRequirements" className="text-base font-semibold text-gray-700">
              Special Requirements
            </Label>
            <Textarea
              id="specialRequirements"
              value={formData.specialRequirements}
              onChange={(e) => setFormData({ ...formData, specialRequirements: e.target.value })}
              className="text-lg min-h-[100px]"
              placeholder="Any special requirements or notes"
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
              className="h-12 text-lg px-6 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                isMarriageEncounter ? 'Register Couple' : 'Register Non-Member'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

