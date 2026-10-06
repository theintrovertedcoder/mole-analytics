import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Search,
  ArrowRight,
  Download,
  Eye,
  Trash2,
  Activity,
  Server,
  Wifi,
  Settings
} from 'lucide-react';
import { Event, Space } from '../../types';

interface DataSourceManagerProps {
  events: Event[];
  spaces: Record<string, Space>; // Spaces act as Exhibitors
  onDataUpdate: (targetId: string, type: 'event' | 'exhibitor', data: any) => void;
}

type SourceType = 'csv' | 'api';
type TargetType = 'event' | 'exhibitor';
type Page = 'import' | 'csv-list' | 'api-list';

// --- MOCK DATA FOR LISTS ---
const MOCK_CSVS = [
  { id: '1', name: 'ces_2024_footfall.csv', date: '2024-01-15', size: '2.4 MB', records: 14500, status: 'Processed' },
  { id: '2', name: 'techflow_leads_q4.csv', date: '2023-12-20', size: '156 KB', records: 342, status: 'Processed' },
  { id: '3', name: 'raw_beacon_dump_nov.csv', date: '2023-11-30', size: '45 MB', records: 89000, status: 'Error' },
];

const MOCK_APIS = [
  { id: '1', name: 'Salesforce CRM', endpoint: 'https://api.salesforce.com/v54.0/...', status: 'Connected', lastSync: '5 mins ago', latency: '120ms', uptime: '99.9%' },
  { id: '2', name: 'Eventbrite Webhook', endpoint: 'https://www.eventbriteapi.com/v3/...', status: 'Connected', lastSync: '1 hour ago', latency: '45ms', uptime: '100%' },
  { id: '3', name: 'HubSpot Sync', endpoint: 'https://api.hubapi.com/crm/v3/...', status: 'Disconnected', lastSync: '2 days ago', latency: '-', uptime: '0%' },
];

export const DataSourceManager: React.FC<DataSourceManagerProps> = ({ events, spaces, onDataUpdate }) => {
  const [activePage, setActivePage] = useState<Page>('import');

  // Import State
  const [targetType, setTargetType] = useState<TargetType>('event');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [sourceType, setSourceType] = useState<SourceType>('csv');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // CSV State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);

  // API State
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
      setUploadStatus('idle');
    }
  };

  const handleImport = () => {
    if (!selectedTargetId) {
      setUploadStatus('error');
      setStatusMessage('Please select a target first.');
      return;
    }

    setIsLoading(true);
    setUploadStatus('idle');

    // Simulate network request / processing
    setTimeout(() => {
      setIsLoading(false);
      setUploadStatus('success');
      setStatusMessage(`Successfully imported data for ${targetType === 'event' ? 'Event' : 'Exhibitor'}.`);
      
      // In a real app, we would parse the CSV or call the API here
      onDataUpdate(selectedTargetId, targetType, { 
        source: sourceType, 
        timestamp: new Date().toISOString() 
      });
      
      // Reset form slightly
      setCsvFile(null);
    }, 1500);
  };

  const filteredTargets = targetType === 'event' 
    ? events 
    : Object.values(spaces).filter(s => s.type === 'Booth');

  // --- SUB-PAGES ---

  const ImportPage = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            
            {/* 1. Select Target Type */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">1. Select Data Scope</label>
              <div className="flex gap-4">
                <button 
                  onClick={() => { setTargetType('event'); setSelectedTargetId(''); }}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${
                    targetType === 'event' 
                      ? 'border-mole-500 bg-mole-50 text-mole-900' 
                      : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <UploadCloud size={20} /> Event Level
                </button>
                <button 
                  onClick={() => { setTargetType('exhibitor'); setSelectedTargetId(''); }}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${
                    targetType === 'exhibitor' 
                      ? 'border-plexyz-500 bg-plexyz-50 text-plexyz-900' 
                      : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <FileSpreadsheet size={20} /> Exhibitor Level
                </button>
              </div>
            </div>

            {/* 2. Select Specific Target */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                2. Select {targetType === 'event' ? 'Event' : 'Exhibitor'}
              </label>
              <div className="relative">
                <select 
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-mole-500 focus:border-mole-500 block p-4 pr-10 font-medium outline-none"
                >
                  <option value="">-- Choose Target --</option>
                  {filteredTargets.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {targetType === 'event' ? `(${t.date})` : `(${t.type})`}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <Search size={18} />
                </div>
              </div>
            </div>

            {/* 3. Select Source Method */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">3. Data Source Method</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => setSourceType('csv')}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                    sourceType === 'csv' ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <FileSpreadsheet className={sourceType === 'csv' ? 'text-gray-900' : 'text-gray-400'} />
                    {sourceType === 'csv' && <CheckCircle2 size={18} className="text-green-600" />}
                  </div>
                  <h4 className="font-bold text-gray-900">CSV Upload</h4>
                  <p className="text-xs text-gray-500 mt-1">Upload manual footfall or sales data via spreadsheet.</p>
                </div>

                <div 
                  onClick={() => setSourceType('api')}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                    sourceType === 'api' ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <RefreshCw className={sourceType === 'api' ? 'text-gray-900' : 'text-gray-400'} />
                    {sourceType === 'api' && <CheckCircle2 size={18} className="text-green-600" />}
                  </div>
                  <h4 className="font-bold text-gray-900">API Sync</h4>
                  <p className="text-xs text-gray-500 mt-1">Connect to external CRM or ticketing systems.</p>
                </div>
              </div>
            </div>

            {/* 4. Input Area */}
            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
              {sourceType === 'csv' ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-white hover:bg-gray-50 transition-colors relative">
                    <input 
                      type="file" 
                      accept=".csv,.xlsx" 
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p className="text-sm font-medium text-gray-900">
                      {csvFile ? csvFile.name : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">CSV or Excel files (max 10MB)</p>
                  </div>
                  {csvFile && (
                    <div className="flex items-center justify-between text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                      <span>File ready: <strong>{csvFile.name}</strong></span>
                      <button onClick={() => setCsvFile(null)} className="text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endpoint URL</label>
                    <input 
                      type="text" 
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://api.crm.com/v1/export"
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mole-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Key / Token</label>
                    <input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk_live_..."
                      className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-mole-400"
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={handleImport}
                  disabled={isLoading || (!csvFile && sourceType === 'csv') || (!apiUrl && sourceType === 'api')}
                  className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-gray-900/20"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} /> Processing...
                    </>
                  ) : (
                    <>
                      Import Data <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status Message */}
            {uploadStatus !== 'idle' && (
              <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${
                uploadStatus === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'
              }`}>
                {uploadStatus === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <span className="font-medium">{statusMessage}</span>
              </div>
            )}

          </div>
        </div>

        {/* Info / Template Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Data Templates</h3>
            <p className="text-sm text-gray-500 mb-6">Use these templates to ensure your data is formatted correctly for the analytics engine.</p>
            
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left group">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={18} className="text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Event Footfall Template</span>
                </div>
                <Download size={16} className="text-gray-400 group-hover:text-gray-600" />
              </button>
              
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left group">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={18} className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Exhibitor Leads Template</span>
                </div>
                <Download size={16} className="text-gray-400 group-hover:text-gray-600" />
              </button>
            </div>
          </div>

          <div className="bg-mole-50 p-6 rounded-3xl border border-mole-100">
            <h3 className="font-bold text-mole-900 mb-2">Pro Tip</h3>
            <p className="text-sm text-mole-800">
              API connections are synced every 15 minutes. Manual CSV uploads update the dashboard immediately.
            </p>
          </div>
        </div>
      </div>
  );

  const CsvListPage = () => (
    <div className="animate-fade-in-up space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 text-lg">Uploaded Files</h3>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="Search files..." className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-mole-400 outline-none" />
            </div>
        </div>
        <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                <tr>
                    <th className="px-6 py-4">File Name</th>
                    <th className="px-6 py-4">Date Uploaded</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Records</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {MOCK_CSVS.map(file => (
                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet size={18} className="text-gray-400" />
                                <span className="font-medium text-gray-900">{file.name}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{file.date}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{file.size}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{file.records.toLocaleString()}</td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                file.status === 'Processed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                                {file.status === 'Processed' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                {file.status}
                            </span>
                        </td>
                        <td className="px-6 py-4 flex items-center gap-2">
                            <button 
                                onClick={() => setPreviewFile(file)}
                                className="p-2 text-gray-400 hover:text-mole-600 hover:bg-mole-50 rounded-lg transition-colors"
                                title="Preview Data"
                            >
                                <Eye size={18} />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setPreviewFile(null)} />
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-gray-900">Preview: {previewFile.name}</h3>
                      <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><Trash2 size={20} className="hidden" /><Eye size={20} className="hidden" />X</button>
                  </div>
                  <div className="p-6 overflow-auto">
                      <div className="grid grid-cols-5 gap-4 mb-4">
                          {[...Array(5)].map((_, i) => (
                              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
                          ))}
                      </div>
                      {[...Array(10)].map((_, i) => (
                          <div key={i} className="grid grid-cols-5 gap-4 mb-2">
                              {[...Array(5)].map((_, j) => (
                                  <div key={j} className="h-3 bg-gray-100 rounded"></div>
                              ))}
                          </div>
                      ))}
                      <div className="text-center text-gray-400 text-sm mt-8 italic">
                          Previewing first 10 rows of {previewFile.records.toLocaleString()} records...
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );

  const ApiListPage = () => (
    <div className="animate-fade-in-up space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Active Connections</div>
                <div className="text-3xl font-bold text-gray-900">2/3</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Avg Latency</div>
                <div className="text-3xl font-bold text-green-600">82ms</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Total Requests (24h)</div>
                <div className="text-3xl font-bold text-gray-900">14.2k</div>
            </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-lg">Connected APIs</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors">
                    <RefreshCw size={16} /> Force Sync
                </button>
            </div>
            <div className="divide-y divide-gray-100">
                {MOCK_APIS.map(api => (
                    <div key={api.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl ${api.status === 'Connected' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                    <Server size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900 text-lg">{api.name}</h4>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                            api.status === 'Connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {api.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-500 font-mono mt-1">{api.endpoint}</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 uppercase font-bold">Last Sync</div>
                                    <div className="font-medium text-gray-900">{api.lastSync}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 uppercase font-bold">Latency</div>
                                    <div className="font-medium text-gray-900 flex items-center gap-1 justify-end">
                                        <Activity size={14} className="text-gray-400" />
                                        {api.latency}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 uppercase font-bold">Uptime</div>
                                    <div className="font-medium text-gray-900">{api.uptime}</div>
                                </div>
                                <button className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors">
                                    <Settings size={20} className="hidden" /> {/* Placeholder for settings icon if needed */}
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Mock Network Monitor */}
                        {api.status === 'Connected' && (
                            <div className="mt-6 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
                                    <Wifi size={12} /> NETWORK ACTIVITY (1H)
                                </div>
                                <div className="flex items-end gap-1 h-12">
                                    {[...Array(40)].map((_, i) => {
                                        const height = Math.floor(Math.random() * 100);
                                        return (
                                            <div 
                                                key={i} 
                                                className="flex-1 bg-green-100 rounded-t-sm hover:bg-green-300 transition-colors"
                                                style={{ height: `${height}%` }}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Data Source Management</h2>
            <p className="text-gray-500">Import external analytics data from CSV files or API connections.</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
                onClick={() => setActivePage('import')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activePage === 'import' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Import Data
            </button>
            <button 
                onClick={() => setActivePage('csv-list')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activePage === 'csv-list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Manage CSVs
            </button>
            <button 
                onClick={() => setActivePage('api-list')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activePage === 'api-list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                API Connections
            </button>
        </div>
      </div>

      {activePage === 'import' && <ImportPage />}
      {activePage === 'csv-list' && <CsvListPage />}
      {activePage === 'api-list' && <ApiListPage />}
    </div>
  );
};
