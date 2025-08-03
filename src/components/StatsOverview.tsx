import React from 'react';
import { Download, Upload, Users, HardDrive } from 'lucide-react';
import { formatSpeed, formatBytes } from '../utils/formatters';

interface StatsOverviewProps {
  totalDownloadSpeed: number;
  totalUploadSpeed: number;
  totalPeers: number;
  totalSize: number;
  activeTorrents: number;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  totalDownloadSpeed,
  totalUploadSpeed,
  totalPeers,
  totalSize,
  activeTorrents,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Download size={20} className="text-blue-600" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSpeed(totalDownloadSpeed)}
            </div>
            <div className="text-sm text-gray-600">Download</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <Upload size={20} className="text-green-600" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSpeed(totalUploadSpeed)}
            </div>
            <div className="text-sm text-gray-600">Upload</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Users size={20} className="text-purple-600" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{totalPeers}</div>
            <div className="text-sm text-gray-600">Peers</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-lg">
            <HardDrive size={20} className="text-orange-600" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {formatBytes(totalSize)}
            </div>
            <div className="text-sm text-gray-600">Total Size</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
              <div className="text-white text-xs font-bold">{activeTorrents}</div>
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{activeTorrents}</div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
        </div>
      </div>
    </div>
  );
};