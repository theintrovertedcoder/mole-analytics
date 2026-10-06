import React from 'react';
import { Shield, LayoutTemplate, Store, ArrowRight } from 'lucide-react';
import { ViewMode } from '../types';

interface LandingProps {
  onSelectRole: (role: ViewMode) => void;
}

export const Landing: React.FC<LandingProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-4xl w-full">
        {/* Brand Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-mole-500 to-mole-600 rounded-2xl flex items-center justify-center text-plexyz-900 shadow-lg shadow-mole-200">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7"><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9z"/><path d="M8 14v-4l2 2 2-2v4"/></svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mole Analytics</h1>
          </div>
          <p className="text-xl text-gray-500 max-w-xl mx-auto">
            The complete engagement funnel for physical spaces. <br/>
            <span className="text-sm font-medium text-plexyz-600">Powered by PLExyz Intelligence Layer</span>
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Organizer */}
          <button 
            onClick={() => onSelectRole('ORGANIZER_DASHBOARD')}
            className="group relative bg-white hover:bg-plexyz-50 border border-gray-200 hover:border-plexyz-200 p-8 rounded-3xl text-left transition-all hover:-translate-y-1 hover:shadow-xl shadow-sm flex flex-col h-full"
          >
            <div className="w-12 h-12 bg-plexyz-100 text-plexyz-700 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <LayoutTemplate size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Event Organizer</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              View aggregate event performance, total footfall, and overall sponsor ROI across the entire venue.
            </p>
            <div className="mt-auto flex items-center gap-2 text-sm font-bold text-plexyz-600">
              View Event Dashboard <ArrowRight size={16} />
            </div>
          </button>

          {/* Exhibitor */}
          <button 
            onClick={() => onSelectRole('EXHIBITOR_DASHBOARD')}
            className="group relative bg-white hover:bg-mole-50 border border-gray-200 hover:border-mole-200 p-8 rounded-3xl text-left transition-all hover:-translate-y-1 hover:shadow-xl shadow-sm flex flex-col h-full"
          >
            <div className="w-12 h-12 bg-mole-100 text-mole-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Store size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Exhibitor</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Track your specific booth's performance, capture rate, dwell times, and lead generation.
            </p>
            <div className="mt-auto flex items-center gap-2 text-sm font-bold text-mole-700">
              View Booth Analytics <ArrowRight size={16} />
            </div>
          </button>

          {/* Admin */}
          <button 
            onClick={() => onSelectRole('ADMIN_LOGIN')}
            className="group relative bg-gray-900 hover:bg-gray-800 border border-gray-700 p-8 rounded-3xl text-left transition-all hover:-translate-y-1 hover:shadow-xl shadow-sm flex flex-col h-full"
          >
            <div className="w-12 h-12 bg-gray-700 text-gray-300 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">System Admin</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Configure clients, assign beacons, manage events, and monitor system health.
            </p>
            <div className="mt-auto flex items-center gap-2 text-sm font-bold text-gray-300 group-hover:text-white">
              Access Portal <ArrowRight size={16} />
            </div>
          </button>

        </div>
        
        <div className="mt-12 text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Mole Analytics Core v1.0
            </span>
        </div>
      </div>
    </div>
  );
};