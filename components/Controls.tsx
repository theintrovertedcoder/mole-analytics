import React from 'react';
import { FunnelState, TimeGranularity, BOOTH_OPTIONS } from '../types';
import { Clock, ChevronDown, Target } from 'lucide-react';

interface ControlsProps {
  state: FunnelState;
  onStateChange: (newState: Partial<FunnelState>) => void;
  isOrganizer?: boolean; // Prop to disable specific controls
}

export const Controls: React.FC<ControlsProps> = ({ state, onStateChange }) => {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 space-y-6">
      
      {/* Top Row: Booth & Granularity */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        
        {/* Booth Selector (Always visible, but functionally "View All" for Organizer conceptually in this demo, 
            though for Phase 1 we might just treat the organizer as seeing the Aggregate context. 
            Let's keep it editable for Exhibitor, but maybe generic for Organizer) */}
        <div className="relative group w-full sm:w-auto">
          <select 
            value={state.selectedBooth}
            onChange={(e) => onStateChange({ selectedBooth: e.target.value })}
            className="w-full appearance-none bg-gray-50 hover:bg-gray-100 text-gray-900 font-medium py-3 pl-4 pr-10 rounded-xl border-0 focus:ring-2 focus:ring-mole-200 transition-shadow cursor-pointer text-sm truncate max-w-[220px]"
          >
            {BOOTH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div className="flex p-1 bg-gray-100 rounded-xl w-full sm:w-auto self-start">
          {Object.values(TimeGranularity).map((t) => (
            <button
              key={t}
              onClick={() => onStateChange({ granularity: t })}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                state.granularity === t 
                  ? 'bg-white text-mole-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Dwell Slider */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-plexyz-600" />
            <label className="text-sm font-medium text-gray-700">Dwell Threshold</label>
          </div>
          <span className="text-sm font-bold text-mole-600 bg-mole-50 px-2 py-0.5 rounded-md tabular-nums">
            {state.dwellThreshold} min
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="15"
          step="0.5"
          value={state.dwellThreshold}
          onChange={(e) => onStateChange({ dwellThreshold: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-mole-600 hover:accent-mole-500 focus:outline-none focus:ring-2 focus:ring-mole-300 focus:ring-offset-2"
        />
        <div className="flex justify-between mt-2">
            <span className="text-[10px] text-gray-400">Casual (1m)</span>
            <span className="text-[10px] text-gray-400">Deep (15m)</span>
        </div>
      </div>

      {/* Goal Setting */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-mole-yellow-dark" />
            <label className="text-sm font-medium text-gray-700">Daily Connection Goal</label>
          </div>
        </div>
        <div className="relative">
             <input 
                type="number"
                min="1"
                value={state.connectionGoal}
                onChange={(e) => onStateChange({ connectionGoal: parseInt(e.target.value) || 0 })}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-xl border-0 focus:ring-2 focus:ring-mole-yellow transition-shadow text-sm"
             />
             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                 connections
             </span>
        </div>
      </div>

      {/* Toggle View */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-500">Display numbers as</span>
        <button
          onClick={() => onStateChange({ showPercentage: !state.showPercentage })}
          className="text-xs font-semibold text-plexyz-600 hover:text-plexyz-700 transition-colors bg-plexyz-50 px-3 py-1.5 rounded-lg"
        >
          {state.showPercentage ? 'Absolute' : 'Percentage'}
        </button>
      </div>
    </div>
  );
};