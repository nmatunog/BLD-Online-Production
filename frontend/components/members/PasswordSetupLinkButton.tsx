'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { Copy, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/services/api-client';
import type { ApiResponse } from '@/types/api.types';
import { getErrorMessage } from '@/lib/get-error-message';

type SetupLink = { resetUrl: string; expiresAt: string; memberName: string };

/**
 * Coordinator path for members without SMS: after checking the person face to face,
 * get a one-day link they open on their own phone to choose a password.
 */
export function PasswordSetupLinkButton({ memberId }: { memberId: string }) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<SetupLink | null>(null);
  const [qr, setQr] = useState('');

  const create = async () => {
    const confirmed = window.confirm(
      'Only continue if you have checked this member in person. They will get a link to choose a new password, valid for one day.',
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      const response = await apiClient.post<ApiResponse<SetupLink>>(
        `/auth/password-setup-link/${encodeURIComponent(memberId)}`,
      );
      const data = response.data?.data;
      if (!response.data?.success || !data) {
        throw new Error(response.data?.error || 'Could not create the link');
      }
      setLink(data);
      setQr(await QRCode.toDataURL(data.resetUrl, { width: 280, margin: 2 }));
    } catch (error) {
      toast.error('Could not create the link', { description: getErrorMessage(error, 'Please try again') });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.resetUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed — long-press the link to copy it');
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => void create()} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
        Password setup link
      </Button>
      <Dialog
        open={!!link}
        onOpenChange={(open) => {
          if (!open) {
            setLink(null);
            setQr('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Password setup for {link?.memberName}</DialogTitle>
            <DialogDescription>
              Let the member scan this QR code with their phone camera, or send them the link. They
              choose their own password. Valid until{' '}
              {link
                ? new Date(link.expiresAt).toLocaleString('en-PH', {
                    timeZone: 'Asia/Manila',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : ''}
              .
            </DialogDescription>
          </DialogHeader>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Password setup QR code" className="mx-auto h-64 w-64" />
          ) : null}
          <p className="break-all rounded-lg bg-slate-100 p-3 text-xs text-slate-700">{link?.resetUrl}</p>
          <Button type="button" onClick={() => void copy()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
          <p className="text-sm text-gray-600">
            Only share this link with the member themselves. Anyone with it can set their password
            until it expires.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
