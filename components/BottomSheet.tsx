import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { FunnelStageData } from '../types';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: FunnelStageData | null;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, data }) => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && data && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40 backdrop-blur-sm"
          />
          
          {/* Sheet / Drawer Container */}
          <motion.div
            initial={isDesktop ? { x: "100%" } : { y: "100%" }}
            animate={isDesktop ? { x: 0 } : { y: 0 }}
            exit={isDesktop ? { x: "100%" } : { y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`
                fixed bg-white z-50 shadow-2xl p-6
                bottom-0 
                /* Mobile Styles */
                left-0 right-0 rounded-t-[32px] max-h-[85vh]
                /* Desktop Styles */
                lg:top-0 lg:left-auto lg:right-0 lg:w-96 lg:h-full lg:max-h-full lg:rounded-l-[32px] lg:rounded-tr-none
            `}
          >
            {/* Mobile Drag Handle */}
            <div className="lg:hidden w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            
            <div className="flex justify-between items-start mb-6 lg:mt-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{data.label}</h3>
                <p className="text-gray-500 text-sm mt-1">Metric Details</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto max-h-[70vh] lg:max-h-full pb-20">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">What this means</h4>
                <p className="text-gray-600 leading-relaxed text-sm">
                  {data.description}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-plexyz-600 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-plexyz-500 animate-pulse"></span>
                  Detected by PLExyz
                </h4>
                <p className="text-gray-600 leading-relaxed text-sm">
                  {data.howItIsMeasured}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">Current Value</span>
                <span className="text-2xl font-bold text-gray-900">{data.count.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="absolute bottom-6 left-6 right-6 lg:bottom-8">
              <button 
                onClick={onClose}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-medium active:scale-95 transition-transform"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};