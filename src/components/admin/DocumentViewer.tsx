/**
 * DocumentViewer Component
 *
 * Component for viewing uploaded verification documents
 */

import React, { useState } from 'react';
import { VerificationRequest } from '../../types/database.types';
import { DOCUMENT_TYPE_LABELS } from '../../constants/app.constants';
import { formatDateTime } from '../../utils/dataTransform';

interface DocumentViewerProps {
  request: VerificationRequest;
  onClose?: () => void;
}

/**
 * DocumentViewer component for viewing verification documents
 */
export const DocumentViewer: React.FC<DocumentViewerProps> = ({ request, onClose }) => {
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  const selectedDoc = request.documents[selectedDocIndex];

  const isImageFile = (url: string): boolean => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => url.toLowerCase().endsWith(ext));
  };

  const isPdfFile = (url: string): boolean => {
    return url.toLowerCase().endsWith('.pdf');
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {request.organizationName} - Documents
            </h2>
            <p className="text-sm text-gray-600">
              {request.documents.length} document{request.documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Document List Sidebar */}
          <div className="w-64 border-r overflow-y-auto bg-gray-50">
            <div className="p-2">
              {request.documents.map((doc, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedDocIndex(index);
                    setImageError(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                    selectedDocIndex === index
                      ? 'bg-red-600 text-white'
                      : 'bg-white hover:bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="font-medium text-sm mb-1">
                    {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                  </div>
                  <div
                    className={`text-xs ${
                      selectedDocIndex === index ? 'text-red-100' : 'text-gray-500'
                    }`}
                  >
                    {doc.name}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      selectedDocIndex === index ? 'text-red-100' : 'text-gray-400'
                    }`}
                  >
                    {formatDateTime(doc.uploadedAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Document Viewer */}
          <div className="flex-1 flex flex-col">
            {/* Document Info Bar */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {DOCUMENT_TYPE_LABELS[selectedDoc.type] || selectedDoc.type}
                  </h3>
                  <p className="text-sm text-gray-600">{selectedDoc.name}</p>
                </div>
                <button
                  onClick={() => handleDownload(selectedDoc.url, selectedDoc.name)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Download
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              <div className="flex items-center justify-center min-h-full">
                {isImageFile(selectedDoc.url) ? (
                  imageError ? (
                    <div className="text-center">
                      <p className="text-gray-600 mb-4">Failed to load image</p>
                      <button
                        onClick={() => handleDownload(selectedDoc.url, selectedDoc.name)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Download to View
                      </button>
                    </div>
                  ) : (
                    <img
                      src={selectedDoc.url}
                      alt={selectedDoc.name}
                      className="max-w-full max-h-full object-contain rounded shadow-lg"
                      onError={() => setImageError(true)}
                    />
                  )
                ) : isPdfFile(selectedDoc.url) ? (
                  <div className="w-full h-full">
                    <iframe
                      src={selectedDoc.url}
                      className="w-full h-full rounded shadow-lg"
                      title={selectedDoc.name}
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mb-4">
                      <svg
                        className="w-20 h-20 mx-auto text-gray-400"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </div>
                    <p className="text-gray-600 mb-4">
                      Preview not available for this file type
                    </p>
                    <button
                      onClick={() => handleDownload(selectedDoc.url, selectedDoc.name)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Download to View
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedDocIndex(prev =>
                  prev > 0 ? prev - 1 : request.documents.length - 1
                );
                setImageError(false);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Previous
            </button>

            <span className="text-sm text-gray-600">
              {selectedDocIndex + 1} of {request.documents.length}
            </span>

            <button
              onClick={() => {
                setSelectedDocIndex(prev =>
                  prev < request.documents.length - 1 ? prev + 1 : 0
                );
                setImageError(false);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
