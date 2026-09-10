/**
 * ManualCheckInCard - Manual Community ID input with "Can't scan?" expansion
 * Used in staff check-in flows as secondary option
 */

'use client';

import { useState } from 'react';
import { Search, CheckCircle, Loader2, UserCheck } from 'lucide-react';
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
    <Card className={`bg-white border-green-200 shadow-sm ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="w-5 h-5 text-green-600" />
          Manual Check-In
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showManualInput ? (
          <Button
            onClick={() => setShowManualInput(true)}
            variant="outline"
            className="w-full min-h-[48px] text-base border-2 border-green-300 text-green-700 hover:bg-green-50"
            disabled={disabled}
          >
            Can&apos;t scan? Enter Community ID
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Community ID Input */}
            <div className="space-y-2">
              <Label htmlFor="communityId" className="text-sm font-semibold text-gray-900">
                Community ID
              </Label>
              <div className="flex gap-2">
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
                  className="h-12 text-base font-mono border-2 border-gray-300 bg-white"
                  disabled={loading || disabled}
                />
                <Button
                  onClick={handleManualCheckIn}
                  disabled={loading || disabled || !communityId.trim()}
                  className="h-12 px-4 bg-green-600 hover:bg-green-700 text-white min-w-[56px]"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Enter Community ID and press Enter or click check</p>
            </div>

            {/* Name Search */}
            {onSearch && (
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <Label className="text-sm font-semibold text-gray-900">Or search by name</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First Name"
                    value={searchFirstName}
                    onChange={(e) => setSearchFirstName(e.target.value)}
                    className="h-10 text-sm border-2"
                    disabled={loading || searching || disabled}
                  />
                  <Input
                    placeholder="Last Name"
                    value={searchLastName}
                    onChange={(e) => setSearchLastName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                    className="h-10 text-sm border-2"
                    disabled={loading || searching || disabled}
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={loading || searching || disabled || (!searchFirstName.trim() && !searchLastName.trim())}
                  className="w-full h-10 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search Members
                    </>
                  )}
                </Button>

                {searchResults.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs font-semibold text-gray-700 uppercase">Results ({searchResults.length}):</p>
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                      {searchResults.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            setCommunityId(member.communityId);
                            setSearchResults([]);
                            handleManualCheckIn();
                          }}
                          className="w-full text-left p-2 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition"
                        >
                          <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-600 font-mono">{member.communityId}</p>
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
              className="w-full text-sm"
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
