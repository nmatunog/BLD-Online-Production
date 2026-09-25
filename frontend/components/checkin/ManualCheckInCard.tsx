/**
 * ManualCheckInCard - Manual Community ID input with "Can't scan?" expansion
 * Used in staff check-in flows as secondary option
 */

'use client';

import { useState } from 'react';
import { Search, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ManualCheckInCardProps {
  onCheckIn: (communityId: string) => Promise<void>;
  onSearch?: (firstName: string, lastName: string) => Promise<Array<{ id: string; name: string; communityId: string }>>;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ManualCheckInCard({
  onCheckIn,
  onSearch,
  loading = false,
  disabled = false,
  className = ''
}: ManualCheckInCardProps) {
  const [showManualInput, setShowManualInput] = useState(false);
  const [communityId, setCommunityId] = useState('');
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; communityId: string }>>([]);
  const [searching, setSearching] = useState(false);

  const handleManualCheckIn = async () => {
    const input = communityId.trim().toUpperCase();
    if (!input) {
      return;
    }
    await onCheckIn(input);
    setCommunityId('');
    setSearchResults([]);
  };

  const handleSearch = async () => {
    if (!onSearch || (!searchFirstName.trim() && !searchLastName.trim())) {
      return;
    }

    setSearching(true);
    try {
      const results = await onSearch(searchFirstName, searchLastName);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card className={`bg-white border-2 border-gray-300 shadow-sm ${className}`}>
      <CardHeader>
        <CardTitle className="text-[1.375rem] flex items-center gap-2 text-gray-900">
          <Search className="w-6 h-6 text-green-800" />
          Manual Check-In
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showManualInput ? (
          <Button
            onClick={() => setShowManualInput(true)}
            variant="outline"
            className="w-full min-h-12 text-[1.125rem] font-semibold border-2 border-green-800 text-green-900 hover:bg-green-50"
            disabled={disabled}
          >
            Can&apos;t scan? Enter Community ID
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="communityId" className="text-[1.125rem] font-semibold text-gray-900">
                Community ID
              </Label>
              <Input
                id="communityId"
                placeholder="CEB-ME1801"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value.toUpperCase())}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualCheckIn();
                  }
                }}
                className="h-14 text-[1.25rem] font-mono border-2 border-gray-400 bg-white text-gray-900"
                disabled={loading || disabled}
              />
              <Button
                onClick={handleManualCheckIn}
                disabled={loading || disabled || !communityId.trim()}
                className="w-full min-h-14 text-[1.25rem] font-semibold bg-green-700 hover:bg-green-800 text-white"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Check In
              </Button>
            </div>

            {onSearch && (
              <div className="space-y-2 pt-4 border-t-2 border-gray-300">
                <Label className="text-[1.125rem] font-semibold text-gray-900">Or search by name</Label>
                <div className="grid grid-cols-1 gap-2">
                  <Input
                    placeholder="First name"
                    value={searchFirstName}
                    onChange={(e) => setSearchFirstName(e.target.value)}
                    className="h-12 text-[1.125rem] border-2 border-gray-400"
                    disabled={loading || searching || disabled}
                  />
                  <Input
                    placeholder="Last name"
                    value={searchLastName}
                    onChange={(e) => setSearchLastName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    className="h-12 text-[1.125rem] border-2 border-gray-400"
                    disabled={loading || searching || disabled}
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={loading || searching || disabled || (!searchFirstName.trim() && !searchLastName.trim())}
                  className="w-full min-h-12 text-[1.125rem] font-semibold bg-rose-800 hover:bg-rose-900 text-white"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Searching…
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Search by name
                    </>
                  )}
                </Button>

                {searchResults.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-[1.125rem] font-semibold text-gray-900">Results ({searchResults.length})</p>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {searchResults.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            setCommunityId(member.communityId);
                            setSearchResults([]);
                            handleManualCheckIn();
                          }}
                          className="w-full text-left p-4 rounded-xl border-2 border-gray-300 bg-white hover:bg-rose-50 hover:border-rose-700 transition min-h-14"
                        >
                          <p className="text-[1.375rem] font-bold text-gray-900">{member.name}</p>
                          <p className="text-[1.25rem] text-gray-900 font-mono font-semibold">{member.communityId}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={() => {
                setShowManualInput(false);
                setCommunityId('');
                setSearchResults([]);
              }}
              variant="ghost"
              className="w-full min-h-12 text-[1.125rem] font-semibold text-gray-900"
              disabled={disabled}
            >
              Hide manual input
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
