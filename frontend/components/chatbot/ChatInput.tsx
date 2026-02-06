'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Pre-fill input (e.g. when editing a previous answer) */
  defaultValue?: string;
}

export default function ChatInput({ onSend, disabled = false, placeholder = 'Type your message...', defaultValue }: ChatInputProps) {
  const [input, setInput] = useState(defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultValue !== undefined && defaultValue !== null) {
      setInput(defaultValue);
    }
  }, [defaultValue]);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t-2 border-gray-300 p-4 md:p-4 bg-white">
      <div className="flex gap-3 md:gap-2 items-center">
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            if (!disabled) {
              setInput(e.target.value);
            }
          }}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={disabled}
          className="flex-1 text-lg md:text-base h-14 md:h-10 px-5 md:px-3 border-2 border-gray-400 focus:border-purple-600 rounded-xl md:rounded-md font-medium md:font-normal bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{ fontSize: '18px' }}
          autoFocus={!disabled}
        />
        <Button 
          type="submit" 
          disabled={disabled || !input.trim()} 
          size="icon"
          className="h-14 w-14 md:h-10 md:w-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl md:rounded-md touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-7 w-7 md:h-5 md:w-5" />
        </Button>
      </div>
    </form>
  );
}

