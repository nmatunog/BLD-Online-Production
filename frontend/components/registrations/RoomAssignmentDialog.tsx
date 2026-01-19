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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { registrationsService, type EventRegistration } from '@/services/registrations.service';

interface RoomAssignmentDialogProps {
  registration: EventRegistration | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RoomAssignmentDialog({
  registration,
  isOpen,
  onClose,
  onSuccess,
}: RoomAssignmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [roomAssignment, setRoomAssignment] = useState('');

  useEffect(() => {
    if (registration && isOpen) {
      setRoomAssignment(registration.roomAssignment || '');
    }
  }, [registration, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registration) return;

    try {
      setLoading(true);
      const result = await registrationsService.updateRoomAssignment(registration.id, {
        roomAssignment: roomAssignment.trim(),
      });

      if (result.success) {
        toast.success('Room Assigned', {
          description: 'The room assignment has been updated successfully.',
        });
        onSuccess();
        onClose();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to update room assignment.',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update room assignment.';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setRoomAssignment(registration?.roomAssignment || '');
      onClose();
    }
  };

  if (!registration) return null;

  const displayName = registration.member
    ? `${registration.member.firstName} ${registration.member.lastName}`
    : `${registration.firstName} ${registration.lastName}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Assign Room</DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            {displayName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="roomAssignment" className="text-base font-semibold text-gray-700">
              Room Number / Assignment *
            </Label>
            <Input
              id="roomAssignment"
              value={roomAssignment}
              onChange={(e) => setRoomAssignment(e.target.value)}
              className="h-12 text-lg"
              placeholder="e.g., Room 101, Room A-12"
              required
              autoFocus
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter the room number or assignment for this registration.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="h-12 text-lg px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !roomAssignment.trim()}
              className="h-12 text-lg px-6 bg-cyan-600 hover:bg-cyan-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Room'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

