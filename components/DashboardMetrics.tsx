import React, { useState, useRef, useMemo } from 'react';
import { TrendingUp, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardMetricsProps {
    currentConnections: number;
    connectionGoal: number;
}

// --- Internal Chart Component ---
const HourlyTrafficChart = () => {
    // Mock Data
    const data = [
        { label: '10am', value: 32 },
        { label: '11am', value: 45 },
        { label: '12pm', value: 82 },
        { label: '1pm', value: 64 },
        { label: '2pm', value: 95 },
        { label: '3pm', value: 72 },
        { label: '4pm', value: 48 },
    ];

    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const maxValue = Math.max(...data.map(d => d.value)) * 1.15; // +15% headroom

    // Generate coordinate points (0-100 scale)
    const points = useMemo(() => data.map((d, i) => ({
        x: (i / (data.length - 1)) * 100,
        y: 100 - (d.value / maxValue) * 100,
        value: d.value,
        label: d.label
    })), [data, maxValue]);

    // Create smooth bezier path
    const pathD = useMemo(() => {
        if (points.length === 0) return '';
        let d = `M ${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i+1];
            // Control points for smooth curve
            const cp1 = { x: p0.x + (p1.x - p0.x) * 0.5, y: p0.y };
            const cp2 = { x: p0.x + (p1.x - p0.x) * 0.5, y: p1.y };
            d += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p1.x},${p1.y}`;
        }
        return d;
    }, [points]);

    const areaD = `${pathD} L 100,100 L 0,100 Z`;

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        // Clamp 0 to 1
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        // Find nearest index
        const index = Math.round(percentage * (data.length - 1));
        setActiveIndex(index);
    };

    return (
        <div 
            className="flex flex-col h-full w-full" 
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setActiveIndex(null)}
        >
            {/* Chart Container */}
            <div className="relative flex-1 min-h-[160px] w-full select-none">
                
                {/* Y-Axis Guidelines */}
                <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-gray-400 font-medium pointer-events-none z-0">
                    <div className="w-full border-b border-gray-100 border-dashed h-0" />
                    <div className="w-full border-b border-gray-100 border-dashed h-0" />
                    <div className="w-full border-b border-gray-100 border-dashed h-0" />
                </div>

                {/* SVG Graph */}
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible z-10 relative" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6B5BFF" stopOpacity="0.3" />
                            <stop offset="90%" stopColor="#6B5BFF" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    
                    {/* Area Fill */}
                    <motion.path 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                        d={areaD} 
                        fill="url(#chartGradient)" 
                        className="pointer-events-none"
                    />
                    
                    {/* Line Stroke */}
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        d={pathD}
                        fill="none"
                        stroke="#6B5BFF"
                        strokeWidth="2"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        className="pointer-events-none"
                    />

                    {/* Interactive Cursor Line & Dot */}
                    {activeIndex !== null && (
                        <g>
                            <line 
                                x1={points[activeIndex].x} y1="0" 
                                x2={points[activeIndex].x} y2="100" 
                                stroke="#94a3b8" 
                                strokeWidth="1" 
                                strokeDasharray="3 3"
                                vectorEffect="non-scaling-stroke"
                            />
                            <circle 
                                cx={points[activeIndex].x} 
                                cy={points[activeIndex].y} 
                                r="4" 
                                className="fill-white stroke-plexyz-600" 
                                strokeWidth="2.5"
                                vectorEffect="non-scaling-stroke"
                            />
                        </g>
                    )}
                </svg>

                {/* Floating Tooltip */}
                {activeIndex !== null && (
                    <div 
                        className="absolute bg-plexyz-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-xl pointer-events-none z-20 transform -translate-x-1/2 -translate-y-[120%]"
                        style={{ 
                            left: `${points[activeIndex].x}%`, 
                            top: `${points[activeIndex].y}%` 
                        }}
                    >
                        <div className="font-semibold text-center leading-none mb-0.5">{points[activeIndex].value}</div>
                        <div className="text-[10px] text-gray-300 font-medium text-center leading-none">Visitors</div>
                    </div>
                )}
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between pt-4 px-1">
                {points.map((p, i) => (
                    <span 
                        key={i} 
                        className={`text-[10px] font-medium transition-colors duration-200 ${
                            activeIndex === i ? 'text-plexyz-600 font-bold scale-110' : 'text-gray-400'
                        }`}
                    >
                        {p.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ currentConnections, connectionGoal }) => {
  const progress = Math.min(100, (currentConnections / connectionGoal) * 100);
  const isGoalMet = currentConnections >= connectionGoal;

  return (
    <div className="flex flex-col gap-6 mt-6 animate-fade-in-up">
      
      {/* Goal Progress Card (Hero) */}
      <div className={`p-6 rounded-3xl border shadow-sm transition-colors duration-500 relative overflow-hidden ${
          isGoalMet 
            ? 'bg-gradient-to-br from-mole-50 to-white border-mole-100' 
            : 'bg-white border-gray-100'
      }`}>
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
                 <div className={`p-3 rounded-2xl ${isGoalMet ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {isGoalMet ? <CheckCircle2 size={24} /> : <Users size={24} />}
                 </div>
                 <div>
                     <h3 className="font-bold text-gray-900 text-lg">Daily Connection Goal</h3>
                     <p className="text-sm text-gray-500">
                         {isGoalMet ? 'Target achieved! Great work.' : `${(connectionGoal - currentConnections).toLocaleString()} more to reach daily target.`}
                     </p>
                 </div>
            </div>
            
            <div className="flex items-center gap-6 w-full md:w-auto">
                 <div className="flex flex-col items-end">
                     <div className="flex items-baseline gap-1">
                         <span className={`text-3xl font-bold ${isGoalMet ? 'text-green-600' : 'text-gray-900'}`}>
                             {currentConnections.toLocaleString()}
                         </span>
                         <span className="text-gray-400 font-medium">/ {connectionGoal.toLocaleString()}</span>
                     </div>
                     <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Progress</span>
                 </div>
                 
                 <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                     <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${isGoalMet ? 'bg-green-500' : 'bg-mole-yellow'}`}
                        style={{ width: `${progress}%` }}
                     />
                 </div>
            </div>
         </div>
         {isGoalMet && (
             <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-green-50/50 to-transparent pointer-events-none" />
         )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Interactive Chart Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[320px]">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-plexyz-50 text-plexyz-600 rounded-xl">
                    <TrendingUp size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">Traffic Trend</h3>
                    <p className="text-xs text-gray-400 font-medium">Unique visitors per hour</p>
                </div>
            </div>
            
            <HourlyTrafficChart />
        </div>

        {/* Staffing Recommendation Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between h-[320px]">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <Users size={18} />
                    </div>
                    <h3 className="font-bold text-gray-900">Staffing</h3>
                </div>
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">Optimal</span>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-6">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl">
                    <AlertCircle className="w-5 h-5 text-mole-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-gray-900">Surge Expected: 2:00 PM</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            Historical data suggests a 40% traffic increase after the keynote. Recommend 2 additional staff members on floor.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border border-gray-100 rounded-2xl hover:border-mole-400 transition-colors">
                        <span className="block text-3xl font-bold text-gray-900">3</span>
                        <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Current Staff</span>
                    </div>
                    <div className="text-center p-4 border border-gray-100 rounded-2xl bg-mole-50/50 border-mole-100">
                        <span className="block text-3xl font-bold text-mole-600">5</span>
                        <span className="text-[10px] uppercase text-mole-600 font-bold tracking-wider">Recommended</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};