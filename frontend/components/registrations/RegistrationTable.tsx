'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign, Home, Edit, Trash2, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { registrationsService, type EventRegistration } from '@/services/registrations.service';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RegistrationTableProps {
  registrations: EventRegistration[];
  loading?: boolean;
  /** When true and list is empty, show "No registrations match your filters" instead of generic message */
  hasActiveFilters?: boolean;
  onUpdatePayment?: (registration: EventRegistration) => void;
  onAssignRoom?: (registration: EventRegistration) => void;
  onDelete?: (registration: EventRegistration) => void;
  onRefresh: () => void;
}

export default function RegistrationTable({
  registrations,
  loading,
  hasActiveFilters = false,
  onUpdatePayment,
  onAssignRoom,
  onDelete,
  onRefresh,
}: RegistrationTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (registration: EventRegistration) => {
    if (!confirm(`Are you sure you want to delete the registration for ${registration.firstName} ${registration.lastName}?`)) {
      return;
    }

    try {
      setDeletingId(registration.id);
      const result = await registrationsService.delete(registration.id);

      if (result.success) {
        toast.success('Registration Deleted', {
          description: 'The registration has been deleted successfully.',
        });
        onRefresh();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to delete registration.',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete registration.';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusMap = {
      PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
      PAID: { label: 'Paid', className: 'bg-green-100 text-green-800' },
      REFUNDED: { label: 'Refunded', className: 'bg-gray-100 text-gray-800' },
      CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.PENDING;
    return (
      <Badge className={statusInfo.className}>
        {statusInfo.label}
      </Badge>
    );
  };

  const getRegistrationTypeBadge = (type: string) => {
    const typeMap = {
      MEMBER: { label: 'Member', className: 'bg-green-100 text-green-800' },
      NON_MEMBER: { label: 'Non-Member', className: 'bg-blue-100 text-blue-800' },
      COUPLE: { label: 'Couple', className: 'bg-purple-100 text-purple-800' },
    };
    const typeInfo = typeMap[type as keyof typeof typeMap] || typeMap.MEMBER;
    return (
      <Badge className={typeInfo.className}>
        {typeInfo.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-lg border border-gray-200 bg-gray-50">
        <p className="text-lg font-medium text-gray-700">
          {hasActiveFilters ? 'No registrations match your filters' : 'No registrations found'}
        </p>
        {hasActiveFilters && (
          <p className="text-sm text-gray-500 mt-1">Try changing or clearing filters above.</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-base font-semibold text-gray-900">Name</TableHead>
              <TableHead className="text-base font-semibold text-gray-900">Community ID</TableHead>
              <TableHead className="text-base font-semibold text-gray-900">Type</TableHead>
              <TableHead className="text-base font-semibold text-gray-900">Contact</TableHead>
              <TableHead className="text-base font-semibold text-gray-900">Payment Status</TableHead>
              <TableHead className="text-base font-semibold text-gray-900">Amount</TableHead>
              <TableHead className="text-base font-semibold text-gray-900">Room</TableHead>
              <TableHead className="text-base font-semibold text-gray-900">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((registration) => {
              const displayName = registration.member
                ? `${registration.member.firstName} ${registration.member.middleName ? registration.member.middleName + ' ' : ''}${registration.member.lastName}`
                : `${registration.firstName} ${registration.middleName ? registration.middleName + ' ' : ''}${registration.lastName}`;
              
              const communityId = registration.memberCommunityId || registration.member?.communityId || 'N/A';
              const email = registration.email || registration.member?.user?.email || '-';
              const phone = registration.phone || registration.member?.user?.phone || '-';

              return (
                <TableRow key={registration.id} className="hover:bg-gray-50">
                  <TableCell className="text-lg">
                    <div>
                      <div className="font-medium text-gray-900">{displayName}</div>
                      {registration.member?.nickname && (
                        <div className="text-sm text-gray-500">({registration.member.nickname})</div>
                      )}
                      {registration.coupleRole && (
                        <div className="text-xs text-purple-600 mt-1">
                          {registration.coupleRole === 'HUSBAND' ? '👨 Husband' : registration.coupleRole === 'WIFE' ? '👩 Wife' : registration.coupleRole}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-lg font-mono text-gray-700">
                    {communityId}
                  </TableCell>
                  <TableCell>
                    {getRegistrationTypeBadge(registration.registrationType)}
                  </TableCell>
                  <TableCell className="text-lg">
                    <div className="space-y-1">
                      {email !== '-' && <div className="text-gray-700">{email}</div>}
                      {phone !== '-' && <div className="text-gray-700">{phone}</div>}
                      {email === '-' && phone === '-' && <span className="text-gray-400">-</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getPaymentStatusBadge(registration.paymentStatus)}
                  </TableCell>
                  <TableCell className="text-lg text-gray-700">
                    {registration.paymentAmount
                      ? `₱${Number(registration.paymentAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-lg">
                    {registration.roomAssignment ? (
                      <Badge className="bg-cyan-100 text-cyan-800">
                        {registration.roomAssignment}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white">
                        {onUpdatePayment && (
                          <DropdownMenuItem
                            onClick={() => onUpdatePayment(registration)}
                            className="cursor-pointer"
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Update Payment
                          </DropdownMenuItem>
                        )}
                        {onAssignRoom && (
                          <DropdownMenuItem
                            onClick={() => onAssignRoom(registration)}
                            className="cursor-pointer"
                          >
                            <Home className="w-4 h-4 mr-2" />
                            Assign Room
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(registration)}
                            disabled={deletingId === registration.id}
                            className="cursor-pointer text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deletingId === registration.id ? 'Deleting...' : 'Delete'}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

