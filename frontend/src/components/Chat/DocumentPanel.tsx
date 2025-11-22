import { useState, useEffect } from 'react';
import { File, Trash2, RefreshCw, FileText } from 'lucide-react';
import { documentApi, DocumentInfo } from '../../lib/documentApi';

interface DocumentPanelProps {
  onDocumentSelect?: (documentId: string) => void;
}

export function DocumentPanel({ onDocumentSelect }: DocumentPanelProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const docs = await documentApi.listDocuments();
      setDocuments(docs);
    } catch (err) {
      setError('Failed to load documents');
      console.error('Load documents error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await documentApi.deleteDocument(documentId);
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1a1a1a]">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Documents
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({documents.length})
          </span>
        </div>
        <button
          onClick={loadDocuments}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {isLoading && documents.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="animate-spin text-gray-400" size={24} />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <File size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No documents uploaded yet</p>
            <p className="text-xs mt-1">Click the paperclip icon to upload</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <File className="text-gray-400 flex-shrink-0 mt-0.5" size={18} />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{doc.fileType.toUpperCase()}</span>
                      <span>•</span>
                      <span>{doc.totalChunks} chunks</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.textLength)}</span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDate(doc.processedAt)}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Documents are automatically searched when you ask questions
        </p>
      </div>
    </div>
  );
}
