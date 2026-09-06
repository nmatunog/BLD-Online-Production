'use client';

import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EventUpdateScopeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScope: (scope: 'OCCURRENCE' | 'SERIES_FUTURE') => void;
  eventTitle: string;
}

/**
 * BLD Event Standards v1 - Phase 5: Scope selection dialog for editing series-backed occurrences.
 * 
 * Asks the user to choose:
 * - This occurrence only (OCCURRENCE) - one-off override
 * - This and future occurrences (SERIES_FUTURE) - update series template
 */
export default function EventUpdateScopeDialog({
  isOpen,
  onClose,
  onSelectScope,
  eventTitle,
}: EventUpdateScopeDialogProps) {
  const handleOccurrenceOnly = () => {
    onSelectScope('OCCURRENCE');
  };

  const handleSeriesFuture = () => {
    onSelectScope('SERIES_FUTURE');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Edit Recurring Event: Choose Scope
          </DialogTitle>
          <DialogDescription>
            You are editing <strong>{eventTitle}</strong>, which is part of a recurring series.
            <br />
            Please choose which events to update:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Option 1: This occurrence only */}
          <div className="border rounded-lg p-4 hover:border-primary transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-2">
                  This occurrence only
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Change the date, time, venue, location, or subtype for <strong>only this event</strong>. 
                  The series schedule stays the same for all other occurrences.
                </p>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>This-only:</strong> Only this date changes. The series schedule stays the same.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
            <Button 
              className="w-full mt-4" 
              onClick={handleOccurrenceOnly}
              variant="outline"
            >
              Update This Occurrence Only
            </Button>
          </div>

          {/* Option 2: This and future occurrences */}
          <div className="border rounded-lg p-4 hover:border-primary transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-2">
                  This and future occurrences
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Update the <strong>series schedule</strong> and apply changes to all upcoming occurrences 
                  from this date forward. Past occurrences remain unchanged.
                </p>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Series/future:</strong> This updates the series schedule and will change upcoming occurrences. 
                    Past occurrences stay as-is.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
            <Button 
              className="w-full mt-4" 
              onClick={handleSeriesFuture}
              variant="default"
            >
              Update Series (This and Future)
            </Button>
          </div>

          {/* Cancel button */}
          <Button 
            className="w-full" 
            onClick={onClose}
            variant="ghost"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
