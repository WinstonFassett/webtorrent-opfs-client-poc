import React from 'react';
import { TorrentCard } from './components/TorrentCard';
import { AddTorrentModal } from './components/AddTorrentModal';
import { StatsOverview } from './components/StatsOverview';
import { StorageWarning } from './components/StorageWarning';
import { DevTools } from './components/DevTools';
import { useWebTorrent } from './hooks/useWebTorrent';
import { Plus } from 'lucide-react';

function App() {
  const {
    torrents,
    isLoading,
    error,
    addTorrent,
    pauseTorrent,
    resumeTorrent,
    removeTorrent,
    stats,
    opfsSupported,
    storageInfo,
    clearAllStorage,
    getOPFSContents
  } = useWebTorrent();

  const [showAddModal, setShowAddModal] = React.useState(false);

  // Handle torrent from URL hash
  React.useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        try {
          const magnetUri = decodeURIComponent(hash.slice(1));
          await addTorrent(magnetUri);
          // Clear the hash after adding the torrent
          window.history.replaceState(null, '', window.location.pathname);
        } catch (err) {
          console.error('Failed to add torrent from URL:', err);
        }
      }
    };

    // Check hash on mount and when it changes
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [addTorrent]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">WebTorrent Client</h1>
              <p className="mt-2 text-gray-600">
                Download and seed torrents directly in your browser
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Add Torrent
            </button>
          </div>
        </div>

        {/* Storage Warning */}
        <StorageWarning 
          opfsSupported={opfsSupported}
          storageInfo={storageInfo}
        />

        {/* Developer Tools */}
        <DevTools
          onClearAllStorage={clearAllStorage}
          onGetOPFSContents={getOPFSContents}
          opfsSupported={opfsSupported}
        />

        {/* Stats Overview */}
        <StatsOverview stats={stats} />

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading WebTorrent...</p>
          </div>
        )}

        {/* Torrents Grid */}
        {torrents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {torrents.map((torrent) => (
              <TorrentCard
                key={torrent.infoHash}
                torrent={torrent}
                onPause={pauseTorrent}
                onResume={resumeTorrent}
                onRemove={removeTorrent}
              />
            ))}
          </div>
        ) : !isLoading && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No torrents yet</h3>
            <p className="text-gray-600 mb-4">
              Add your first torrent to get started
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Add Torrent
            </button>
          </div>
        )}

        {/* Add Torrent Modal */}
        {showAddModal && (
          <AddTorrentModal
            onClose={() => setShowAddModal(false)}
            onAdd={addTorrent}
          />
        )}
      </div>
    </div>
  );
}

export default App;