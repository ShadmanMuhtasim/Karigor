import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { workerApi } from '../../api/workerApi';
import { getFileUrl } from '../../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { StatusBadge } from '../../components/ui/StatusBadge';

export function WorkerDocumentsTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<string>('NationalId');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['workerDocuments'],
    queryFn: workerApi.getDocuments,
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { documentType: string, file: File }) => workerApi.uploadDocument(data.documentType, data.file),
    onSuccess: () => {
      setActionMessage({ type: 'success', text: i18n.language === 'bn' ? 'ডকুমেন্ট সফলভাবে আপলোড হয়েছে!' : 'Document uploaded successfully!' });
      queryClient.invalidateQueries({ queryKey: ['workerDocuments'] });
      setSelectedFile(null);
      setDocumentType('NationalId');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (error: any) => {
      setActionMessage({ type: 'error', text: error.response?.data?.error || (i18n.language === 'bn' ? 'ডকুমেন্ট আপলোড ব্যর্থ হয়েছে।' : 'Failed to upload document.') });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setActionMessage(null);

    // basic client-side validation
    if (selectedFile.size > 10 * 1024 * 1024) {
      setActionMessage({ type: 'error', text: t('worker.documents.fileExceedsLimit') });
      return;
    }

    uploadMutation.mutate({ documentType, file: selectedFile });
  };

  if (isLoading) return <div className="text-gray-400">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-extrabold text-gray-900 dark:text-white">{t('worker.documents.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">{t('worker.documents.docType')}</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition"
                >
                  <option value="NationalId">{t('worker.documents.types.nationalId')}</option>
                  <option value="Passport">{t('worker.documents.types.passport')}</option>
                  <option value="TradeLicense">{t('worker.documents.types.tradeLicense')}</option>
                  <option value="Certification">{t('worker.documents.types.certification')}</option>
                </select>
              </div>

              <div className="flex-1 w-full">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">{t('worker.documents.fileLabel')}</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-950 dark:file:text-emerald-300 hover:file:bg-emerald-100"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedFile || uploadMutation.isPending}
                className="btn-press w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed h-[42px] whitespace-nowrap cursor-pointer text-sm shadow-sm"
              >
                {uploadMutation.isPending ? t('worker.documents.uploading') : t('worker.documents.upload')}
              </button>
            </div>

            {actionMessage && (
              <div className={`p-3 rounded-xl text-sm font-medium border ${actionMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'}`}>
                {actionMessage.text}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="card-lift bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-extrabold text-gray-900 dark:text-white">{t('worker.documents.yourDocuments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!documents || documents.length === 0 ? (
            <p className="text-gray-500 italic text-sm">{t('worker.documents.noDocuments')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t('worker.documents.docType')}</th>
                    <th className="px-4 py-3 font-semibold">{t('worker.documents.fileColumn')}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="table-row-hover border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3.5 text-gray-900 dark:text-gray-200 font-medium">{doc.documentType}</td>
                      <td className="px-4 py-3.5">
                        <a
                          href={getFileUrl(doc.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                        >
                          {t('worker.documents.viewFile')}
                        </a>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <StatusBadge status={doc.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
