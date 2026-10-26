'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BulkPermanentDeleteItemResult, BulkPermanentDeleteResponse } from '@/services/members.service';

export const BULK_DELETE_CONFIRM_WORD = 'DELETE';

export type BulkDeleteTarget = {
  id: string;
  name: string;
  communityId: string;
};

type Props = {
  open: boolean;
  members: BulkDeleteTarget[];
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<BulkPermanentDeleteResponse>;
  onCompleted: () => void;
};

export function BulkPermanentDeleteDialog({
  open,
  members,
  onOpenChange,
  onConfirm,
  onCompleted,
}: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkPermanentDeleteItemResult[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmText('');
    setIsSubmitting(false);
    setError(null);
    setResults(null);
  }, [open]);

  const canSubmit = confirmText.trim() === BULK_DELETE_CONFIRM_WORD && !isSubmitting && !results;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await onConfirm();
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to permanently remove selected members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (isSubmitting) return;
    if (!nextOpen && results) {
      onCompleted();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto bg-white p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {results ? 'Removal complete' : 'Remove selected permanently?'}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-700">
            {results
              ? 'These accounts were deactivated and then permanently removed. This cannot be undone.'
              : 'This cannot be undone. Each account will be deactivated first, then permanently removed.'}
          </DialogDescription>
        </DialogHeader>

        <ul className="my-4 max-h-64 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
          {(results ?? members.map((member) => ({
            memberId: member.id,
            name: member.name,
            communityId: member.communityId,
            status: 'pending',
          }))).map((row) => (
            <li key={row.memberId} className="text-lg text-gray-900">
              <p className="font-semibold">{row.name}</p>
              <p className="font-mono text-base text-gray-700">{row.communityId}</p>
              {results ? (
                <p className="text-base text-green-800">
                  {row.status === 'deleted' ? 'Removed' : row.status}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        {error ? (
          <p className="text-base font-medium text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {!results ? (
          <div className="space-y-2">
            <Label htmlFor="bulk-delete-confirm" className="text-base font-semibold text-gray-800">
              Type {BULK_DELETE_CONFIRM_WORD} to confirm
            </Label>
            <Input
              id="bulk-delete-confirm"
              name="bulkDeleteConfirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              className="h-12 text-lg"
              placeholder={BULK_DELETE_CONFIRM_WORD}
            />
          </div>
        ) : null}

        <DialogFooter className="mt-4 gap-2 sm:gap-3">
          {results ? (
            <Button className="h-12 w-full text-lg sm:w-auto" onClick={() => handleClose(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full text-lg sm:w-auto"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-12 w-full bg-red-700 text-lg text-white hover:bg-red-800 sm:w-auto"
                onClick={() => void handleConfirm()}
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Removing…
                  </>
                ) : (
                  'Remove selected permanently'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
