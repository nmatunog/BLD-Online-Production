'use client';

import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { MessageSquare, X, CheckCircle } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { eventsService, type Event } from '@/services/events.service';
import { attendanceService } from '@/services/attendance.service';
import { membersService } from '@/services/members.service';
import { isOngoingForDisplay, canCheckInToEvent } from '@/lib/event-checkin-window';

const EVENT_TYPES = [
  { key: 'Community Worship', label: 'Community Worship', short: '1' },
  { key: 'Word Sharing Circle', label: 'Word Sharing Circle (WSC)', short: '2' },
  { key: 'Growth Seminar', label: 'Growth Seminar', short: '3' },
] as const;

export interface CheckInChatbotHandle {
  open: () => void;
  close: () => void;
}

interface CheckInChatbotProps {
  onClose?: () => void;
  onCheckInSuccess?: () => void;
}

function parseDateInput(input: string): Date | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;
  const match = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (match) {
    const [, m, day, y] = match;
    const year = y ? (y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10)) : new Date().getFullYear();
    const month = parseInt(m!, 10) - 1;
    const d2 = new Date(year, month, parseInt(day!, 10));
    if (!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}

function formatEventDate(e: Event): string {
  try {
    const d = new Date(e.startDate);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = e.startTime
      ? (() => {
          const [h, m] = e.startTime.split(':');
          const hour = parseInt(h, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour % 12 || 12;
          return ` at ${displayHour}:${m} ${ampm}`;
        })()
      : '';
    return `${dateStr}${timeStr}`;
  } catch {
    return e.startDate;
  }
}

const CheckInChatbot = forwardRef<CheckInChatbotHandle, CheckInChatbotProps>(
  ({ onClose, onCheckInSuccess }, ref) => {
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'bot'; content: string; timestamp: Date }>>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState<'choose_type' | 'choose_date' | 'confirm' | 'done'>('choose_type');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [ongoingEvents, setOngoingEvents] = useState<Event[]>([]);
    const [searchResults, setSearchResults] = useState<Event[]>([]);
    const [pendingEvent, setPendingEvent] = useState<Event | null>(null);
    const [currentMember, setCurrentMember] = useState<{ id: string; communityId: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const addBot = (content: string) => {
      setMessages((prev) => [...prev, { role: 'bot', content, timestamp: new Date() }]);
    };

    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const loadMember = async () => {
      try {
        const m = await membersService.getMe();
        if (m?.id && m?.communityId) {
          setCurrentMember({ id: m.id, communityId: m.communityId });
          return m;
        }
      } catch {
        // ignore
      }
      return null;
    };

    const open = () => {
      setStep('choose_type');
      setSelectedCategory(null);
      setOngoingEvents([]);
      setSearchResults([]);
      setPendingEvent(null);
      setIsOpen(true);
      setMessages([
        {
          role: 'bot',
          content: "Hi! I can help you check in.\n\nWhich type of event?\n1. Community Worship\n2. Word Sharing Circle (WSC)\n3. Growth Seminar\n\nReply with the number or name.",
          timestamp: new Date(),
        },
      ]);
      loadMember();
    };

    const handleClose = () => {
      setMessages([]);
      setStep('choose_type');
      setSelectedCategory(null);
      setOngoingEvents([]);
      setSearchResults([]);
      setPendingEvent(null);
      setIsOpen(false);
      onClose?.();
    };

    useImperativeHandle(ref, () => ({ open, close: handleClose }), []);

    const resolveEventType = (input: string): string | null => {
      const t = input.trim();
      const lower = t.toLowerCase();
      if (lower === '1' || lower === 'community worship' || lower === 'cw') return 'Community Worship';
      if (lower === '2' || lower === 'word sharing circle' || lower === 'wsc') return 'Word Sharing Circle';
      if (lower === '3' || lower === 'growth seminar' || lower === 'gs') return 'Growth Seminar';
      return null;
    };

    const handleChooseType = (userInput: string) => {
      const category = resolveEventType(userInput);
      if (!category) {
        addBot("I didn't catch that. Please reply with 1 (Community Worship), 2 (WSC), or 3 (Growth Seminar).");
        return;
      }
      setSelectedCategory(category);
      setStep('choose_date');
      addBot(
        `Got it — ${category}.\n\nWhat date is the event? You can:\n• Type a date (e.g. Feb 15 or 2/15)\n• Type "ongoing" to see ongoing events for this type`
      );
    };

    const fetchOngoingForCategory = async (category: string) => {
      const [ongoingRes, completedRes] = await Promise.all([
        eventsService.getAll({ status: 'ONGOING', sortBy: 'startDate', sortOrder: 'asc', limit: 20 }),
        eventsService.getAll({ status: 'COMPLETED', sortBy: 'startDate', sortOrder: 'desc', limit: 20 }),
      ]);
      const ongoing = (ongoingRes.success && ongoingRes.data?.data && Array.isArray(ongoingRes.data.data)) ? ongoingRes.data.data : [];
      const completed = (completedRes.success && completedRes.data?.data && Array.isArray(completedRes.data.data)) ? completedRes.data.data : [];
      const all = [...ongoing, ...completed];
      const filtered = all.filter((e) => {
        const cat = e.category === 'Corporate Worship' || e.category === 'Corporate Worship (Weekly Recurring)' ? 'Community Worship' : e.category;
        return cat === category && (e.isRecurring || isOngoingForDisplay(e));
      });
      const deduped = Array.from(new Map(filtered.map((e) => [e.id, e])).values());
      return deduped.slice(0, 10);
    };

    const searchEventsByDate = async (category: string, date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const dayStart = `${y}-${m}-${d}`;
      const dayEnd = dayStart;
      const res = await eventsService.getAll({
        category,
        startDateFrom: dayStart,
        startDateTo: dayEnd,
        sortBy: 'startDate',
        sortOrder: 'asc',
        limit: 20,
      });
      const list = res.success && res.data?.data && Array.isArray(res.data.data) ? res.data.data : [];
      const normalized = list.filter((e) => {
        const cat = e.category === 'Corporate Worship' || e.category === 'Corporate Worship (Weekly Recurring)' ? 'Community Worship' : e.category;
        return cat === category;
      });
      return normalized;
    };

    const handleChooseDate = async (userInput: string) => {
      if (!selectedCategory) return;
      const trimmed = userInput.trim().toLowerCase();
      if (trimmed === 'ongoing' || trimmed === 'ongoing events') {
        setIsTyping(true);
        try {
          const events = await fetchOngoingForCategory(selectedCategory);
          setOngoingEvents(events);
          if (events.length === 0) {
            addBot(`No ongoing events found for ${selectedCategory} right now. Try typing a specific date (e.g. Feb 15).`);
          } else {
            const lines = events.slice(0, 5).map((e, i) => `${i + 1}. ${e.title} — ${formatEventDate(e)}`);
            addBot(`Here are ongoing/recent ${selectedCategory} events:\n\n${lines.join('\n')}\n\nReply with the number (1–${Math.min(5, events.length)}) to check in, or type a date to search.`);
          }
        } catch {
          addBot("Sorry, I couldn't load events. Please try again or type a date.");
        }
        setIsTyping(false);
        return;
      }
      const date = parseDateInput(userInput);
      if (date) {
        setIsTyping(true);
        try {
          const events = await searchEventsByDate(selectedCategory, date);
          setSearchResults(events);
          if (events.length === 0) {
            addBot(`No ${selectedCategory} events found on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Try "ongoing" to see current events.`);
          } else if (events.length === 1) {
            setPendingEvent(events[0]);
            setStep('confirm');
            addBot(`Found: ${events[0].title} on ${formatEventDate(events[0])}.\n\nReply Yes to check in, or No to cancel.`);
          } else {
            const lines = events.slice(0, 5).map((e, i) => `${i + 1}. ${e.title} — ${formatEventDate(e)}`);
            addBot(`I found ${events.length} event(s). Please confirm which one:\n\n${lines.join('\n')}\n\nReply with the number (1–${Math.min(5, events.length)}) to check in.`);
            setSearchResults(events);
          }
        } catch {
          addBot("Sorry, I couldn't search events. Please try again.");
        }
        setIsTyping(false);
        return;
      }
      if (ongoingEvents.length > 0) {
        const num = parseInt(trimmed, 10);
          if (num >= 1 && num <= ongoingEvents.length) {
          const event = ongoingEvents[num - 1];
          setPendingEvent(event);
          setStep('confirm');
          addBot(`${event.title} — ${formatEventDate(event)}.\n\nReply Yes to check in, or No to cancel.`);
          return;
        }
      }
      if (searchResults.length > 0) {
        const num = parseInt(trimmed, 10);
        if (num >= 1 && num <= searchResults.length) {
          const event = searchResults[num - 1];
          setPendingEvent(event);
          setStep('confirm');
          addBot(`${event.title} — ${formatEventDate(event)}.\n\nReply Yes to check in, or No to cancel.`);
          return;
        }
      }
      addBot('Please type a date (e.g. Feb 15), type "ongoing", or reply with a number from the list.');
    };

    const performCheckIn = async (event: Event) => {
      const member = currentMember || (await loadMember());
      if (!member?.communityId) {
        toast.error('Could not load your profile. Please try again.');
        addBot("I couldn't load your profile. Please refresh the page and try again.");
        return false;
      }
      if (!canCheckInToEvent(event)) {
        addBot(`Check-in is not available for this event (outside check-in window or already ended).`);
        return false;
      }
      try {
        const result = await attendanceService.checkIn({
          communityId: member.communityId,
          eventId: event.id,
          method: 'QR_CODE',
        });
        if (result.success) {
          setStep('done');
          addBot("You are checked in!");
          toast.success('You are checked in!');
          onCheckInSuccess?.();
          return true;
        }
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'response' in err && (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
        const str = Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : 'Check-in failed. Please try again.';
        addBot(`Sorry, check-in failed: ${str}`);
        toast.error(str);
      }
      return false;
    };

    const handleConfirm = async (userInput: string) => {
      const reply = userInput.trim().toLowerCase();
      if (reply === 'no' || reply === 'cancel') {
        setPendingEvent(null);
        setStep('choose_date');
        setSearchResults([]);
        setOngoingEvents([]);
        addBot('Cancelled. What date is the event? Type a date or "ongoing".');
        return;
      }
      if (reply === 'yes' || reply === 'y') {
        if (!pendingEvent) {
          addBot('No event selected. Type a date or "ongoing" to choose an event.');
          return;
        }
        setIsProcessing(true);
        const ok = await performCheckIn(pendingEvent);
        setIsProcessing(false);
        if (ok) {
          setPendingEvent(null);
          setSearchResults([]);
          setOngoingEvents([]);
        }
        return;
      }
      addBot('Reply Yes to check in or No to cancel.');
    };

    const handleSendMessage = async (userInput: string) => {
      if (isProcessing) return;
      const userMessage = { role: 'user' as const, content: userInput, timestamp: new Date() };
      setMessages((prev) => [...prev, userMessage]);

      if (step === 'choose_type') {
        handleChooseType(userInput);
        return;
      }
      if (step === 'choose_date') {
        await handleChooseDate(userInput);
        return;
      }
      if (step === 'confirm') {
        await handleConfirm(userInput);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 md:inset-auto md:bottom-4 md:right-4 md:top-auto z-50 flex items-center justify-center p-0 md:p-4 overflow-hidden">
        <div className="fixed inset-0 bg-black/30 md:hidden" onClick={handleClose} aria-hidden="true" />
        <div
          ref={chatContainerRef}
          className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:w-[500px] md:max-w-[90vw] md:h-[85vh] md:max-h-[700px] flex flex-col border-0 md:border-2 border-gray-300 relative overflow-hidden"
        >
          <div className="bg-green-600 text-white px-6 py-5 md:px-4 md:py-4 rounded-t-none md:rounded-t-lg flex justify-between items-center">
            <h3 className="font-bold text-2xl md:text-xl">Check-In Assistant</h3>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="icon"
              className="hover:bg-green-500 h-12 w-12 md:h-10 md:w-10 text-white"
              aria-label="Close"
            >
              <X className="h-7 w-7 md:h-5 md:w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))}
            {isTyping && (
              <div className="flex items-center space-x-2 text-gray-600 py-2">
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {!step.startsWith('done') && (
            <ChatInput
              onSend={handleSendMessage}
              disabled={isProcessing || isTyping}
              placeholder={step === 'confirm' ? 'Yes / No' : 'Type your reply...'}
            />
          )}
          {step === 'done' && (
            <div className="px-4 pb-4 pt-2 border-t-2 border-gray-200 bg-green-50 flex items-center justify-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <span className="font-semibold text-green-800">You are checked in!</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

CheckInChatbot.displayName = 'CheckInChatbot';
export default CheckInChatbot;
