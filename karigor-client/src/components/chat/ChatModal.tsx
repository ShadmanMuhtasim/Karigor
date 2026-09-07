import { Modal } from '../ui/Modal';
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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdropClassName="bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg max-h-[90vh] shadow-2xl animate-modal-pop">
        <ChatBox
          bookingId={bookingId}
          otherPartyName={otherPartyName}
          otherPartyRole={otherPartyRole}
          categoryName={categoryName}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
}
