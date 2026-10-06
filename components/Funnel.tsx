import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FunnelStageData } from '../types';
import { StageIcon } from './Icons';

interface FunnelProps {
  data: FunnelStageData[];
  showPercentage: boolean;
  onStageClick: (stage: FunnelStageData) => void;
}

// Simple Geometric Mole Mascot SVG Component
const MoleMascot = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="moleGradient" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFD24D" /> {/* mole-500 */}
                <stop offset="1" stopColor="#F4B400" /> {/* mole-700 */}
            </linearGradient>
        </defs>
        {/* Body */}
        <circle cx="50" cy="50" r="45" fill="url(#moleGradient)" />
        {/* Snout */}
        <ellipse cx="50" cy="55" rx="15" ry="10" fill="#fef3c7" />
        <ellipse cx="50" cy="52" rx="6" ry="4" fill="#78350f" />
        {/* Eyes */}
        <circle cx="35" cy="40" r="4" fill="#2B1B5A" /> {/* plexyz-900 */}
        <circle cx="65" cy="40" r="4" fill="#2B1B5A" />
        {/* Whiskers */}
        <path d="M20 55 L5 50" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        <path d="M20 60 L5 65" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        <path d="M80 55 L95 50" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        <path d="M80 60 L95 65" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

export const Funnel: React.FC<FunnelProps> = ({ data, showPercentage, onStageClick }) => {
  
  // Calculate dynamic dimensions based on data
  const { vPath, hPath, vBackPath, hBackPath, totalHeight, totalWidth } = useMemo(() => {
      const STAGE_SIZE = 100;
      const CENTER = 50;
      const maxVal = Math.max(...data.map(d => d.count)) || 1;

      // Map data counts to visual thickness (20% to 95% of container)
      const thicknesses = data.map(d => {
          const ratio = d.count / maxVal;
          return 25 + (ratio * 70); // Min 25 units, Max 95 units
      });

      // --- VERTICAL (Mobile) ---
      const vTotalH = data.length * STAGE_SIZE;
      
      const generateVPath = (widthModifier = 1) => {
          // Construct points: Start (Top edge) -> Centers of each stage -> End (Bottom edge)
          
          let d = `M ${CENTER - (thicknesses[0] * widthModifier) / 2} 0`;
          
          // Left side
          const leftPoints = thicknesses.map((w, i) => ({ x: CENTER - (w * widthModifier) / 2, y: i * STAGE_SIZE + 50 }));
          // Add Top and Bottom points
          leftPoints.unshift({ x: CENTER - (thicknesses[0] * widthModifier) / 2, y: 0 });
          leftPoints.push({ x: CENTER - (thicknesses[thicknesses.length-1] * widthModifier) / 2, y: vTotalH });

          // Draw Cubic Bezier through points
          for (let i = 0; i < leftPoints.length - 1; i++) {
              const p0 = leftPoints[i];
              const p1 = leftPoints[i+1];
              // Control points: Vertical smoothing
              const cp1 = { x: p0.x, y: p0.y + (p1.y - p0.y) * 0.5 };
              const cp2 = { x: p1.x, y: p1.y - (p1.y - p0.y) * 0.5 };
              d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p1.x} ${p1.y}`;
          }

          // Bottom edge
          d += ` L ${CENTER + (thicknesses[thicknesses.length-1] * widthModifier) / 2} ${vTotalH}`;

          // Right side (Reverse)
          const rightPoints = thicknesses.map((w, i) => ({ x: CENTER + (w * widthModifier) / 2, y: i * STAGE_SIZE + 50 }));
          rightPoints.unshift({ x: CENTER + (thicknesses[0] * widthModifier) / 2, y: 0 });
          rightPoints.push({ x: CENTER + (thicknesses[thicknesses.length-1] * widthModifier) / 2, y: vTotalH });

          // Iterate backwards
          for (let i = rightPoints.length - 1; i > 0; i--) {
              const p0 = rightPoints[i];
              const p1 = rightPoints[i-1];
              const cp1 = { x: p0.x, y: p0.y - (p0.y - p1.y) * 0.5 };
              const cp2 = { x: p1.x, y: p1.y + (p0.y - p1.y) * 0.5 };
              d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p1.x} ${p1.y}`;
          }
          
          d += ' Z';
          return d;
      }

      // --- HORIZONTAL (Desktop) ---
      const hTotalW = data.length * STAGE_SIZE;

      const generateHPath = (heightModifier = 1) => {
          // Visual Center X for stage i = i * 100 + 50
          
          // Top side points
          const topPoints = thicknesses.map((h, i) => ({ x: i * STAGE_SIZE + 50, y: CENTER - (h * heightModifier) / 2 }));
          // Add Left and Right Edge points
          topPoints.unshift({ x: 0, y: CENTER - (thicknesses[0] * heightModifier) / 2 });
          topPoints.push({ x: hTotalW, y: CENTER - (thicknesses[thicknesses.length-1] * heightModifier) / 2 });

          let d = `M ${topPoints[0].x} ${topPoints[0].y}`;

          // Draw Top Curve
          for (let i = 0; i < topPoints.length - 1; i++) {
              const p0 = topPoints[i];
              const p1 = topPoints[i+1];
              // Horizontal smoothing
              const cp1 = { x: p0.x + (p1.x - p0.x) * 0.5, y: p0.y };
              const cp2 = { x: p1.x - (p1.x - p0.x) * 0.5, y: p1.y };
              d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p1.x} ${p1.y}`;
          }

          // Right Edge
          d += ` L ${hTotalW} ${CENTER + (thicknesses[thicknesses.length-1] * heightModifier) / 2}`;

          // Bottom side points (Reverse)
          const bottomPoints = thicknesses.map((h, i) => ({ x: i * STAGE_SIZE + 50, y: CENTER + (h * heightModifier) / 2 }));
          bottomPoints.unshift({ x: 0, y: CENTER + (thicknesses[0] * heightModifier) / 2 });
          bottomPoints.push({ x: hTotalW, y: CENTER + (thicknesses[thicknesses.length-1] * heightModifier) / 2 });

          // Draw Bottom Curve backwards
          for (let i = bottomPoints.length - 1; i > 0; i--) {
              const p0 = bottomPoints[i];
              const p1 = bottomPoints[i-1];
              const cp1 = { x: p0.x - (p0.x - p1.x) * 0.5, y: p0.y };
              const cp2 = { x: p1.x + (p0.x - p1.x) * 0.5, y: p1.y };
              d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p1.x} ${p1.y}`;
          }

          d += ' Z';
          return d;
      }

      return {
          vPath: generateVPath(1),
          hPath: generateHPath(1),
          // Back path is slightly wider/larger for effect
          vBackPath: generateVPath(1.15),
          hBackPath: generateHPath(1.15),
          totalHeight: vTotalH,
          totalWidth: hTotalW
      };
  }, [data]);

  return (
    <div className="relative w-full mx-auto my-6 lg:my-0">
      {/* Container Background */}
      <div className="absolute inset-0 bg-slate-900 rounded-[32px] shadow-2xl shadow-slate-200/50" />
      
      {/* Content Wrapper */}
      <div className="relative z-10 px-0 py-8 lg:p-10 rounded-[32px] overflow-hidden lg:min-h-[400px] flex flex-col justify-center">
        
        {/* --- MOBILE SVG (Vertical) --- */}
        <div className="lg:hidden absolute top-0 bottom-0 left-0 right-0 pointer-events-none overflow-visible">
            <svg viewBox={`0 0 100 ${totalHeight}`} preserveAspectRatio="none" className="w-full h-full">
                <defs>
                    <linearGradient id="funnelGradientV" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6B5BFF" /> {/* PLExyz 500 */}
                        <stop offset="100%" stopColor="#FFD24D" /> {/* Mole 500 */}
                    </linearGradient>
                    <filter id="glowV" x="-20%" y="-20%" width="140%" height="140%">
                       <feGaussianBlur stdDeviation="5" result="blur" />
                    </filter>
                </defs>
                {/* Secondary Background Layer for Fluidity */}
                <motion.path
                    animate={{ d: vBackPath }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    fill="url(#funnelGradientV)"
                    opacity="0.3"
                    filter="url(#glowV)"
                />
                {/* Main Funnel Shape */}
                <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1, d: vPath }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                    fill="url(#funnelGradientV)"
                    className="drop-shadow-[0_0_15px_rgba(107,91,255,0.4)]"
                />
            </svg>
        </div>

        {/* --- DESKTOP SVG (Horizontal) --- */}
        <div className="hidden lg:block absolute top-0 bottom-0 left-0 right-0 pointer-events-none overflow-visible px-8">
            <svg viewBox={`0 0 ${totalWidth} 100`} preserveAspectRatio="none" className="w-full h-full">
                <defs>
                    <linearGradient id="funnelGradientH" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6B5BFF" /> {/* PLExyz 500 */}
                        <stop offset="100%" stopColor="#FFD24D" /> {/* Mole 500 */}
                    </linearGradient>
                     <filter id="glowH" x="-20%" y="-20%" width="140%" height="140%">
                       <feGaussianBlur stdDeviation="4" result="blur" />
                    </filter>
                </defs>
                {/* Secondary Background Layer */}
                <motion.path
                    animate={{ d: hBackPath }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    fill="url(#funnelGradientH)"
                    opacity="0.2"
                    filter="url(#glowH)"
                />
                {/* Main Shape */}
                <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1, d: hPath }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                    fill="url(#funnelGradientH)"
                    className="drop-shadow-[0_0_15px_rgba(107,91,255,0.4)]"
                />
                 {/* Vertical Divider Lines for Desktop */}
                 {[1, 2, 3].map(i => (
                     <line 
                        key={i}
                        x1={i * 100} y1="0" 
                        x2={i * 100} y2="100" 
                        stroke="rgba(255,255,255,0.1)" 
                        strokeWidth="0.5" 
                        strokeDasharray="2 2"
                     />
                ))}
            </svg>
        </div>

        {/* --- INTERACTIVE LAYERS --- */}
        
        {/* Mobile Layout (Column) */}
        <div className="lg:hidden relative flex flex-col w-full h-full">
          {data.map((stage, index) => {
             const isFirst = index === 0;
             const isLast = index === data.length - 1;
             return (
              <motion.div
                key={`mobile-${stage.id}`}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + (index * 0.1) }}
                onClick={() => onStageClick(stage)}
                className="flex-1 min-h-[120px] flex items-center justify-between px-6 sm:px-8 cursor-pointer group relative"
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
                <div className="flex items-center gap-4 z-10 max-w-[50%]">
                    <div className="p-2 rounded-xl bg-slate-900/40 backdrop-blur-sm border border-white/10 shadow-lg">
                        <StageIcon type={stage.iconType} className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-xs font-semibold text-white/90 tracking-wide uppercase opacity-80 mb-0.5">
                            {index === 0 ? 'Start' : index === 3 ? 'Goal' : `Step ${index + 1}`}
                        </span>
                        <span className="text-sm font-bold text-white leading-tight">{stage.label}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end z-10">
                    <span className="text-2xl font-bold text-white tracking-tight tabular-nums drop-shadow-md">
                         {showPercentage && !isFirst ? `${stage.conversionRate}%` : stage.count.toLocaleString()}
                    </span>
                    {/* Mole Mascot Mobile */}
                    {isLast && (
                        <div className="absolute -bottom-2 -right-2 w-16 h-16 opacity-80 pointer-events-none transform rotate-12">
                            <MoleMascot />
                        </div>
                    )}
                </div>
              </motion.div>
             )
          })}
        </div>

        {/* Desktop Layout (Row) */}
        <div className="hidden lg:flex w-full h-full justify-between items-stretch gap-0 relative">
          {data.map((stage, index) => {
            const isFirst = index === 0;
            const isLast = index === data.length - 1;
            return (
              <motion.div
                key={`desktop-${stage.id}`}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + (index * 0.1) }}
                onClick={() => onStageClick(stage)}
                className="flex-1 flex flex-col items-center justify-between py-6 cursor-pointer group relative text-center"
              >
                 <div className="absolute inset-y-4 inset-x-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300 rounded-2xl" />

                 {/* Top: Label */}
                 <div className="z-10 flex flex-col items-center gap-3">
                     <div className="p-3 rounded-xl bg-slate-900/40 backdrop-blur-sm border border-white/10 shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <StageIcon type={stage.iconType} className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-white/50 tracking-wider uppercase block mb-1">
                             {index === 0 ? 'Start' : index === 3 ? 'Goal' : `Step ${index + 1}`}
                        </span>
                        <span className="text-lg font-bold text-white leading-tight block max-w-[120px] mx-auto">
                            {stage.label}
                        </span>
                    </div>
                 </div>

                 {/* Middle: Number (Floating in stream) */}
                 <div className="z-10 mt-8 mb-4 relative">
                     <span className="text-4xl font-bold text-white tracking-tight tabular-nums drop-shadow-lg block">
                        {showPercentage && !isFirst ? `${stage.conversionRate}%` : stage.count.toLocaleString()}
                     </span>
                     {!isFirst && (
                         <span className={`text-xs font-medium px-2 py-1 rounded-full backdrop-blur-md mt-2 inline-block ${
                             index === 3 ? 'bg-green-500/20 text-green-200' : 'bg-white/10 text-white/70'
                         }`}>
                             {showPercentage ? stage.count.toLocaleString() : `${stage.conversionRate}% Conv.`}
                         </span>
                     )}
                     
                     {/* Mole Mascot Desktop */}
                     {isLast && (
                         <div className="absolute -right-24 top-1/2 -translate-y-1/2 w-20 h-20 opacity-90 pointer-events-none transform -rotate-12 hover:rotate-0 transition-transform duration-300">
                             <MoleMascot />
                         </div>
                     )}
                 </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
};