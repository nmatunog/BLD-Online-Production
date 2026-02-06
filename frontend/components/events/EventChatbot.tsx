'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { MessageSquare, X, Sparkles, Loader2, ArrowLeft, Pencil } from 'lucide-react';
import ChatMessage from '../chatbot/ChatMessage';
import ChatInput from '../chatbot/ChatInput';
import { eventChatbotService, type EventChatMessage } from '@/services/event-chatbot-service';
import { eventsService } from '@/services/events.service';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EventChatbotProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EventChatbot({ onClose, onSuccess }: EventChatbotProps) {
  const [messages, setMessages] = useState<EventChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [eventComplete, setEventComplete] = useState(false);
  const [editPrefill, setEditPrefill] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      const greeting = eventChatbotService.getGreeting();
      setMessages([greeting]);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleEdit = (botMessageIndex: number, editStep: string, editUserValue: string) => {
    if (eventComplete || isProcessing) return;
    const userMessageIndex = botMessageIndex - 1;
    if (userMessageIndex < 0) return;
    eventChatbotService.goBackToStep(editStep);
    setMessages((prev) => prev.slice(0, userMessageIndex));
    setEditPrefill(editUserValue);
  };

  const handleSendMessage = async (userInput: string) => {
    if (isProcessing || eventComplete) {
      console.log('Input blocked - isProcessing:', isProcessing, 'eventComplete:', eventComplete);
      return;
    }

    setEditPrefill(null);

    setIsProcessing(true);

    const userMessage: EventChatMessage = {
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsTyping(true);

    try {
      const response = await eventChatbotService.processMessage(userInput);

      setIsTyping(false);
      setIsProcessing(false); // Re-enable input after processing

      setMessages((prev) => [...prev, response]);

      if (response.eventComplete && response.eventData) {
        // Don't disable input here, let completeEventCreation handle it
        try {
          await completeEventCreation(response.eventData);
        } catch (error) {
          console.error('Error in completeEventCreation:', error);
          setIsProcessing(false); // Re-enable input on error
          const errorMessage = {
            role: 'bot' as const,
            content: `Sorry, I encountered an error while creating your event: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or use the form instead.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
        return;
      }
    } catch (error) {
      setIsTyping(false);
      setIsProcessing(false); // Always re-enable input on error
      console.error('Error processing message:', error);
      
      // Prevent crash by ensuring error is handled
      let errorMsg = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      
      const errorMessage = {
        role: 'bot' as const,
        content: `Sorry, I encountered an error: ${errorMsg}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const completeEventCreation = async (eventData: {
    title: string;
    eventType: string;
    category: string;
    description?: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    location: string;
    venue?: string;
    status?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
    hasRegistration?: boolean;
    registrationFee?: number;
    maxParticipants?: number;
    isRecurring?: boolean;
    recurrencePattern?: string;
    recurrenceDays?: string[];
    recurrenceInterval?: number;
  }) => {
    setIsProcessing(true);

    try {
      // Validate required fields
      if (!eventData.title || !eventData.category || !eventData.startDate || !eventData.endDate || !eventData.location) {
        throw new Error('Missing required fields: title, category, startDate, endDate, or location');
      }

      // Clean up the data - remove any undefined values and ensure proper types
      const cleanData: any = {
        title: eventData.title,
        eventType: eventData.eventType || 'NON_RECURRING',
        category: eventData.category,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        location: eventData.location,
        status: eventData.status || 'UPCOMING',
        hasRegistration: eventData.hasRegistration || false,
      };

      // Add optional fields only if they exist
      if (eventData.description) cleanData.description = eventData.description;
      if (eventData.startTime) cleanData.startTime = eventData.startTime;
      if (eventData.endTime) cleanData.endTime = eventData.endTime;
      if (eventData.venue) cleanData.venue = eventData.venue;
      if (eventData.registrationFee !== undefined) cleanData.registrationFee = eventData.registrationFee;
      if (eventData.maxParticipants !== undefined) cleanData.maxParticipants = eventData.maxParticipants;

      // Add recurring fields if it's a recurring event
      if (eventData.isRecurring) {
        cleanData.isRecurring = true;
        cleanData.recurrencePattern = eventData.recurrencePattern || 'weekly';
        cleanData.recurrenceDays = eventData.recurrenceDays || [];
        cleanData.recurrenceInterval = eventData.recurrenceInterval || 1;
      } else {
        cleanData.isRecurring = false;
      }

      console.log('Creating event with data:', cleanData);

      const result = await eventsService.create(cleanData);

      if (result.success) {
        setEventComplete(true);
        
        const successMessage = {
          role: 'bot' as const,
          content: `🎉 Event created successfully! "${eventData.title}" has been added to your events list.\n\nYou can close this chat and see your event in the events list.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMessage]);

        toast.success('✅ Event Created!', {
          description: `"${eventData.title}" has been created successfully.`,
        });

        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(result.error || 'Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      
      // Extract error message from API response if available
      let errorMessage = 'Failed to create event';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as { response?: { data?: { error?: string; message?: string } } };
        errorMessage = apiError.response?.data?.error || apiError.response?.data?.message || errorMessage;
      }
      
      toast.error('Event Creation Failed', {
        description: errorMessage,
        duration: 6000,
      });

      const errorMsg = {
        role: 'bot' as const,
        content: `Sorry, I couldn't create your event: ${errorMessage}\n\nPlease check the console for more details or try using the form instead.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 overflow-hidden">
      {/* Mobile: Full screen overlay with backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 md:bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Chat Container - Mobile: Full screen, Desktop: Fixed size with max-height */}
      <div 
        className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full h-full md:w-[500px] md:max-w-[90vw] md:h-[85vh] md:max-h-[700px] flex flex-col border-0 md:border-2 border-gray-300 relative z-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Light mode, larger touch targets, prominent close button */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-4 md:px-4 md:py-4 rounded-t-none md:rounded-t-lg flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3 md:gap-2 flex-1 min-w-0">
            <Sparkles className="w-6 h-6 md:w-5 md:h-5 flex-shrink-0" />
            <h3 className="font-bold text-xl md:text-lg truncate">Event Creation Assistant</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mobile: Back button */}
            <Button
              onClick={onClose}
              variant="ghost"
              className="md:hidden hover:bg-red-500 h-10 px-4 text-white font-semibold touch-manipulation"
              aria-label="Back to Events"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </Button>
            {/* Desktop: Close button */}
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="hidden md:flex hover:bg-red-500 h-10 w-10 touch-manipulation"
              aria-label="Close chatbot"
            >
              <X className="h-5 w-5" />
            </Button>
            {/* Mobile: X button */}
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="md:hidden hover:bg-red-500 h-10 w-10 touch-manipulation"
              aria-label="Close chatbot"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Messages - Larger padding, better spacing, safe area for mobile */}
        <div className="flex-1 overflow-y-auto px-4 md:px-4 py-4 md:py-4 space-y-4 md:space-y-2 bg-white min-h-0">
          {messages.map((msg, idx) => (
            <Fragment key={idx}>
              <ChatMessage message={msg} />
              {msg.role === 'bot' && msg.editStep != null && (
                <div className="flex justify-start -mt-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-gray-600 border-gray-300 hover:bg-gray-50"
                    onClick={() => handleEdit(idx, msg.editStep!, msg.editUserValue ?? '')}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Edit
                  </Button>
                </div>
              )}
            </Fragment>
          ))}

          {isTyping && (
            <div className="flex items-center space-x-3 md:space-x-2 text-gray-600 py-2">
              <div className="w-4 h-4 md:w-3 md:h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-4 h-4 md:w-3 md:h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-4 h-4 md:w-3 md:h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - Fixed at bottom, safe area for mobile */}
        <div className="border-t-2 border-gray-200 bg-white p-4 pb-4">
          {eventComplete && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium mb-2">
                ✅ Event created successfully!
              </p>
              <Button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold h-12 text-lg"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Events Page
              </Button>
            </div>
          )}
          {!eventComplete && (
            <ChatInput
              onSend={handleSendMessage}
              disabled={isProcessing}
              placeholder={isProcessing ? "Processing..." : "Type your answer here..."}
              defaultValue={editPrefill ?? undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

