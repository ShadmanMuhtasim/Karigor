import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPrivateDocument } from '../api/privateDocumentApi';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui/Modal';

interface Props { fileUrl: string; label: string; onClose: () => void }
interface DocumentState { account: string; path: string; url?: string; type?: string; error?: boolean }

export function PrivateDocumentViewer({ fileUrl, label, onClose }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const account = user?.userId;
  const [document, setDocument] = useState<DocumentState | null>(null);

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | undefined;
    fetchPrivateDocument(fileUrl, controller.signal).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setDocument({ account, path: fileUrl, url: objectUrl, type: blob.type });
    }).catch(() => {
      if (active) setDocument({ account, path: fileUrl, error: true });
    });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [account, fileUrl]);

  // This render guard hides previous-account bytes before effect cleanup runs.
  const current = document?.account === account && document?.path === fileUrl ? document : null;
  if (!account) return null;
  return <Modal isOpen onClose={onClose} backdropClassName="bg-black/70 backdrop-blur-sm">
    <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full p-6 space-y-4">
      <h4 className="font-bold text-gray-900 dark:text-white">{label}</h4>
      {!current && <p role="status">{t('common.loading')}</p>}
      {current?.error && <p role="alert">{t('privateDocuments.error')}</p>}
      {current?.url && <>
        {current.type === 'application/pdf'
          ? <p>{t('privateDocuments.pdfReady')}</p>
          : <img src={current.url} alt={label} className="max-h-[60vh] max-w-full mx-auto object-contain" />}
        <a href={current.url} download={fileUrl.split('/').pop()}
          className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">
          {t('privateDocuments.download')}
        </a>
      </>}
      <button type="button" onClick={onClose} className="block px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-xl">
        {t('common.close')}
      </button>
    </div>
  </Modal>;
}
