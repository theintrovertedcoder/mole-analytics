import React from 'react';
import { Sparkles } from 'lucide-react';

interface InsightProps {
  captureRate: number;
  avgDwell: string;
}

export const Insights: React.FC<InsightProps> = ({ captureRate, avgDwell }) => {
  return (
    <div className="mt-8 mb-12 lg:mt-0 lg:mb-0 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Sparkles className="w-4 h-4 text-mole-500" />
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Automated Insights</h3>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-gray-800 text-sm leading-relaxed">
            Your capture rate of <strong className="text-mole-600">{captureRate}%</strong> is trending upwards compared to yesterday (+4.2%).
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-gray-800 text-sm leading-relaxed">
            High average dwell time (<strong className="text-plexyz-600">{avgDwell}</strong>) suggests strong content engagement, but connection rate dropped slightly at 3 PM.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow sm:col-span-2">
            <p className="text-gray-800 text-sm leading-relaxed">
                Peak engagement happened between <strong className="text-gray-900">2–3 PM</strong>. Consider staffing up during this window tomorrow.
            </p>
        </div>
      </div>
      
      <div className="mt-6 text-center">
         <p className="text-[10px] text-gray-400 font-medium">
            Insights powered by <span className="text-mole-500">Mole</span> × <span className="text-plexyz-500">PLExyz</span>
         </p>
      </div>
    </div>
  );
};