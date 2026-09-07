import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { workerApi } from '../../api/workerApi';
import { getFileUrl } from '../../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

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
      <Card className="card-lift bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-emerald-400">{t('worker.documents.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('worker.documents.docType')}</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="NationalId">{t('worker.documents.types.nationalId')}</option>
                  <option value="Passport">{t('worker.documents.types.passport')}</option>
                  <option value="TradeLicense">{t('worker.documents.types.tradeLicense')}</option>
                  <option value="Certification">{t('worker.documents.types.certification')}</option>
                </select>
              </div>

              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('worker.documents.fileLabel')}</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-300 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedFile || uploadMutation.isPending}
                className="btn-press w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed h-[42px] whitespace-nowrap cursor-pointer"
              >
                {uploadMutation.isPending ? t('worker.documents.uploading') : t('worker.documents.upload')}
              </button>
            </div>

            {actionMessage && (
              <div className={`p-3 rounded-md text-sm ${actionMessage.type === 'success' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                {actionMessage.text}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="card-lift bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-200">{t('worker.documents.yourDocuments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!documents || documents.length === 0 ? (
            <p className="text-gray-500 italic text-sm">{t('worker.documents.noDocuments')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="text-xs uppercase bg-gray-800 text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('worker.documents.docType')}</th>
                    <th className="px-4 py-3 font-medium">{t('worker.documents.fileColumn')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="table-row-hover border-b border-gray-800">
                      <td className="px-4 py-3 text-gray-300 font-medium">{doc.documentType}</td>
                      <td className="px-4 py-3">
                        <a
                          href={getFileUrl(doc.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-500 hover:underline"
                        >
                          {t('worker.documents.viewFile')}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          doc.status === 'Verified' ? 'bg-emerald-900 text-emerald-300' :
                          doc.status === 'Rejected' ? 'bg-red-900 text-red-300' :
                          'bg-amber-900 text-amber-300'
                        }`}>
                          {doc.status}
                        </span>
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
