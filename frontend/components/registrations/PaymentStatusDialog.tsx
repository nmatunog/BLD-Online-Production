'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { registrationsService, type EventRegistration, type UpdatePaymentStatusRequest } from '@/services/registrations.service';

interface PaymentStatusDialogProps {
  registration: EventRegistration | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentStatusDialog({
  registration,
  isOpen,
  onClose,
  onSuccess,
}: PaymentStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdatePaymentStatusRequest>({
    paymentStatus: 'PENDING',
    paymentAmount: undefined,
    paymentReference: '',
    notes: '',
  });

  if (!registration) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registration) return;

    try {
      setLoading(true);
      const result = await registrationsService.updatePaymentStatus(
        registration.id,
        formData,
      );

      if (result.success) {
        toast.success('Payment Status Updated', {
          description: 'The payment status has been updated successfully.',
        });
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          paymentStatus: 'PENDING',
          paymentAmount: undefined,
          paymentReference: '',
          notes: '',
        });
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to update payment status.',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update payment status.';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        paymentStatus: registration.paymentStatus,
        paymentAmount: registration.paymentAmount ? Number(registration.paymentAmount) : undefined,
        paymentReference: registration.paymentReference || '',
        notes: registration.notes || '',
      });
      onClose();
    }
  };

  // Initialize form data when dialog opens
  if (isOpen && registration && formData.paymentStatus === 'PENDING' && formData.paymentAmount === undefined) {
    setFormData({
      paymentStatus: registration.paymentStatus,
      paymentAmount: registration.paymentAmount ? Number(registration.paymentAmount) : undefined,
      paymentReference: registration.paymentReference || '',
      notes: registration.notes || '',
    });
  }

  const displayName = registration.member
    ? `${registration.member.firstName} ${registration.member.lastName}`
    : `${registration.firstName} ${registration.lastName}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Update Payment Status</DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            {displayName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="paymentStatus" className="text-base font-semibold text-gray-700">
              Payment Status *
            </Label>
            <Select
              value={formData.paymentStatus}
              onValueChange={(value: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED') =>
                setFormData({ ...formData, paymentStatus: value })
              }
            >
              <SelectTrigger id="paymentStatus" className="h-12 text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="paymentAmount" className="text-base font-semibold text-gray-700">
              Payment Amount
            </Label>
            <Input
              id="paymentAmount"
              type="number"
              step="0.01"
              min="0"
              value={formData.paymentAmount || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  paymentAmount: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="h-12 text-lg"
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="paymentReference" className="text-base font-semibold text-gray-700">
              Payment Reference
            </Label>
            <Input
              id="paymentReference"
              value={formData.paymentReference}
              onChange={(e) =>
                setFormData({ ...formData, paymentReference: e.target.value })
              }
              className="h-12 text-lg"
              placeholder="Transaction ID, receipt number, etc."
            />
          </div>

          <div>
            <Label htmlFor="notes" className="text-base font-semibold text-gray-700">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="text-lg min-h-[100px]"
              placeholder="Additional notes about the payment..."
            />
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
              disabled={loading}
              className="h-12 text-lg px-6 bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Payment Status'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

