import { ChatBox } from './ChatBox';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number;
  otherPartyName: string;
  otherPartyRole: string;
  categoryName?: string;
}

export function ChatModal({
  isOpen,
  onClose,
  bookingId,
  otherPartyName,
  otherPartyRole,
  categoryName,
}: ChatModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
        <ChatBox
          bookingId={bookingId}
          otherPartyName={otherPartyName}
          otherPartyRole={otherPartyRole}
          categoryName={categoryName}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
