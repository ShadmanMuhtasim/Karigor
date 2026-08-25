import React, { useEffect, useRef, useState } from 'react';
import { messagingApi, type MessageDto } from '../../api/messagingApi';
import { signalRService } from '../../services/signalrService';
import { useAuth } from '../../context/AuthContext';

interface ChatBoxProps {
  bookingId: number;
  otherPartyName: string;
  otherPartyRole: string;
  categoryName?: string;
  onClose?: () => void;
}

export function ChatBox({
  bookingId,
  otherPartyName,
  otherPartyRole,
  categoryName,
  onClose,
}: ChatBoxProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    loadMessages();
    signalRService.joinBooking(bookingId);

    // Subscribe to new incoming messages via SignalR
    const unsubMessage = signalRService.onMessage((newMsg) => {
      const msgBookingId = newMsg.bookingId ?? (newMsg as any).BookingId;
      if (msgBookingId === bookingId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMsg.id);
          if (exists) return prev;
          const isMine = newMsg.senderId === user?.userId;
          return [...prev, { ...newMsg, isMine }];
        });
        scrollToBottom();
      }
    });

    // Subscribe to typing indicators
    const unsubTyping = signalRService.onTyping((data) => {
      const dataBookingId = data.bookingId ?? (data as any).BookingId;
      if (dataBookingId === bookingId && data.userId !== user?.userId) {
        setOtherUserTyping(data.isTyping);
      }
    });

    // Backup polling every 5s in case of connection latency
    const interval = setInterval(() => {
      messagingApi.getBookingMessages(bookingId).then((data) => {
        setMessages((prev) => {
          if (data.length !== prev.length) {
            return data.map((m) => ({
              ...m,
              isMine: m.senderId === user?.userId || m.isMine,
            }));
          }
          return prev;
        });
      }).catch(() => {});
    }, 5000);

    return () => {
      unsubMessage();
      unsubTyping();
      clearInterval(interval);
      signalRService.leaveBooking(bookingId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [bookingId, user?.userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, otherUserTyping]);

  async function loadMessages() {
    setLoading(true);
    try {
      const data = await messagingApi.getBookingMessages(bookingId);
      setMessages(
        data.map((m) => ({
          ...m,
          isMine: m.senderId === user?.userId || m.isMine,
        }))
      );
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setLoading(false);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputMessage(e.target.value);
    setSendError(null);
    signalRService.sendTyping(bookingId, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      signalRService.sendTyping(bookingId, false);
    }, 2000);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const content = inputMessage.trim();
    setInputMessage('');
    setSendError(null);
    signalRService.sendTyping(bookingId, false);
    setSending(true);

    try {
      const sentMsg = await messagingApi.sendMessage({
        bookingId,
        content,
      });

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === sentMsg.id);
        if (exists) return prev;
        return [...prev, { ...sentMsg, isMine: true }];
      });
      scrollToBottom();
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || 'Could not send message. Please try again.';
      setSendError(msg);
      setInputMessage(content); // restore input on error
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-transparent dark:from-sky-950/40 dark:via-indigo-950/40 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
            {otherPartyName ? otherPartyName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gray-900 dark:text-white">
                {otherPartyName}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {otherPartyRole}
              </span>
            </div>
            {categoryName && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Booking #{bookingId} • {categoryName}
              </span>
            )}
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition cursor-pointer"
            aria-label="Close Chat"
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[300px] max-h-[460px] bg-gray-50/50 dark:bg-gray-950/50">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-400">
            Loading chat messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 p-6">
            <span className="text-3xl mb-2">👋</span>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Start a direct conversation with {otherPartyName}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Coordinate schedule, task specifics, and requirements in real time
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === user?.userId || m.isMine;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-sm leading-relaxed ${
                    isMine
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
                  }`}
                >
                  <p className="break-words whitespace-pre-wrap">{m.content}</p>
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
                  {formatTime(m.sentAt)}
                </span>
              </div>
            );
          })
        )}

        {/* Real-time typing indicator */}
        {otherUserTyping && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 italic animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
            <span>{otherPartyName} is typing…</span>
          </div>
        )}

        {/* Send Error Alert */}
        {sendError && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            ⚠️ {sendError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={handleInputChange}
          placeholder={`Message ${otherPartyName}…`}
          className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || sending}
          className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-md shadow-sky-500/20 cursor-pointer disabled:cursor-not-allowed"
        >
          {sending ? <span>…</span> : <span>Send</span>}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
    </div>
  );
}
