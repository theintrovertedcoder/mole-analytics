import React, { useState, useMemo } from 'react';
import { FunnelState, TimeGranularity, FunnelStageData, BOOTH_OPTIONS, ViewMode } from './types';
import { Controls } from './components/Controls';
import { Funnel } from './components/Funnel';
import { BottomSheet } from './components/BottomSheet';
import { Insights } from './components/Insights';
import { DashboardMetrics } from './components/DashboardMetrics';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminPortal } from './components/admin/AdminPortal';
import { Landing } from './components/Landing';
import { LogOut, LayoutTemplate, Store } from 'lucide-react';

// --- Header Component ---
const Header = ({ mode, onLogout }: { mode: ViewMode, onLogout: () => void }) => {
  const isOrganizer = mode === 'ORGANIZER_DASHBOARD';
  
  return (
    <header className="pt-6 lg:pt-0 pb-8 mb-4 lg:mb-8 border-b border-gray-100/50">
      {/* Top Bar: Brand & Actions */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-mole-500 to-mole-600 rounded-xl flex items-center justify-center text-plexyz-900 shadow-lg shadow-mole-200">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9z"/><path d="M8 14v-4l2 2 2-2v4"/></svg>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">Mole Analytics</span>
        </div>
        
        <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
        >
            <span>Switch Role</span>
            <LogOut size={16} />
        </button>
      </div>
      
      {/* Page Context */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
            {isOrganizer ? 'Event Performance' : 'Booth Performance'}
            </h2>
            
            {isOrganizer ? (
                <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-plexyz-700 bg-plexyz-50 border border-plexyz-100 px-3 py-1 rounded-full text-sm font-bold">
                    <LayoutTemplate size={14} /> Organizer View
                </span>
            ) : (
                <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-mole-700 bg-mole-50 border border-mole-100 px-3 py-1 rounded-full text-sm font-bold">
                    <Store size={14} /> Exhibitor View
                </span>
            )}
        </div>
        
        <p className="text-base lg:text-lg text-gray-500 max-w-3xl leading-relaxed">
            {isOrganizer 
                ? "Aggregated footfall and engagement metrics across the venue." 
                : "Track your specific booth's performance, capture rate, and dwell times."}
        </p>
      </div>
    </header>
  );
};

const App = () => {
  // --- Routing State ---
  const [currentView, setCurrentView] = useState<ViewMode>('LANDING');

  // --- Funnel State (Client View) ---
  const [state, setState] = useState<FunnelState>({
    dwellThreshold: 2,
    granularity: TimeGranularity.EVENT,
    showPercentage: false,
    selectedBooth: BOOTH_OPTIONS[0],
    connectionGoal: 100, // Default goal
  });

  const [selectedStage, setSelectedStage] = useState<FunnelStageData | null>(null);

  const updateState = (newState: Partial<FunnelState>) => {
    setState(prev => ({ ...prev, ...newState }));
  };

  const isOrganizer = currentView === 'ORGANIZER_DASHBOARD';

  // --- Derived Data Logic ---
  const funnelData = useMemo<FunnelStageData[]>(() => {
    // SCENARIO 1: ORGANIZER (Aggregated Event Data)
    if (isOrganizer) {
        const totalAttendees = 8500; // Total badge holders detected
        const totalBoothVisits = 12450; // Sum of all booth visits (people visit multiple)
        
        // This is a bit unique for Organizer view - Stage 1 is venue capacity, Stage 2 is interaction
        
        // Let's stick to the Funnel Metaphor but aggregated
        const baseTraffic = state.granularity === TimeGranularity.EVENT ? 8500 : (state.granularity === TimeGranularity.DAY ? 2800 : 450);
        
        // Aggregate Visit Rate (High because people visit multiple booths)
        const totalVisits = Math.floor(baseTraffic * 1.5); 
        
        // Aggregate Engagement (People staying at booths)
        const totalEngaged = Math.floor(totalVisits * 0.35);

        // Aggregate Connections
        const totalConnections = Math.floor(totalEngaged * 0.15);

        // Rates
        const avgBoothsPerPerson = (totalVisits / baseTraffic).toFixed(1);

        return [
            {
                id: '1',
                label: 'Total Attendees',
                count: baseTraffic,
                iconType: 'people',
                colorTheme: 'neutral',
                description: 'Total unique individuals detected within the venue perimeter.',
                howItIsMeasured: 'PLExyz Venue-Wide Mesh Detection.'
            },
            {
                id: '2',
                label: 'Total Booth Visits',
                count: totalVisits,
                conversionRate: 0, // Not applicable in same way
                subtext: `Avg ${avgBoothsPerPerson} booths/person`,
                iconType: 'pin',
                colorTheme: 'transition',
                description: 'Aggregate number of times attendees entered any booth zone.',
                howItIsMeasured: 'Sum of all booth beacon entry events.'
            },
            {
                id: '3',
                label: 'Deep Engagements',
                count: totalEngaged,
                conversionRate: parseFloat(((totalEngaged/totalVisits)*100).toFixed(1)),
                iconType: 'clock',
                colorTheme: 'engaged',
                description: `Visits lasting longer than the average dwell threshold (> ${state.dwellThreshold} mins).`,
                howItIsMeasured: 'Duration analysis of booth sessions.'
            },
            {
                id: '4',
                label: 'Total Connections',
                count: totalConnections,
                conversionRate: parseFloat(((totalConnections/totalEngaged)*100).toFixed(1)),
                iconType: 'connection',
                colorTheme: 'success',
                description: 'Total verified contacts/leads generated across all exhibitors.',
                howItIsMeasured: 'Mole App confirmed exchanges.'
            }
        ];
    }

    // SCENARIO 2: EXHIBITOR (Specific Booth Data)
    // Base numbers for the event context
    const baseTraffic = state.granularity === TimeGranularity.EVENT ? 4320 : (state.granularity === TimeGranularity.DAY ? 1450 : 210);
    
    // Visit rate is relatively constant for a single booth
    const visitors = Math.floor(baseTraffic * 0.26); // ~26%
    
    // Engaged depends heavily on dwell threshold
    const decayFactor = Math.max(0.1, 1 - (state.dwellThreshold / 15)); 
    const engagedRaw = Math.floor(visitors * 0.45 * decayFactor); 
    const engaged = Math.max(1, engagedRaw); 

    const connections = Math.floor(visitors * 0.085); 

    // Conversion rates for display
    const visitRate = ((visitors / baseTraffic) * 100).toFixed(1);
    const engageRate = ((engaged / visitors) * 100).toFixed(0);
    const connectRate = ((connections / engaged) * 100).toFixed(1);

    return [
      {
        id: '1',
        label: 'People at Event',
        count: baseTraffic,
        iconType: 'people',
        colorTheme: 'neutral',
        helperText: 'Venue Traffic',
        description: 'The total number of unique individuals detected within the event venue radius during the selected time period.',
        howItIsMeasured: 'Passive Wi-Fi and Bluetooth signal density analysis anonymized by PLExyz Intelligence Layer.'
      },
      {
        id: '2',
        label: 'Visited My Booth',
        count: visitors,
        conversionRate: parseFloat(visitRate),
        iconType: 'pin',
        colorTheme: 'transition',
        description: 'Individuals who entered the immediate vicinity of your specific booth (geofenced zone).',
        howItIsMeasured: 'High-precision location triangulation when a signal dwells within your booth perimeter for >30 seconds.'
      },
      {
        id: '3',
        label: 'Stayed & Engaged',
        count: engaged,
        conversionRate: parseFloat(engageRate),
        subtext: `Avg dwell: ${Math.floor(2 + state.dwellThreshold * 1.2)}m`,
        iconType: 'clock',
        colorTheme: 'engaged',
        helperText: `>${state.dwellThreshold} min dwell`,
        description: `Visitors who remained within your booth area for longer than your configured threshold of ${state.dwellThreshold} minutes.`,
        howItIsMeasured: `Continuous signal presence monitoring. Filters out pass-by traffic to isolate genuine interest.`
      },
      {
        id: '4',
        label: 'My Connections',
        count: connections,
        conversionRate: parseFloat(connectRate),
        iconType: 'connection',
        colorTheme: 'success',
        description: 'Digital handshakes, contact exchanges, or lead captures initiated via your Mole app profile.',
        howItIsMeasured: 'Verified digital interactions and contact card exchanges recorded in the Mole database.'
      }
    ];
  }, [state.granularity, state.dwellThreshold, isOrganizer]);

  const currentCaptureRate = funnelData[1].conversionRate || 0;
  const currentAvgDwell = funnelData[2].subtext?.split(': ')[1] || '0m';

  // --- ROUTING RENDER ---

  if (currentView === 'LANDING') {
      return <Landing onSelectRole={setCurrentView} />;
  }

  if (currentView === 'ADMIN_LOGIN') {
    return <AdminLogin onLogin={() => setCurrentView('ADMIN_PORTAL')} onBack={() => setCurrentView('LANDING')} />;
  }

  if (currentView === 'ADMIN_PORTAL') {
    return <AdminPortal onLogout={() => setCurrentView('LANDING')} />;
  }

  // --- DASHBOARD RENDER (Organizer or Exhibitor) ---

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
      <div className="w-full max-w-md lg:max-w-[1400px] mx-auto px-6 lg:px-12 pb-12 lg:py-12">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-12 lg:items-start">
          
          {/* Left Column: Context & Controls */}
          <aside className="lg:col-span-4 lg:sticky lg:top-12 space-y-6 lg:space-y-8">
            <Header mode={currentView} onLogout={() => setCurrentView('LANDING')} />
            
            {/* Conditional Controls based on Role */}
            <div className={`${isOrganizer ? 'opacity-80' : ''}`}>
                <Controls 
                    state={state} 
                    onStateChange={updateState} 
                />
            </div>
            
            {/* Show Insights in sidebar on Desktop for better balance */}
            <div className="hidden lg:block">
                 <Insights captureRate={currentCaptureRate} avgDwell={currentAvgDwell} />
            </div>
          </aside>
          
          {/* Right Column: Visualization & Dashboard */}
          <main className="lg:col-span-8 w-full flex flex-col gap-6 lg:mt-6">
            <Funnel 
              data={funnelData} 
              showPercentage={state.showPercentage}
              onStageClick={setSelectedStage}
            />
            
            {/* Desktop Only: Enhanced Dashboard Metrics */}
            <div className="hidden lg:block">
                <DashboardMetrics 
                    currentConnections={funnelData[3].count} 
                    connectionGoal={isOrganizer ? state.connectionGoal * 15 : state.connectionGoal} 
                />
            </div>

            {/* Mobile Only: Simple Insights below funnel */}
            <div className="block lg:hidden">
                <Insights captureRate={currentCaptureRate} avgDwell={currentAvgDwell} />
            </div>
          </main>
        </div>
      </div>

      <BottomSheet 
        isOpen={!!selectedStage} 
        onClose={() => setSelectedStage(null)} 
        data={selectedStage} 
      />
    </div>
  );
};

export default App;