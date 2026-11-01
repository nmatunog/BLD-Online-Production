'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Download, Package, RefreshCw, Search, Smartphone } from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { NfcWritePanel, type WriteTarget } from '@/components/cards/NfcWritePanel';
import {
  memberCardsService,
  type MemberCardListItem,
  type PrintReadyFilter,
  type SelectableMember,
} from '@/services/member-cards.service';
import {
  adminCardStatusLabel,
  isCardAdminRole,
  PRINTER_NFC_HELP,
  printerMemberName,
  resolveMemberMinistry,
} from '@/lib/nfc-card';
import { MISSING_PRINT_LABELS } from '@/lib/id-print';
import {
  buildPrinterCsv,
  buildPrinterWorkbook,
  downloadBytes,
  toPrinterRows,
} from '@/lib/member-card-export';
import { getErrorMessage } from '@/lib/get-error-message';
import { toast } from 'sonner';

function formatManila(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Matches the backend cap on POST /member-cards/print-pack. */
const PRINT_PACK_MAX_MEMBERS = 50;

const PRINT_FILTERS: Array<{ value: PrintReadyFilter; label: string }> = [
  { value: 'READY', label: 'Ready for ID printing' },
  { value: 'MISSING', label: 'Missing info' },
  { value: 'ALL', label: 'All' },
];

export default function MemberCardsPage() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ENCODED' | 'REVOKED'>('ALL');
  const [printFilter, setPrintFilter] = useState<PrintReadyFilter>('ALL');
  const [cards, setCards] = useState<MemberCardListItem[]>([]);
  const [members, setMembers] = useState<SelectableMember[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [printCounts, setPrintCounts] = useState({ ready: 0, missing: 0, all: 0 });
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberIndex, setMemberIndex] = useState<Record<string, SelectableMember>>({});
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [writeQueue, setWriteQueue] = useState<WriteTarget[]>([]);
  const [writeIndex, setWriteIndex] = useState(0);

  useEffect(() => {
    const authData = localStorage.getItem('authData');
    let nextRole = '';
    if (authData) {
      try {
        nextRole = JSON.parse(authData).user?.role || '';
      } catch {
        nextRole = '';
      }
    }
    setRole(nextRole);
    if (!isCardAdminRole(nextRole)) {
      router.replace('/dashboard');
    }
  }, [router]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const result = await memberCardsService.list({
        search: search || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 100,
      });
      setCards(result.data?.data ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not load cards'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const rememberMembers = useCallback((rows: SelectableMember[]) => {
    setMemberIndex((current) => {
      const next = { ...current };
      for (const member of rows) {
        next[member.id] = member;
      }
      return next;
    });
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const result = await memberCardsService.listMemberIds({
        search: search || undefined,
        printReady: printFilter,
      });
      const loaded = result.data?.members ?? [];
      setMembers(loaded);
      setMemberTotal(result.data?.total ?? loaded.length);
      setPrintCounts(result.data?.counts ?? { ready: 0, missing: 0, all: 0 });
      rememberMembers(loaded);
    } catch {
      setMembers([]);
      setMemberTotal(0);
      setPrintCounts({ ready: 0, missing: 0, all: 0 });
    }
  }, [search, printFilter, rememberMembers]);

  useEffect(() => {
    if (!isCardAdminRole(role)) return;
    void loadCards();
    void loadMembers();
  }, [role, loadCards, loadMembers]);

  const cardByMember = useMemo(() => {
    const map = new Map<string, MemberCardListItem>();
    for (const card of cards) {
      if (card.status !== 'REVOKED' && !map.has(card.memberId)) {
        map.set(card.memberId, card);
      }
    }
    return map;
  }, [cards]);

  useEffect(() => {
    setSelectedMemberIds([]);
  }, [search, printFilter]);

  const allSelected = memberTotal > 0 && selectedMemberIds.length === memberTotal;

  const toggleMember = (id: string) => {
    setSelectedMemberIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleSelectAll = async () => {
    if (allSelected) {
      setSelectedMemberIds([]);
      return;
    }
    setSelectAllLoading(true);
    try {
      const result = await memberCardsService.listMemberIds({
        search: search || undefined,
        printReady: printFilter,
      });
      const ids = result.data?.ids ?? [];
      rememberMembers(result.data?.members ?? []);
      setMemberTotal(result.data?.total ?? ids.length);
      setPrintCounts(result.data?.counts ?? printCounts);
      setSelectedMemberIds(ids);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not select all members'));
    } finally {
      setSelectAllLoading(false);
    }
  };

  const writeTargetsForSelection = (): WriteTarget[] => {
    const targets: WriteTarget[] = [];
    for (const id of selectedMemberIds) {
      const member = memberIndex[id] ?? members.find((item) => item.id === id);
      if (!member) continue;
      targets.push({
        memberId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        nickname: member.nickname,
        communityId: member.communityId,
      });
    }
    return targets;
  };

  const issueSelected = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('Select members first');
      return;
    }
    try {
      const result = await memberCardsService.issue(selectedMemberIds);
      const issued = result.data?.issued.length ?? 0;
      const skipped = result.data?.skipped.length ?? 0;
      toast.success(`Issued ${issued}. Skipped ${skipped}.`);
      await Promise.all([loadCards(), loadMembers()]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not issue cards'));
    }
  };

  const startWriteForMembers = (targets: WriteTarget[]) => {
    if (targets.length === 0) {
      toast.error('Select members first');
      return;
    }
    setWriteQueue(targets);
    setWriteIndex(0);
  };

  const currentWrite = writeQueue[writeIndex] ?? null;

  const exportPrinter = async (format: 'csv' | 'xlsx') => {
    try {
      const result = await memberCardsService.exportRows(
        selectedMemberIds.length === 0 || allSelected
          ? { all: true, search: search || undefined, printReady: printFilter }
          : { memberIds: selectedMemberIds, printReady: printFilter },
      );
      const rows = toPrinterRows(result.data ?? []);
      if (rows.length === 0) {
        toast.error('No members to export');
        return;
      }
      if (format === 'csv') {
        await downloadBytes('bld-id-print.csv', buildPrinterCsv(rows), 'text/csv;charset=utf-8');
      } else {
        await downloadBytes(
          'bld-id-print.xlsx',
          buildPrinterWorkbook(rows),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      }
      toast.success(`Exported ${rows.length} rows`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Export failed'));
    }
  };

  const downloadPrintPack = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('Select the members to include in the print pack');
      return;
    }
    if (selectedMemberIds.length > PRINT_PACK_MAX_MEMBERS) {
      toast.error(`A print pack holds up to ${PRINT_PACK_MAX_MEMBERS} members. Select fewer.`);
      return;
    }
    setPackLoading(true);
    try {
      const pack = await memberCardsService.printPack(selectedMemberIds);
      await downloadBytes(pack.filename, pack.bytes, 'application/zip');
      toast.success('Print pack downloaded. Members who are not ready are listed in skipped.csv.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not build the print pack'));
    } finally {
      setPackLoading(false);
    }
  };

  if (!isCardAdminRole(role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-black text-gray-900">
            <CreditCard className="h-8 w-8" />
            NFC Member Cards
          </h1>
          <p className="mt-2 max-w-3xl text-lg text-gray-700">{PRINTER_NFC_HELP}</p>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or Community ID"
              className="min-h-14 w-full rounded-2xl border-2 border-gray-300 bg-white pl-11 pr-3 text-lg"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
            className="min-h-14 rounded-2xl border-2 border-gray-300 bg-white px-3 text-lg"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Issued</option>
            <option value="ENCODED">Encoded</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PRINT_FILTERS.map((filter) => {
            const count =
              filter.value === 'READY'
                ? printCounts.ready
                : filter.value === 'MISSING'
                  ? printCounts.missing
                  : printCounts.all;
            const selected = printFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setPrintFilter(filter.value)}
                className={`min-h-16 rounded-2xl border-2 px-4 text-left text-lg font-bold ${
                  selected
                    ? 'border-rose-700 bg-rose-700 text-white'
                    : 'border-gray-300 bg-white text-gray-900'
                }`}
              >
                {filter.label}
                <span className={`ml-2 ${selected ? 'text-rose-100' : 'text-gray-600'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={issueSelected}
            className="min-h-14 rounded-2xl bg-slate-800 px-5 text-lg font-bold text-white"
          >
            Issue selected
          </button>
          <button
            type="button"
            onClick={() => startWriteForMembers(writeTargetsForSelection())}
            className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-rose-700 px-5 text-lg font-bold text-white"
          >
            <Smartphone className="h-5 w-5" />
            Write selected cards
          </button>
          <button
            type="button"
            onClick={() => exportPrinter('csv')}
            className="inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-gray-400 bg-white px-5 text-lg font-bold"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportPrinter('xlsx')}
            className="inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-gray-400 bg-white px-5 text-lg font-bold"
          >
            <Download className="h-5 w-5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => void downloadPrintPack()}
            disabled={packLoading}
            className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-emerald-700 px-5 text-lg font-bold text-white disabled:opacity-60"
          >
            <Package className="h-5 w-5" />
            {packLoading ? 'Building print pack…' : 'Print pack (ZIP)'}
          </button>
          <button
            type="button"
            onClick={() => {
              void loadCards();
              void loadMembers();
            }}
            className="inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 border-gray-400 bg-white px-5 text-lg font-bold"
          >
            <RefreshCw className="h-5 w-5" />
            Refresh
          </button>
        </div>

        <section className="mb-8 rounded-3xl bg-white p-4 shadow">
          <h2 className="mb-3 text-2xl font-bold">ID print list</h2>
          <label className="mb-4 flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl bg-slate-100 px-4 py-3">
            <input
              type="checkbox"
              className="h-8 w-8 shrink-0"
              checked={allSelected}
              disabled={selectAllLoading}
              onChange={() => void toggleSelectAll()}
              aria-label="Select all members in this filter"
            />
            <span className="text-xl font-bold text-gray-900">
              Select all
              <span className="ml-2 font-semibold text-gray-700">
                {selectAllLoading
                  ? 'Loading all members…'
                  : selectedMemberIds.length > 0
                    ? `${selectedMemberIds.length} selected`
                    : memberTotal > 0
                      ? `${memberTotal} members`
                      : ''}
              </span>
            </span>
          </label>
          <ul className="divide-y">
            {members.map((member) => {
              const existing = cardByMember.get(member.id);
              const missing = member.missing ?? [];
              return (
                <li key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-7 w-7 shrink-0"
                      checked={selectedMemberIds.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                      aria-label={`Select ${printerMemberName(member)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-bold">{printerMemberName(member)}</p>
                      <p className="text-lg text-gray-600">
                        {member.communityId} · {resolveMemberMinistry(member)}
                        {existing
                          ? ` · ${adminCardStatusLabel(existing.status, existing.encodedAt)}`
                          : ' · No card'}
                      </p>
                      {missing.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {missing.map((item) => (
                            <span
                              key={item}
                              className="rounded-full bg-amber-100 px-3 py-1 text-base font-semibold text-amber-950"
                            >
                              {MISSING_PRINT_LABELS[item]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-base font-semibold text-emerald-800">Ready for ID printing</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      startWriteForMembers([
                        {
                          memberId: member.id,
                          firstName: member.firstName,
                          lastName: member.lastName,
                          nickname: member.nickname,
                          communityId: member.communityId,
                        },
                      ])
                    }
                    className="min-h-12 rounded-xl bg-rose-700 px-3 text-base font-bold text-white"
                  >
                    Write to card
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="overflow-x-auto rounded-3xl bg-white p-4 shadow">
          <h2 className="mb-3 text-2xl font-bold">Card status</h2>
          {loading ? (
            <p className="py-8 text-lg">Loading cards…</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-base">
              <thead>
                <tr className="border-b text-gray-600">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Community ID</th>
                  <th className="py-2 pr-3">Ministry</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Issued</th>
                  <th className="py-2 pr-3">Last verified</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-semibold">
                      {printerMemberName(card.member)}
                    </td>
                    <td className="py-3 pr-3">{card.member.communityId}</td>
                    <td className="py-3 pr-3">{resolveMemberMinistry(card.member)}</td>
                    <td className="py-3 pr-3">
                      {adminCardStatusLabel(card.status, card.encodedAt)}
                    </td>
                    <td className="py-3 pr-3">{formatManila(card.issuedAt)}</td>
                    <td className="py-3 pr-3">{formatManila(card.lastVerifiedAt)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {card.status !== 'REVOKED' ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                startWriteForMembers([
                                  {
                                    memberId: card.memberId,
                                    firstName: card.member.firstName,
                                    lastName: card.member.lastName,
                                    nickname: card.member.nickname,
                                    communityId: card.member.communityId,
                                  },
                                ])
                              }
                              className="min-h-11 rounded-lg bg-rose-700 px-3 font-bold text-white"
                            >
                              Write
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm('Revoke this card now? It will stop working immediately.')) {
                                  return;
                                }
                                await memberCardsService.revoke(card.id);
                                toast.success('Card revoked');
                                await Promise.all([loadCards(), loadMembers()]);
                              }}
                              className="min-h-11 rounded-lg bg-red-600 px-3 font-bold text-white"
                            >
                              Revoke
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm('Reissue this card? The old tag will stop working.')) {
                                  return;
                                }
                                await memberCardsService.reissue(card.id);
                                toast.success('Card reissued. Write the new token to a card.');
                                await Promise.all([loadCards(), loadMembers()]);
                              }}
                              className="min-h-11 rounded-lg border-2 border-gray-400 px-3 font-bold"
                            >
                              Reissue
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      {currentWrite ? (
        <NfcWritePanel
          target={currentWrite}
          indexLabel={
            writeQueue.length > 1 ? `Card ${writeIndex + 1} of ${writeQueue.length}` : undefined
          }
          onCancel={() => {
            setWriteQueue([]);
            setWriteIndex(0);
          }}
          onFinished={async (result) => {
            if (result === 'success') {
              toast.success(`Encoded card for ${printerMemberName(currentWrite)}`);
            } else if (result === 'failed') {
              toast.error(`Could not encode card for ${printerMemberName(currentWrite)}`);
            }
            await Promise.all([loadCards(), loadMembers()]);
            if (writeIndex + 1 >= writeQueue.length) {
              setWriteQueue([]);
              setWriteIndex(0);
              return;
            }
            setWriteIndex((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}
