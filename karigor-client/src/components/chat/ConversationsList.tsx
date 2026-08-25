import { useEffect, useState } from 'react';
import { messagingApi, type ConversationSummaryDto } from '../../api/messagingApi';
import { signalRService } from '../../services/signalrService';
import { ChatModal } from './ChatModal';

export function ConversationsList() {
  const [conversations, setConversations] = useState<ConversationSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<ConversationSummaryDto | null>(null);

  useEffect(() => {
    loadConversations();

    const unsub = signalRService.onMessage(() => {
      // Refresh conversations list on any incoming message
      loadConversations();
    });

    return () => {
      unsub();
    };
  }, []);

  async function loadConversations() {
    try {
      const data = await messagingApi.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
        Loading conversations…
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
        <span className="text-4xl block mb-2">💬</span>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">No active conversations yet</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
          Conversations are automatically created whenever you book a service or receive quotation agreements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {conversations.map((c) => {
          const bookingId = c.bookingId || (c as any).BookingId;
          const otherName = c.otherPartyName || (c as any).OtherPartyName;
          const otherRole = c.otherPartyRole || (c as any).OtherPartyRole;
          const category = c.categoryName || (c as any).CategoryName;
          const lastMsg = c.lastMessage || (c as any).LastMessage;
          const lastSentAt = c.lastMessageSentAt || (c as any).LastMessageSentAt;
          const unread = c.unreadCount || (c as any).UnreadCount || 0;

          return (
            <div
              key={bookingId || Math.random()}
              onClick={() => setActiveChat(c)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:border-sky-500/50 hover:shadow-md transition cursor-pointer flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-md">
                  {otherName ? otherName.charAt(0).toUpperCase() : 'U'}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {otherName}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      {otherRole}
                    </span>
                    {category && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        • {category}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-0.5">
                    {lastMsg}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {formatTime(lastSentAt)}
                </span>
                {unread > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-xs animate-pulse">
                    {unread} new
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat Modal */}
      {activeChat && (
        <ChatModal
          isOpen={!!activeChat}
          onClose={() => {
            setActiveChat(null);
            loadConversations();
          }}
          bookingId={activeChat.bookingId || (activeChat as any).BookingId}
          otherPartyName={activeChat.otherPartyName || (activeChat as any).OtherPartyName}
          otherPartyRole={activeChat.otherPartyRole || (activeChat as any).OtherPartyRole}
          categoryName={activeChat.categoryName || (activeChat as any).CategoryName}
        />
      )}
    </div>
  );
}
