import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Radio, 
  LogOut, 
  Search, 
  Battery, 
  BatteryMedium, 
  BatteryLow,
  Plus,
  Settings,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  MapPin,
  X,
  ArrowLeft,
  Trash2,
  Link as LinkIcon,
  Building2,
  Unlink,
  Bell,
  Filter,
  CheckSquare,
  Square,
  MinusSquare,
  Edit2,
  Save,
  AlertTriangle,
  Database
} from 'lucide-react';
import { Client, Beacon, Space, Event } from '../../types';
import { AddClientWizard, WizardData } from './AddClientWizard';

import { DataSourceManager } from './DataSourceManager';

// --- MOCK DATA ---

const MOCK_CLIENTS: Client[] = [
  { id: 'c1', name: 'TechFlow Systems', tier: 'Enterprise', status: 'Active', contact: 'sarah@techflow.io', beaconsAssigned: 3 },
  { id: 'c2', name: 'GreenLeaf Organics', tier: 'Growth', status: 'Active', contact: 'mark@greenleaf.com', beaconsAssigned: 1 },
  { id: 'c3', name: 'Nexus Events', tier: 'Starter', status: 'Pending', contact: 'info@nexus.com', beaconsAssigned: 0 },
];

const MOCK_EVENTS: Event[] = [
  { id: 'e1', clientId: 'c1', name: 'TechCon 2024', date: '2024-11-15' },
  { id: 'e2', clientId: 'c2', name: 'Organic Future Expo', date: '2024-12-01' }
];

const MOCK_SPACES: Record<string, Space> = {
    's1': { id: 's1', eventId: 'e1', name: 'Main Hall A1', type: 'Booth' },
    's2': { id: 's2', eventId: 'e2', name: 'Lobby Kiosk', type: 'Booth' }
};

const MOCK_BEACONS: Beacon[] = [
  { id: 'b1', macAddress: '00:11:22:AA:BB:CC', batteryLevel: 92, status: 'Active', assignedClientId: 'c1', assignedSpaceId: 's1', lastPing: '2 mins ago' },
  { id: 'b2', macAddress: '00:11:22:AA:BB:CD', batteryLevel: 45, status: 'Active', assignedClientId: 'c1', assignedSpaceId: 's1', lastPing: '5 mins ago' },
  { id: 'b3', macAddress: '00:11:22:AA:BB:CE', batteryLevel: 12, status: 'Maintenance', assignedClientId: 'c1', assignedSpaceId: 's1', lastPing: '1 hour ago' },
  { id: 'b4', macAddress: 'AA:BB:CC:11:22:33', batteryLevel: 100, status: 'Inactive', assignedClientId: null, lastPing: 'Never' },
  { id: 'b5', macAddress: 'AA:BB:CC:11:22:34', batteryLevel: 98, status: 'Active', assignedClientId: 'c2', assignedSpaceId: 's2', lastPing: '1 min ago' },
  { id: 'b6', macAddress: 'AA:BB:CC:11:22:35', batteryLevel: 100, status: 'Inactive', assignedClientId: null, lastPing: 'Never' },
  { id: 'b7', macAddress: 'BB:CC:DD:44:55:66', batteryLevel: 100, status: 'Inactive', assignedClientId: null, lastPing: 'Never' },
  { id: 'b8', macAddress: 'BB:CC:DD:44:55:77', batteryLevel: 100, status: 'Inactive', assignedClientId: null, lastPing: 'Never' },
];

// --- Sub-components ---

const ActionModal = ({ 
  isOpen, 
  title, 
  onClose, 
  onSubmit, 
  children,
  submitLabel = "Confirm",
  isDanger = false
}: { 
  isOpen: boolean; 
  title: string; 
  onClose: () => void; 
  onSubmit: () => void; 
  children?: React.ReactNode;
  submitLabel?: string;
  isDanger?: boolean;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
       <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
       <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden transform transition-all animate-fade-in-up">
          <div className="px-8 py-6 flex justify-between items-center">
             <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20}/></button>
          </div>
          <div className="px-8 space-y-6">
             {children}
          </div>
          <div className="px-8 py-8 flex justify-end gap-4">
             <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">Cancel</button>
             <button 
                onClick={onSubmit} 
                className={`px-6 py-2.5 text-sm font-bold rounded-xl shadow-lg shadow-mole-500/20 transition-all active:scale-95 ${isDanger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-mole-yellow hover:bg-mole-400 text-mole-900'}`}
             >
                {submitLabel}
             </button>
          </div>
       </div>
    </div>
  );
};

interface AdminPortalProps {
  onLogout: () => void;
}

type Tab = 'overview' | 'clients' | 'beacons' | 'data-sources';

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [managedEventId, setManagedEventId] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [beacons, setBeacons] = useState<Beacon[]>(MOCK_BEACONS);
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  const [spaces, setSpaces] = useState<Record<string, Space>>(MOCK_SPACES);
  
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // --- ACTIONS ---

  // Sync client beacon counts whenever beacon state changes
  useEffect(() => {
    setClients(prevClients => {
        const counts = new Map<string, number>();
        beacons.forEach(b => {
            if (b.assignedClientId) {
                counts.set(b.assignedClientId, (counts.get(b.assignedClientId) || 0) + 1);
            }
        });
        
        // Only update if changes detected to avoid loop/re-render
        const hasChanges = prevClients.some(c => c.beaconsAssigned !== (counts.get(c.id) || 0));
        if (!hasChanges) return prevClients;

        return prevClients.map(c => ({
            ...c,
            beaconsAssigned: counts.get(c.id) || 0
        }));
    });
  }, [beacons]);

  const handleAssignBeacon = (beaconId: string, clientId: string | null, spaceId: string | null) => {
    setBeacons(prev => prev.map(b => 
      b.id === beaconId 
        ? { 
            ...b, 
            assignedClientId: clientId, 
            assignedSpaceId: spaceId, 
            status: clientId ? 'Active' : 'Inactive' 
          } 
        : b
    ));
  };

  const handleWizardComplete = (data: WizardData) => {
      const newClientId = `c${Date.now()}`;
      const newClient: Client = {
          id: newClientId,
          name: data.client.name,
          contact: data.client.email,
          tier: data.client.tier,
          status: 'Active',
          beaconsAssigned: data.selectedBeaconIds.length
      };

      const newEventId = `e${Date.now()}`;
      const newEvent: Event = {
          id: newEventId,
          clientId: newClientId,
          name: data.event.name,
          date: data.event.date
      };

      const newSpaceId = `s${Date.now()}`;
      const newSpace: Space = {
          id: newSpaceId,
          eventId: newEventId,
          name: data.space.name,
          type: data.space.type
      };

      setClients(prev => [newClient, ...prev]);
      setEvents(prev => [newEvent, ...prev]);
      setSpaces(prev => ({ ...prev, [newSpaceId]: newSpace }));

      if (data.selectedBeaconIds.length > 0) {
          setBeacons(prev => prev.map(b => {
              if (data.selectedBeaconIds.includes(b.id)) {
                  return {
                      ...b,
                      assignedClientId: newClientId,
                      assignedSpaceId: newSpaceId,
                      status: 'Active'
                  };
              }
              return b;
          }));
      }

      setIsWizardOpen(false);
      setActiveTab('clients');
  };

  const SidebarItem = ({ tab, icon: Icon, label }: { tab: Tab; icon: React.ElementType; label: string }) => (
    <button 
      onClick={() => {
         setActiveTab(tab);
         setManagedEventId(null); // Reset detail view if navigating
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
        activeTab === tab 
          ? 'bg-mole-yellow text-mole-900 font-bold shadow-lg shadow-mole-500/20' 
          : 'text-plexyz-200 hover:bg-plexyz-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  // --- PAGE INFO HELPER ---
  const getPageInfo = () => {
      if (managedEventId) {
          const event = events.find(e => e.id === managedEventId);
          return {
              title: event?.name || 'Event Details',
              description: 'Manage spaces, exhibitors, and beacon assignments for this event.'
          };
      }
      switch (activeTab) {
          case 'overview': return { title: 'System Overview', description: 'Real-time monitoring of clients, beacons, and system health.' };
          case 'clients': return { title: 'Client Accounts', description: 'Manage client organizations, subscriptions, and event access.' };
          case 'beacons': return { title: 'Beacon Management', description: 'Inventory control, battery monitoring, and assignment.' };
          case 'data-sources': return { title: 'Data Sources', description: 'Manage external data integrations, CSV uploads, and API connections.' };
          default: return { title: 'Admin Portal', description: 'Welcome to the admin dashboard.' };
      }
  };

  const pageInfo = getPageInfo();

  // --- VIEWS ---

  const Overview = () => (
    <div className="space-y-6 animate-fade-in-up">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
           <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-plexyz-50 text-plexyz-600 rounded-xl">
                 <Users size={24} />
              </div>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
           </div>
           <div className="text-3xl font-bold text-gray-900">{clients.length}</div>
           <div className="text-sm text-gray-500">Active Clients</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
           <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-mole-50 text-mole-600 rounded-xl">
                 <Radio size={24} />
              </div>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{beacons.filter(b => b.assignedClientId).length} In Use</span>
           </div>
           <div className="text-3xl font-bold text-gray-900">{beacons.length}</div>
           <div className="text-sm text-gray-500">Total Beacons</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
           <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                 <Battery size={24} />
              </div>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">1 Attention</span>
           </div>
           <div className="text-3xl font-bold text-gray-900">98%</div>
           <div className="text-sm text-gray-500">System Health</div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-4">System Alerts</h3>
        <div className="space-y-3">
            {beacons.filter(b => b.batteryLevel < 20).map(b => (
                <div key={b.id} className="flex items-center gap-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle className="text-red-600" size={20} />
                    <div className="flex-1">
                        <span className="text-sm font-bold text-gray-900">Low Battery Warning</span>
                        <p className="text-xs text-gray-600">Beacon {b.macAddress} is at {b.batteryLevel}%</p>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );

  const ClientList = () => {
      const [searchTerm, setSearchTerm] = useState('');
      const [sortKey, setSortKey] = useState<'name' | 'events'>('name');
      const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
      const [activeModal, setActiveModal] = useState<{ type: 'event', parentId: string, isOpen: true } | null>(null);
      const [formData, setFormData] = useState({ name: '', date: '' });

      const toggleClient = (id: string) => {
          const next = new Set(expandedClients);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setExpandedClients(next);
      };

      const filteredClients = useMemo(() => {
          let list = clients.filter(c => {
             const nameMatch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
             const eventMatch = events.filter(e => e.clientId === c.id).some(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
             return nameMatch || eventMatch;
          });
          
          if (sortKey === 'name') {
              list.sort((a, b) => a.name.localeCompare(b.name));
          } else if (sortKey === 'events') {
              list.sort((a, b) => {
                  const eventsA = events.filter(e => e.clientId === a.id);
                  const eventsB = events.filter(e => e.clientId === b.id);
                  if (eventsA.length !== eventsB.length) return eventsB.length - eventsA.length;
                  return (eventsA[0]?.name || '').localeCompare(eventsB[0]?.name || '');
              });
          }
          return list;
      }, [clients, events, searchTerm, sortKey]);

      const handleCreateEvent = () => {
          if (!activeModal) return;
          const newEvent: Event = {
              id: `e${Date.now()}`,
              clientId: activeModal.parentId,
              name: formData.name,
              date: formData.date
          };
          setEvents(prev => [newEvent, ...prev]);
          setExpandedClients(prev => new Set(prev).add(activeModal.parentId));
          setActiveModal(null);
      };

      return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="font-bold text-gray-900 text-lg whitespace-nowrap">Client Accounts</h3>
            
            <div className="flex flex-1 w-full md:w-auto items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search client or event name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-mole-400 outline-none w-full"
                    />
                </div>
                
                <select 
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as any)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-mole-400"
                >
                    <option value="name">Sort by Client Name</option>
                    <option value="events">Sort by Event Activity</option>
                </select>

                <button 
                    onClick={() => setIsWizardOpen(true)}
                    className="flex items-center gap-2 bg-plexyz-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-plexyz-700 transition-colors whitespace-nowrap"
                >
                    <Plus size={16} /> New Client
                </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                    <tr>
                        <th className="px-6 py-4 w-12"></th>
                        <th className="px-6 py-4">Company Name</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Plan</th>
                        <th className="px-6 py-4">Events</th>
                        <th className="px-6 py-4">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredClients.map(client => {
                        const clientEvents = events.filter(e => e.clientId === client.id);
                        const isExpanded = expandedClients.has(client.id);

                        return (
                        <React.Fragment key={client.id}>
                            <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}>
                                <td className="px-6 py-4 text-center">
                                    <button onClick={() => toggleClient(client.id)} className="text-gray-400 hover:text-plexyz-600">
                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{client.name}</div>
                                    <div className="text-xs text-gray-500">{client.contact}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        client.status === 'Active' ? 'bg-green-100 text-green-800' : 
                                        client.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {client.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-medium text-plexyz-600 bg-plexyz-50 px-2 py-1 rounded-md">
                                        {client.tier}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 font-bold">
                                    {clientEvents.length}
                                </td>
                                <td className="px-6 py-4">
                                    <button 
                                        onClick={() => {
                                            setFormData({ name: '', date: '' });
                                            setActiveModal({ type: 'event', parentId: client.id, isOpen: true });
                                        }}
                                        className="flex items-center gap-1 text-xs font-bold text-mole-700 bg-mole-100 hover:bg-mole-200 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Plus size={14} /> Add Event
                                    </button>
                                </td>
                            </tr>
                            {isExpanded && (
                                <tr className="bg-gray-50/50 shadow-inner">
                                    <td colSpan={6} className="px-6 py-4 pl-12">
                                        {clientEvents.length === 0 ? (
                                            <div className="text-sm text-gray-400 italic py-2">No events scheduled.</div>
                                        ) : (
                                            <div className="space-y-4">
                                                {clientEvents.map(event => {
                                                    const eventSpaceCount = (Object.values(spaces) as Space[]).filter(s => s.eventId === event.id).length;
                                                    return (
                                                        <div key={event.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex items-center justify-between p-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 bg-plexyz-50 rounded-lg flex items-center justify-center text-plexyz-600">
                                                                    <Calendar size={20} />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-900">{event.name}</div>
                                                                    <div className="text-xs text-gray-500">{event.date} • {eventSpaceCount} Spaces configured</div>
                                                                </div>
                                                            </div>
                                                            <button 
                                                                onClick={() => setManagedEventId(event.id)}
                                                                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-colors"
                                                            >
                                                                <Settings size={16} /> Manage Event
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    )})}
                </tbody>
            </table>
          </div>

          {activeModal && (
              <ActionModal 
                isOpen={true} 
                title="Add New Event"
                onClose={() => setActiveModal(null)}
                onSubmit={handleCreateEvent}
              >
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                    <input 
                        type="text" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500"
                        placeholder="e.g. CES 2024"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input 
                        type="date" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                </div>
              </ActionModal>
          )}
        </div>
      );
  };

  const EventManager = ({ eventId }: { eventId: string }) => {
      const event = events.find(e => e.id === eventId);
      const client = clients.find(c => c.id === event?.clientId);
      const eventSpaces = (Object.values(spaces) as Space[]).filter(s => s.eventId === eventId);

      // Modal State
      const [spaceModalOpen, setSpaceModalOpen] = useState(false);
      const [beaconModalOpen, setBeaconModalOpen] = useState<string | null>(null); // spaceId
      const [formData, setFormData] = useState({ name: '', type: 'Booth' });
      
      // Edit/Delete Event State
      const [isEditEventOpen, setIsEditEventOpen] = useState(false);
      const [isDeleteEventOpen, setIsDeleteEventOpen] = useState(false);
      const [eventEditData, setEventEditData] = useState({ name: event?.name || '', date: event?.date || '' });

      if (!event || !client) return <div>Event not found</div>;

      const handleAddSpace = () => {
          const newSpace: Space = {
              id: `s${Date.now()}`,
              eventId: event.id,
              name: formData.name,
              type: formData.type as any
          };
          setSpaces(prev => ({ ...prev, [newSpace.id]: newSpace }));
          setSpaceModalOpen(false);
          setFormData({ name: '', type: 'Booth' });
      };

      const handleAddBeaconToSpace = (beaconId: string, spaceId: string) => {
          handleAssignBeacon(beaconId, client.id, spaceId);
          setBeaconModalOpen(null);
      };

      const handleUpdateEvent = () => {
          setEvents(prev => prev.map(e => e.id === event.id ? { ...e, ...eventEditData } : e));
          setIsEditEventOpen(false);
      };

      const handleDeleteEvent = () => {
          // 1. Unassign beacons from spaces in this event
          const eventSpaceIds = (Object.values(spaces) as Space[]).filter(s => s.eventId === event.id).map(s => s.id);
          setBeacons(prev => prev.map(b => 
              (b.assignedSpaceId && eventSpaceIds.includes(b.assignedSpaceId)) 
                  ? { ...b, assignedSpaceId: null } // Return to client inventory
                  : b
          ));

          // 2. Delete spaces
          setSpaces(prev => {
              const next = { ...prev };
              eventSpaceIds.forEach(id => delete next[id]);
              return next;
          });

          // 3. Delete event
          setEvents(prev => prev.filter(e => e.id !== event.id));
          
          // 4. Navigate back
          setManagedEventId(null);
      };

      // Filter beacons for assignment modal
      const availableBeacons = beacons.filter(b => 
          !b.assignedClientId || (b.assignedClientId === client.id && !b.assignedSpaceId)
      );
      const clientStock = availableBeacons.filter(b => b.assignedClientId === client.id);
      const globalStock = availableBeacons.filter(b => !b.assignedClientId);

      return (
        <div className="animate-fade-in-up space-y-6">
            {/* Header */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setManagedEventId(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <span>{client.name}</span>
                            <ChevronRight size={14} />
                            <span>Events</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{event.name}</h2>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => {
                            setEventEditData({ name: event.name, date: event.date });
                            setIsEditEventOpen(true);
                        }}
                        className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                        title="Edit Event Details"
                    >
                        <Edit2 size={20} />
                    </button>
                    <button 
                        onClick={() => setIsDeleteEventOpen(true)}
                        className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete Event"
                    >
                        <Trash2 size={20} />
                    </button>
                    <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>
                    <div className="px-4 py-2 bg-gray-50 rounded-xl text-sm font-medium text-gray-600 hidden md:block">
                        {event.date}
                    </div>
                    <button 
                        onClick={() => setSpaceModalOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-mole-yellow text-mole-900 px-5 py-2.5 rounded-xl font-bold hover:bg-mole-400 transition-colors shadow-lg shadow-mole-500/20"
                    >
                        <Plus size={18} /> Add Exhibitor / Space
                    </button>
                </div>
            </div>

            {/* Spaces Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventSpaces.map(space => {
                    const assignedBeacons = beacons.filter(b => b.assignedSpaceId === space.id);
                    
                    return (
                        <div key={space.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-gray-50 flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-plexyz-50 text-plexyz-600 rounded-xl">
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{space.name}</h4>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{space.type}</span>
                                    </div>
                                </div>
                                <button className="text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            
                            <div className="p-5 flex-1 bg-gray-50/50">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Beacons</span>
                                    <span className="text-xs font-medium text-gray-400">{assignedBeacons.length} Active</span>
                                </div>
                                
                                <div className="space-y-2">
                                    {assignedBeacons.map(beacon => (
                                        <div key={beacon.id} className="bg-white border border-gray-200 p-2.5 rounded-xl flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Radio size={14} className="text-mole-600" />
                                                <span className="text-sm font-mono font-medium text-gray-700">{beacon.macAddress}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleAssignBeacon(beacon.id, client.id, null)} // Unassign from space, keep on client
                                                className="text-gray-400 hover:text-red-500 p-1"
                                                title="Remove from Space"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {assignedBeacons.length === 0 && (
                                        <div className="text-center py-4 text-gray-400 text-sm italic border-2 border-dashed border-gray-200 rounded-xl">
                                            No beacons assigned
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="p-4 border-t border-gray-100 bg-white">
                                <button 
                                    onClick={() => setBeaconModalOpen(space.id)}
                                    className="w-full py-2 flex items-center justify-center gap-2 text-sm font-bold text-plexyz-600 bg-plexyz-50 hover:bg-plexyz-100 rounded-xl transition-colors"
                                >
                                    <LinkIcon size={16} /> Assign Beacon
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            
             {/* Edit Event Modal */}
             <ActionModal
                isOpen={isEditEventOpen}
                title="Edit Event Details"
                onClose={() => setIsEditEventOpen(false)}
                onSubmit={handleUpdateEvent}
                submitLabel="Save Changes"
             >
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Name</label>
                    <input 
                        type="text" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500 transition-all font-medium text-gray-900"
                        value={eventEditData.name}
                        onChange={e => setEventEditData({...eventEditData, name: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                    <input 
                        type="date" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500 transition-all font-medium text-gray-900"
                        value={eventEditData.date}
                        onChange={e => setEventEditData({...eventEditData, date: e.target.value})}
                    />
                </div>
             </ActionModal>

             {/* Delete Event Modal */}
             <ActionModal
                isOpen={isDeleteEventOpen}
                title="Delete Event?"
                onClose={() => setIsDeleteEventOpen(false)}
                onSubmit={handleDeleteEvent}
                submitLabel="Delete Event"
                isDanger={true}
             >
                 <div className="flex items-start gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                     <AlertTriangle className="text-red-600 shrink-0" size={24} />
                     <div className="text-sm text-red-800">
                         <p className="font-bold mb-1">This action cannot be undone.</p>
                         <p>Deleting <strong>{event.name}</strong> will remove all defined spaces. Beacons currently assigned to these spaces will be returned to the client's inventory.</p>
                     </div>
                 </div>
             </ActionModal>

             {/* Enhanced Beacon Assignment Modal */}
             {beaconModalOpen && (
                <ActionModal
                    isOpen={true}
                    title="Assign Beacon to Space"
                    onClose={() => setBeaconModalOpen(null)}
                    onSubmit={() => {}} 
                >
                    <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4">
                         
                         {/* Section 1: Client Stock */}
                         <div>
                             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                                 <span>Client Stock ({clientStock.length})</span>
                                 <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">Preferred</span>
                             </h4>
                             {clientStock.length === 0 ? (
                                 <div className="text-sm text-gray-400 italic p-3 text-center bg-gray-50 rounded-xl border border-dashed">
                                     No unassigned beacons in client inventory.
                                 </div>
                             ) : (
                                 <div className="space-y-2">
                                     {clientStock.map(beacon => (
                                         <button
                                            key={beacon.id}
                                            onClick={() => handleAddBeaconToSpace(beacon.id, beaconModalOpen)}
                                            className="w-full flex items-center justify-between p-3 bg-white border border-plexyz-200 rounded-xl hover:border-plexyz-500 hover:shadow-md transition-all group"
                                         >
                                             <div className="flex items-center gap-3">
                                                 <div className="p-2 bg-plexyz-50 text-plexyz-600 rounded-lg">
                                                     <Building2 size={16} />
                                                 </div>
                                                 <div className="text-left">
                                                     <div className="font-mono font-bold text-sm text-gray-700">{beacon.macAddress}</div>
                                                     <div className="text-[10px] text-green-600 font-medium">Available in Stock</div>
                                                 </div>
                                             </div>
                                             <Plus size={16} className="text-gray-300 group-hover:text-plexyz-600" />
                                         </button>
                                     ))}
                                 </div>
                             )}
                         </div>

                         {/* Section 2: Global Inventory */}
                         <div className="pt-2 border-t border-gray-100">
                             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Global Inventory ({globalStock.length})</h4>
                             {globalStock.length === 0 ? (
                                 <div className="text-sm text-gray-400 italic p-3 text-center">No available global beacons.</div>
                             ) : (
                                 <div className="space-y-2">
                                     {globalStock.map(beacon => (
                                         <button
                                            key={beacon.id}
                                            onClick={() => handleAddBeaconToSpace(beacon.id, beaconModalOpen)}
                                            className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-mole-400 hover:bg-mole-50 transition-colors group opacity-80 hover:opacity-100"
                                         >
                                             <div className="flex items-center gap-3">
                                                 <div className="p-2 bg-gray-100 text-gray-400 rounded-lg group-hover:bg-white group-hover:text-mole-500">
                                                     <Radio size={16} />
                                                 </div>
                                                 <div className="text-left">
                                                     <div className="font-mono font-bold text-sm text-gray-700">{beacon.macAddress}</div>
                                                     <div className="text-[10px] text-gray-400">Unassigned</div>
                                                 </div>
                                             </div>
                                             <Plus size={16} className="text-gray-300 group-hover:text-mole-600" />
                                         </button>
                                     ))}
                                 </div>
                             )}
                         </div>

                    </div>
                     <style>{`.bg-gray-50.flex.justify-end { display: none; }`}</style>
                </ActionModal>
            )}
        </div>
      );
  };

  const BeaconManager = () => {
    const [selectedBeaconIds, setSelectedBeaconIds] = useState<Set<string>>(new Set());
    const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
    const [bulkAssignClient, setBulkAssignClient] = useState('');

    const toggleSelection = (id: string) => {
        const next = new Set(selectedBeaconIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedBeaconIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedBeaconIds.size === beacons.length) {
            setSelectedBeaconIds(new Set());
        } else {
            setSelectedBeaconIds(new Set(beacons.map(b => b.id)));
        }
    };

    const handleBulkAssign = () => {
        if (!bulkAssignClient) return;
        setBeacons(prev => prev.map(b => {
            if (selectedBeaconIds.has(b.id)) {
                return {
                    ...b,
                    assignedClientId: bulkAssignClient,
                    assignedSpaceId: null, // Reset space on bulk client move
                    status: 'Active'
                };
            }
            return b;
        }));
        setSelectedBeaconIds(new Set());
        setIsBulkAssignOpen(false);
        setBulkAssignClient('');
    };

    const handleBulkUnassign = () => {
        setBeacons(prev => prev.map(b => {
            if (selectedBeaconIds.has(b.id)) {
                return {
                    ...b,
                    assignedClientId: null,
                    assignedSpaceId: null,
                    status: 'Inactive'
                };
            }
            return b;
        }));
        setSelectedBeaconIds(new Set());
    };

    return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in-up relative">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h3 className="font-bold text-gray-900 text-lg">Beacon Inventory</h3>
                <p className="text-sm text-gray-500">Manage assignment and monitor health</p>
            </div>
            <div className="flex items-center gap-3">
                 <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                     <Filter size={16} /> Filter
                 </button>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-mole-400 outline-none w-56"
                    />
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                    <tr>
                        <th className="px-6 py-4 w-12 text-center">
                            <button onClick={toggleSelectAll} className="text-gray-400 hover:text-mole-600">
                                {selectedBeaconIds.size === 0 ? <Square size={20} /> : 
                                 selectedBeaconIds.size === beacons.length ? <CheckSquare size={20} className="text-mole-600" /> : 
                                 <MinusSquare size={20} className="text-mole-600" />}
                            </button>
                        </th>
                        <th className="px-6 py-4">Beacon ID / MAC</th>
                        <th className="px-6 py-4">Battery</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Assigned To</th>
                        <th className="px-6 py-4">Last Ping</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {beacons.map(beacon => {
                         const batteryColor = beacon.batteryLevel > 50 ? 'text-green-500' : beacon.batteryLevel > 20 ? 'text-yellow-500' : 'text-red-500';
                         const BatteryIcon = beacon.batteryLevel > 50 ? Battery : beacon.batteryLevel > 20 ? BatteryMedium : BatteryLow;
                         const isSelected = selectedBeaconIds.has(beacon.id);
                        
                        return (
                        <tr key={beacon.id} className={`transition-colors ${isSelected ? 'bg-mole-50/30' : 'hover:bg-gray-50'}`}>
                            <td className="px-6 py-4 text-center">
                                <button onClick={() => toggleSelection(beacon.id)} className="text-gray-300 hover:text-mole-600">
                                    {isSelected ? <CheckSquare size={20} className="text-mole-600" /> : <Square size={20} />}
                                </button>
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-mono text-xs font-bold text-gray-700 bg-gray-100 inline-block px-2 py-1 rounded">
                                    {beacon.macAddress}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1">ID: {beacon.id}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className={`flex items-center gap-2 ${batteryColor} font-bold text-sm`}>
                                    <BatteryIcon size={18} />
                                    {beacon.batteryLevel}%
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className={`flex items-center gap-2 text-sm font-medium ${beacon.status === 'Active' ? 'text-green-700' : 'text-gray-500'}`}>
                                    <span className={`w-2 h-2 rounded-full ${beacon.status === 'Active' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                                    {beacon.status}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                {beacon.assignedClientId ? (
                                    <div className="flex items-start justify-between gap-2 max-w-[240px]">
                                        <div className="flex flex-col gap-1">
                                            {/* Client Badge */}
                                            <div className="flex items-center gap-1.5 font-bold text-sm text-gray-800 bg-white border border-gray-200 px-2 py-1 rounded-lg shadow-sm">
                                                <Building2 size={12} className="text-gray-400" />
                                                <span className="truncate max-w-[120px]">{clients.find(c => c.id === beacon.assignedClientId)?.name}</span>
                                            </div>
                                            {/* Space Badge */}
                                            {beacon.assignedSpaceId ? (
                                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-plexyz-700 bg-plexyz-50 px-2 py-0.5 rounded-md w-fit border border-plexyz-100 ml-1">
                                                    <MapPin size={10} />
                                                    {spaces[beacon.assignedSpaceId]?.name}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md w-fit flex items-center gap-1 ml-1 font-medium border border-orange-100">
                                                    <AlertCircle size={10} />
                                                    In Stock (Unused)
                                                </div>
                                            )}
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleAssignBeacon(beacon.id, null, null)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Unassign Beacon"
                                        >
                                            <Unlink size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative group w-[200px]">
                                        <select 
                                            className="w-full bg-white border border-gray-200 text-gray-500 text-sm rounded-xl px-3 py-2 pr-8 focus:ring-2 focus:ring-plexyz-500 appearance-none cursor-pointer hover:border-mole-400 transition-colors shadow-sm"
                                            onChange={(e) => handleAssignBeacon(beacon.id, e.target.value, null)}
                                            value=""
                                        >
                                            <option value="" disabled>+ Assign to Client</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-gray-600" />
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                                {beacon.lastPing}
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>

        {/* Bulk Action Bar */}
        <div className={`absolute bottom-0 inset-x-0 bg-white border-t border-mole-200 p-4 shadow-2xl transform transition-transform duration-300 flex items-center justify-between z-10 ${selectedBeaconIds.size > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
             <div className="flex items-center gap-4">
                 <div className="bg-mole-900 text-white text-sm font-bold px-3 py-1 rounded-lg">
                     {selectedBeaconIds.size} Selected
                 </div>
                 <span className="text-sm text-gray-500">Choose an action for selected items:</span>
             </div>
             <div className="flex items-center gap-3">
                 <button 
                    onClick={handleBulkUnassign}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                 >
                     <Unlink size={16} /> Unassign All
                 </button>
                 <button 
                    onClick={() => setIsBulkAssignOpen(true)}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-mole-900 bg-mole-yellow hover:bg-mole-400 rounded-xl transition-colors shadow-lg shadow-mole-500/20"
                 >
                     <Building2 size={16} /> Assign to Client
                 </button>
             </div>
        </div>

        {/* Bulk Assign Modal */}
        <ActionModal
            isOpen={isBulkAssignOpen}
            title={`Assign ${selectedBeaconIds.size} Beacons`}
            onClose={() => setIsBulkAssignOpen(false)}
            onSubmit={handleBulkAssign}
            submitLabel="Assign Beacons"
        >
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Client</label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {clients.map(client => (
                        <label 
                            key={client.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                bulkAssignClient === client.id 
                                    ? 'bg-mole-50 border-mole-500 shadow-sm' 
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    bulkAssignClient === client.id ? 'border-mole-600 bg-mole-600' : 'border-gray-300'
                                }`}>
                                    {bulkAssignClient === client.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-900">{client.name}</div>
                                    <div className="text-xs text-gray-500">{client.beaconsAssigned} active beacons</div>
                                </div>
                            </div>
                            <input 
                                type="radio" 
                                name="bulkClient" 
                                className="hidden"
                                checked={bulkAssignClient === client.id}
                                onChange={() => setBulkAssignClient(client.id)}
                            />
                        </label>
                    ))}
                </div>
            </div>
        </ActionModal>
    </div>
  )};

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <AddClientWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        availableBeacons={beacons.filter(b => !b.assignedClientId)} // Only pass unassigned beacons
        onComplete={handleWizardComplete}
      />

      {/* Sidebar */}
      <aside className="w-64 bg-plexyz-900 flex-shrink-0 flex flex-col text-white transition-all duration-300">
        <div className="p-6 border-b border-plexyz-700">
            <div className="flex items-center gap-2 text-mole-yellow">
                <LayoutDashboard size={24} />
                <span className="text-xl font-bold tracking-tight">Admin Portal</span>
            </div>
            <p className="text-xs font-medium text-plexyz-200 mt-1 opacity-80">Mole Analytics Core</p>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
            <SidebarItem tab="overview" icon={LayoutDashboard} label="Dashboard" />
            <SidebarItem tab="clients" icon={Users} label="Client Accounts" />
            <SidebarItem tab="beacons" icon={Radio} label="Beacon Management" />
            <SidebarItem tab="data-sources" icon={Database} label="Data Sources" />
        </nav>

        <div className="p-4 border-t border-plexyz-700 space-y-2">
            {/* User Account moved to bottom */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-plexyz-800/50 border border-plexyz-700 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-plexyz-400 to-plexyz-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                    AD
                </div>
                <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-bold text-white truncate">Admin User</div>
                    <div className="text-[10px] text-plexyz-300 font-medium truncate">Super Admin</div>
                </div>
            </div>

            <button className="w-full flex items-center gap-3 px-4 py-2 text-plexyz-300 hover:text-white hover:bg-plexyz-800 rounded-lg transition-colors text-sm font-medium">
                <Settings size={18} />
                <span>Settings</span>
            </button>
            <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-red-300 hover:text-red-100 hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
            >
                <LogOut size={18} />
                <span>Sign Out</span>
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Enhanced Navbar */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-20 shadow-sm/50 backdrop-blur-md bg-white/90">
            <div className="flex items-center gap-4">
                {managedEventId && (
                     <button onClick={() => setManagedEventId(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                        {pageInfo.title}
                    </h1>
                    <p className="text-sm text-gray-500 font-medium mt-0.5">
                        {pageInfo.description}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-xs font-bold bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    System Operational
                </div>
                
                <div className="h-8 w-px bg-gray-200" />
                
                <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
            </div>
        </header>

        <div className="p-8">
            {managedEventId ? (
                <EventManager eventId={managedEventId} />
            ) : (
                <>
                    {activeTab === 'overview' && <Overview />}
                    {activeTab === 'clients' && <ClientList />}
                    {activeTab === 'beacons' && <BeaconManager />}
                    {activeTab === 'data-sources' && (
                        <DataSourceManager 
                            events={events} 
                            spaces={spaces} 
                            onDataUpdate={(id, type, data) => console.log('Data updated:', id, type, data)} 
                        />
                    )}
                </>
            )}
        </div>
      </main>
    </div>
  );
};