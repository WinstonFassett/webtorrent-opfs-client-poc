import React, { useState, useRef } from 'react';
import { X, Upload, Link, FileText } from 'lucide-react';

interface AddTorrentModalProps {
  onClose: () => void;
  onAdd: (torrentId: string | File | FileList) => void;
}

export const AddTorrentModal: React.FC<AddTorrentModalProps> = ({
  onClose,
  onAdd,
}) => {
  const [magnetURI, setMagnetURI] = useState('');
  const [activeTab, setActiveTab] = useState<'magnet' | 'file' | 'seed'>('magnet');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seedInputRef = useRef<HTMLInputElement>(null);

  const handleMagnetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (magnetURI.trim()) {
      onAdd(magnetURI.trim());
      setMagnetURI('');
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.torrent')) {
      onAdd(file);
      onClose();
    }
  };

  const handleSeedFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAdd(files);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Torrent</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Tabs */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              onClick={() => setActiveTab('magnet')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'magnet'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Link size={16} />
              Magnet Link
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'file'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText size={16} />
              Torrent File
            </button>
            <button
              onClick={() => setActiveTab('seed')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'seed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload size={16} />
              Seed Files
            </button>
          </div>

          {/* Content */}
          {activeTab === 'magnet' && (
            <form onSubmit={handleMagnetSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magnet URI
                </label>
                <textarea
                  value={magnetURI}
                  onChange={(e) => setMagnetURI(e.target.value)}
                  placeholder="magnet:?xt=urn:btih:..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Add Torrent
              </button>
            </form>
          )}

          {activeTab === 'file' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Torrent File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".torrent"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-sm text-gray-600">
                Select a .torrent file to download
              </p>
            </div>
          )}

          {activeTab === 'seed' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Files to Seed
                </label>
                <input
                  ref={seedInputRef}
                  type="file"
                  multiple
                  onChange={handleSeedFilesChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-sm text-gray-600">
                Select multiple files to create a new torrent and start seeding
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};