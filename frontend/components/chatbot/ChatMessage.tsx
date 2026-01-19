'use client';

interface ChatMessageProps {
  message: {
    role: 'user' | 'bot';
    content: string;
    timestamp?: Date | string;
  };
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isBot = message.role === 'bot';

  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-5 md:mb-4`}>
      <div className={`flex ${isBot ? 'flex-row' : 'flex-row-reverse'} items-start max-w-[85%] md:max-w-[80%] gap-3 md:gap-2`}>
        {isBot && (
          <div className="flex-shrink-0 w-12 h-12 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl md:text-lg font-semibold">
            🤖
          </div>
        )}
        <div
          className={`rounded-xl md:rounded-lg px-5 py-4 md:px-4 md:py-3 shadow-md ${
            isBot 
              ? 'bg-gray-100 text-gray-900 border-2 border-gray-200' 
              : 'bg-blue-600 text-white border-2 border-blue-700'
          }`}
        >
          <p className="text-lg md:text-base leading-relaxed md:leading-normal whitespace-pre-wrap font-medium md:font-normal">
            {message.content}
          </p>
          {message.timestamp && (
            <span className={`text-sm md:text-xs mt-2 md:mt-1 block font-medium ${
              isBot ? 'text-gray-600' : 'text-blue-100'
            }`}>
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        {!isBot && (
          <div className="flex-shrink-0 w-12 h-12 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl md:text-lg font-semibold">
            👤
          </div>
        )}
      </div>
    </div>
  );
}

