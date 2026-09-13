'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Users, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { eventsService, type ProgramCatalogEntry } from '@/services/events.service';
import { MINISTRIES_BY_APOSTOLATE } from '@/lib/member-constants';
import DashboardHeader from '@/components/layout/DashboardHeader';

export default function EventsNewPage() {
  const router = useRouter();

  // Community Worship
  const [cwGenerating, setCwGenerating] = useState(false);

  // WSC Dialog
  const [showWscDialog, setShowWscDialog] = useState(false);
  const [wscGenerating, setWscGenerating] = useState(false);
  const [wscForm, setWscForm] = useState({
    ministry: '',
    recurrenceDays: [] as string[],
    startTime: '19:00',
    endTime: '21:00',
    location: 'BLD Covenant Community Center',
    venue: '',
  });

  // Program Dialog
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [programCreating, setProgramCreating] = useState(false);
  const [programCatalog, setProgramCatalog] = useState<Record<string, ProgramCatalogEntry>>({});
  const [programForm, setProgramForm] = useState({
    programKey: '',
    startDate: '',
    endDate: '',
    startTime: '08:00',
    endTime: '17:00',
    serialNumber: 1,
    location: 'BLD Covenant Community Center',
    venue: '',
    classNumber: undefined as number | undefined,
  });

  // Load program catalog when opening dialog
  const handleOpenProgramDialog = async () => {
    setShowProgramDialog(true);
    if (Object.keys(programCatalog).length === 0) {
      try {
        const res = await eventsService.getProgramsCatalog();
        if (res?.success && res.data) {
          setProgramCatalog(res.data);
        }
      } catch (e) {
        toast.error('Failed to load programs catalog');
      }
    }
  };

  // Community Worship
  const handleEnsureCommunityWorship = async () => {
    if (!confirm('Generate Community Worship series and occurrences? Creates CW series if missing, generates 24 weeks of Tuesday 19:00-21:00 Manila occurrences.')) {
      return;
    }
    setCwGenerating(true);
    try {
      const res = await eventsService.ensureCommunityWorshipSeries();
      if (res?.success && res.data) {
        toast.success(
          res.message ??
            `CW ${res.data.seriesCreated ? 'series created' : 'series exists'}, ${res.data.occurrencesGenerated} occurrences generated`,
        );
        router.push('/events');
      } else {
        toast.error('CW generation failed', { description: 'Please try again.' });
      }
    } catch (e) {
      toast.error('CW generation failed', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setCwGenerating(false);
    }
  };

  // WSC
  const handleEnsureWscSeries = async () => {
    if (!wscForm.ministry.trim()) {
      toast.error('Please select a ministry');
      return;
    }
    if (wscForm.recurrenceDays.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    setWscGenerating(true);
    try {
      const res = await eventsService.ensureWscSeries(wscForm);
      if (res?.success && res.data) {
        toast.success(
          `WSC series for ${wscForm.ministry} created: ${res.data.occurrencesGenerated} occurrences generated`,
        );
        setShowWscDialog(false);
        setWscForm({
          ministry: '',
          recurrenceDays: [],
          startTime: '19:00',
          endTime: '21:00',
          location: 'BLD Covenant Community Center',
          venue: '',
        });
        router.push('/events');
      } else {
        toast.error('WSC generation failed', { description: res.error || 'Please try again.' });
      }
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || 'Unknown error';
      toast.error('WSC generation failed', { description: errorMsg });
    } finally {
      setWscGenerating(false);
    }
  };

  // Program
  const handleCreateProgram = async () => {
    if (!programForm.programKey) {
      toast.error('Please select a program');
      return;
    }
    if (!programForm.startDate || !programForm.endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    setProgramCreating(true);
    try {
      const res = await eventsService.createOneOffProgram(programForm);
      if (res?.success && res.data) {
        toast.success(`Program "${res.data.title}" created successfully`);
        setShowProgramDialog(false);
        setProgramForm({
          programKey: '',
          startDate: '',
          endDate: '',
          startTime: '08:00',
          endTime: '17:00',
          serialNumber: 1,
          location: 'BLD Covenant Community Center',
          venue: '',
          classNumber: undefined,
        });
        router.push('/events');
      } else {
        toast.error('Program creation failed', { description: res.error || 'Please try again.' });
      }
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || 'Unknown error';
      toast.error('Program creation failed', { description: errorMsg });
    } finally {
      setProgramCreating(false);
    }
  };

  const allMinistries = Object.values(MINISTRIES_BY_APOSTOLATE).flat();
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <>
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/events">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Events
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Set Up an Event</h1>
          <p className="text-gray-600 mt-2">Choose the type of event you want to create</p>
        </div>

        {/* Picker Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Community Worship Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={handleEnsureCommunityWorship}>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <Calendar className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle className="text-xl">Weekly Gathering</CardTitle>
              <CardDescription>Community Worship series</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Create the weekly Community Worship series with 24 weeks of Tuesday 19:00–21:00 occurrences.
              </p>
              <Button 
                className="w-full" 
                disabled={cwGenerating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnsureCommunityWorship();
                }}
              >
                {cwGenerating ? 'Setting up...' : 'Set up Community Worship'}
              </Button>
            </CardContent>
          </Card>

          {/* WSC Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setShowWscDialog(true)}>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Ministry Circle</CardTitle>
              <CardDescription>Word Sharing Circle</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Set up a Word Sharing Circle for a specific ministry with custom schedule.
              </p>
              <Button 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWscDialog(true);
                }}
              >
                Set up WSC
              </Button>
            </CardContent>
          </Card>

          {/* Special Program Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group" onClick={handleOpenProgramDialog}>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <Sparkles className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">Special Program</CardTitle>
              <CardDescription>Encounters, LSS, and more</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Create a one-off program from the catalog: Encounters (ME, SE, SPE, YE, FE), LSS, and more.
              </p>
              <Button 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenProgramDialog();
                }}
              >
                Create Program
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* WSC Dialog */}
        <Dialog open={showWscDialog} onOpenChange={setShowWscDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Set Up Word Sharing Circle</DialogTitle>
              <DialogDescription>
                Create a WSC series for a specific ministry. One active series per ministry.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="wsc-ministry">Ministry *</Label>
                <Select
                  value={wscForm.ministry}
                  onValueChange={(value) => setWscForm({ ...wscForm, ministry: value })}
                >
                  <SelectTrigger id="wsc-ministry">
                    <SelectValue placeholder="Select ministry" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMinistries.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recurrence Days *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {daysOfWeek.map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`wsc-day-${day}`}
                        checked={wscForm.recurrenceDays.includes(day)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setWscForm({
                              ...wscForm,
                              recurrenceDays: [...wscForm.recurrenceDays, day],
                            });
                          } else {
                            setWscForm({
                              ...wscForm,
                              recurrenceDays: wscForm.recurrenceDays.filter((d) => d !== day),
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`wsc-day-${day}`} className="cursor-pointer">
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wsc-start-time">Start Time *</Label>
                  <Input
                    id="wsc-start-time"
                    type="time"
                    value={wscForm.startTime}
                    onChange={(e) => setWscForm({ ...wscForm, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="wsc-end-time">End Time *</Label>
                  <Input
                    id="wsc-end-time"
                    type="time"
                    value={wscForm.endTime}
                    onChange={(e) => setWscForm({ ...wscForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="wsc-location">Location *</Label>
                <Input
                  id="wsc-location"
                  value={wscForm.location}
                  onChange={(e) => setWscForm({ ...wscForm, location: e.target.value })}
                  placeholder="e.g., BLD Covenant Community Center"
                />
              </div>
              <div>
                <Label htmlFor="wsc-venue">Venue</Label>
                <Input
                  id="wsc-venue"
                  value={wscForm.venue}
                  onChange={(e) => setWscForm({ ...wscForm, venue: e.target.value })}
                  placeholder="Optional: specific room or area"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleEnsureWscSeries} disabled={wscGenerating} className="flex-1">
                  {wscGenerating ? 'Creating...' : 'Create WSC Series'}
                </Button>
                <Button variant="outline" onClick={() => setShowWscDialog(false)} disabled={wscGenerating}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Program Dialog */}
        <Dialog open={showProgramDialog} onOpenChange={setShowProgramDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Special Program</DialogTitle>
              <DialogDescription>
                Choose a program from the catalog and set dates.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="program-key">Program *</Label>
                <Select
                  value={programForm.programKey}
                  onValueChange={(value) => {
                    const selected = programCatalog[value];
                    setProgramForm({
                      ...programForm,
                      programKey: value,
                      serialNumber: 1,
                      classNumber: selected?.encounterType ? 1 : undefined,
                    });
                  }}
                >
                  <SelectTrigger id="program-key">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(programCatalog).map(([key, entry]) => (
                      <SelectItem key={key} value={key}>
                        {entry.title} ({entry.durationDays} day{entry.durationDays > 1 ? 's' : ''})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {programForm.programKey && programCatalog[programForm.programKey] && (
                  <p className="text-sm text-gray-600 mt-1">
                    {programCatalog[programForm.programKey].description}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="program-start-date">Start Date *</Label>
                  <Input
                    id="program-start-date"
                    type="date"
                    value={programForm.startDate}
                    onChange={(e) => setProgramForm({ ...programForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="program-end-date">End Date *</Label>
                  <Input
                    id="program-end-date"
                    type="date"
                    value={programForm.endDate}
                    onChange={(e) => setProgramForm({ ...programForm, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="program-start-time">Start Time</Label>
                  <Input
                    id="program-start-time"
                    type="time"
                    value={programForm.startTime}
                    onChange={(e) => setProgramForm({ ...programForm, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="program-end-time">End Time</Label>
                  <Input
                    id="program-end-time"
                    type="time"
                    value={programForm.endTime}
                    onChange={(e) => setProgramForm({ ...programForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="program-serial">Serial Number</Label>
                  <Input
                    id="program-serial"
                    type="number"
                    min="1"
                    value={programForm.serialNumber}
                    onChange={(e) => setProgramForm({ ...programForm, serialNumber: parseInt(e.target.value) || 1 })}
                  />
                </div>
                {programForm.programKey && programCatalog[programForm.programKey]?.encounterType && (
                  <div>
                    <Label htmlFor="program-class">Class Number</Label>
                    <Input
                      id="program-class"
                      type="number"
                      min="1"
                      value={programForm.classNumber || 1}
                      onChange={(e) => setProgramForm({ ...programForm, classNumber: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="program-location">Location</Label>
                <Input
                  id="program-location"
                  value={programForm.location}
                  onChange={(e) => setProgramForm({ ...programForm, location: e.target.value })}
                  placeholder="e.g., BLD Covenant Community Center"
                />
              </div>
              <div>
                <Label htmlFor="program-venue">Venue</Label>
                <Input
                  id="program-venue"
                  value={programForm.venue}
                  onChange={(e) => setProgramForm({ ...programForm, venue: e.target.value })}
                  placeholder="Optional: specific room or area"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateProgram} disabled={programCreating} className="flex-1">
                  {programCreating ? 'Creating...' : 'Create Program'}
                </Button>
                <Button variant="outline" onClick={() => setShowProgramDialog(false)} disabled={programCreating}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
