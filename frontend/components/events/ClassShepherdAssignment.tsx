'use client';

import { useState, useEffect } from 'react';
import { Users, X, Plus, Loader2, UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { classShepherdsService, type ClassShepherdAssignment, type ClassShepherdGroup } from '@/services/class-shepherds.service';
import { membersService, type Member } from '@/services/members.service';
import { ENCOUNTER_TYPES } from '@/lib/member-constants';

interface ClassShepherdAssignmentProps {
  eventId: string;
  eventCategory: string;
  eventType: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClassShepherdAssignment({
  eventId,
  eventCategory,
  eventType,
  isOpen,
  onClose,
}: ClassShepherdAssignmentProps) {
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<ClassShepherdGroup[]>([]);
  const [availableShepherds, setAvailableShepherds] = useState<Member[]>([]);
  const [loadingShepherds, setLoadingShepherds] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({
    userId: '',
    encounterType: '',
    classNumber: '',
  });

  // Check if event is an Encounter Event
  const isEncounterEvent = () => {
    const encounterCategories = [
      'Marriage Encounter',
      'Singles Encounter',
      'Solo Parents Encounter',
      'Family Encounter',
      'Youth Encounter',
    ];
    const encounterTypes = ['ME', 'SE', 'SPE', 'FE', 'YE', 'ENCOUNTER'];
    
    return (
      encounterCategories.includes(eventCategory) ||
      encounterTypes.includes(eventType?.toUpperCase() || '') ||
      eventCategory?.toLowerCase().includes('encounter')
    );
  };

  // Load assignments
  const loadAssignments = async () => {
    if (!isEncounterEvent()) return;
    
    try {
      setLoading(true);
      const result = await classShepherdsService.getClassShepherds(eventId);
      setAssignments(result.grouped);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load Class Shepherd assignments';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Load available Class Shepherds
  const loadAvailableShepherds = async () => {
    try {
      setLoadingShepherds(true);
      const result = await membersService.getAll({
        limit: 1000, // Get all members
      });
      
      // Filter for CLASS_SHEPHERD role
      const shepherds = result.data.filter(
        (member) => member.user.role === 'CLASS_SHEPHERD' && member.user.isActive
      );
      setAvailableShepherds(shepherds);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load Class Shepherds';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoadingShepherds(false);
    }
  };

  useEffect(() => {
    if (isOpen && isEncounterEvent()) {
      loadAssignments();
      loadAvailableShepherds();
    }
  }, [isOpen, eventId]);

  const handleAssign = async () => {
    if (!assignForm.userId || !assignForm.encounterType || !assignForm.classNumber) {
      toast.error('Validation Error', {
        description: 'Please fill in all fields',
      });
      return;
    }

    const classNum = parseInt(assignForm.classNumber, 10);
    if (isNaN(classNum) || classNum < 1 || classNum > 999) {
      toast.error('Validation Error', {
        description: 'Class number must be between 1 and 999',
      });
      return;
    }

    try {
      setLoading(true);
      await classShepherdsService.assignClassShepherd(eventId, {
        userId: assignForm.userId,
        encounterType: assignForm.encounterType,
        classNumber: classNum,
      });
      
      toast.success('Class Shepherd Assigned', {
        description: 'The Class Shepherd has been assigned successfully.',
      });
      
      setAssignForm({ userId: '', encounterType: '', classNumber: '' });
      setShowAssignDialog(false);
      loadAssignments();
      loadAvailableShepherds();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign Class Shepherd';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this Class Shepherd assignment?')) {
      return;
    }

    try {
      setLoading(true);
      await classShepherdsService.removeClassShepherd(eventId, assignmentId);
      
      toast.success('Class Shepherd Removed', {
        description: 'The Class Shepherd assignment has been removed successfully.',
      });
      
      loadAssignments();
      loadAvailableShepherds();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove Class Shepherd';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const getShepherdName = (assignment: ClassShepherdAssignment): string => {
    if (assignment.user.member) {
      const member = assignment.user.member;
      return `${member.nickname || member.firstName} ${member.lastName}`;
    }
    return assignment.user.email || assignment.user.phone || 'Unknown';
  };

  const getShepherdCommunityId = (assignment: ClassShepherdAssignment): string => {
    return assignment.user.member?.communityId || 'N/A';
  };

  // Filter shepherds by encounter type for the assign form
  const getFilteredShepherds = () => {
    if (!assignForm.encounterType) return availableShepherds;
    
    return availableShepherds.filter(
      (shepherd) =>
        shepherd.user.shepherdEncounterType?.toUpperCase() === assignForm.encounterType.toUpperCase() &&
        shepherd.user.shepherdClassNumber?.toString() === assignForm.classNumber
    );
  };

  // Get current count for a class
  const getCurrentCount = (encounterType: string, classNumber: number): number => {
    const group = assignments.find(
      (g) => g.encounterType.toUpperCase() === encounterType.toUpperCase() && g.classNumber === classNumber
    );
    return group ? group.shepherds.length : 0;
  };

  if (!isEncounterEvent()) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-white border border-gray-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Class Shepherd Assignment</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1">
              Class Shepherd assignment is only available for Encounter Events.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              This event is not an Encounter Event. Class Shepherd assignment is only available for:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-gray-600 space-y-1">
              <li>Marriage Encounter</li>
              <li>Singles Encounter</li>
              <li>Solo Parents Encounter</li>
              <li>Family Encounter</li>
              <li>Youth Encounter</li>
            </ul>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl">
          <DialogHeader className="bg-white border-b border-gray-200 p-6">
            <DialogTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-red-600" />
              Class Shepherd Assignment
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1">
              Assign up to 4 Class Shepherds per encounter class for this event
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Assign Button */}
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setAssignForm({ userId: '', encounterType: '', classNumber: '' });
                  setShowAssignDialog(true);
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Class Shepherd
              </Button>
            </div>

            {/* Assignments List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-semibold text-gray-900 mb-2">No Class Shepherds Assigned</p>
                <p className="text-sm text-gray-600">
                  Click "Assign Class Shepherd" to assign shepherds for encounter classes
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignments.map((group) => (
                  <Card key={`${group.encounterType}-${group.classNumber}`} className="border border-gray-200">
                    <CardHeader className="bg-red-50 border-b border-red-200">
                      <CardTitle className="text-lg font-semibold text-red-900 flex items-center justify-between">
                        <span>
                          {group.encounterType} Class {group.classNumber}
                        </span>
                        <Badge className="bg-red-600 text-white">
                          {group.shepherds.length} / 4
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      {group.shepherds.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No shepherds assigned for this class
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {group.shepherds.map((assignment) => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                            >
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">
                                  {getShepherdName(assignment)}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {getShepherdCommunityId(assignment)}
                                </p>
                              </div>
                              <Button
                                onClick={() => handleRemove(assignment.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md bg-white border border-gray-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Assign Class Shepherd</DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1">
              Select a Class Shepherd and encounter class
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assign-encounterType" className="text-base font-semibold text-gray-700">
                Encounter Type *
              </Label>
              <Select
                value={assignForm.encounterType}
                onValueChange={(value) => {
                  setAssignForm({ ...assignForm, encounterType: value, classNumber: '', userId: '' });
                }}
              >
                <SelectTrigger className="h-12 text-base border border-gray-300 bg-white">
                  <SelectValue placeholder="Select encounter type" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-300 z-[100]">
                  {ENCOUNTER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assign-classNumber" className="text-base font-semibold text-gray-700">
                Class Number *
              </Label>
              <Input
                id="assign-classNumber"
                type="number"
                min="1"
                max="999"
                value={assignForm.classNumber}
                onChange={(e) => {
                  const value = e.target.value;
                  setAssignForm({ ...assignForm, classNumber: value, userId: '' });
                }}
                className="h-12 text-base border border-gray-300 bg-white"
                placeholder="e.g., 18"
              />
              {assignForm.encounterType && assignForm.classNumber && (
                <p className="text-sm text-gray-600">
                  Current: {getCurrentCount(assignForm.encounterType, parseInt(assignForm.classNumber, 10))} / 4
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assign-userId" className="text-base font-semibold text-gray-700">
                Class Shepherd *
              </Label>
              {loadingShepherds ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                </div>
              ) : (
                <Select
                  value={assignForm.userId}
                  onValueChange={(value) => setAssignForm({ ...assignForm, userId: value })}
                  disabled={!assignForm.encounterType || !assignForm.classNumber}
                >
                  <SelectTrigger className="h-12 text-base border border-gray-300 bg-white">
                    <SelectValue placeholder="Select Class Shepherd" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 z-[100] max-h-[300px]">
                    {getFilteredShepherds().length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 text-center">
                        {!assignForm.encounterType || !assignForm.classNumber
                          ? 'Please select encounter type and class number first'
                          : 'No Class Shepherds found for this class'}
                      </div>
                    ) : (
                      getFilteredShepherds().map((shepherd) => (
                        <SelectItem key={shepherd.userId} value={shepherd.userId}>
                          {shepherd.nickname || shepherd.firstName} {shepherd.lastName} ({shepherd.communityId})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              onClick={() => {
                setShowAssignDialog(false);
                setAssignForm({ userId: '', encounterType: '', classNumber: '' });
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={loading || !assignForm.userId || !assignForm.encounterType || !assignForm.classNumber}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

