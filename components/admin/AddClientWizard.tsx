import React, { useState } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  Calendar, 
  MapPin, 
  Radio, 
  CheckCircle2 
} from 'lucide-react';
import { Beacon } from '../../types';

interface AddClientWizardProps {
  isOpen: boolean;
  onClose: () => void;
  availableBeacons: Beacon[];
  onComplete: (data: WizardData) => void;
}

export interface WizardData {
  client: { name: string; email: string; tier: 'Starter' | 'Growth' | 'Enterprise' };
  event: { name: string; date: string };
  space: { name: string; type: 'Booth' | 'Room' | 'Entrance' };
  selectedBeaconIds: string[];
}

export const AddClientWizard: React.FC<AddClientWizardProps> = ({ isOpen, onClose, availableBeacons, onComplete }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WizardData>({
    client: { name: '', email: '', tier: 'Growth' },
    event: { name: '', date: '' },
    space: { name: '', type: 'Booth' },
    selectedBeaconIds: []
  });

  if (!isOpen) return null;

  const totalSteps = 4;

  const handleNext = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

  const handleFinish = () => {
    onComplete(formData);
    // Reset form after a short delay or allow parent to unmount
    setStep(1); 
  };

  const toggleBeaconSelection = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedBeaconIds: prev.selectedBeaconIds.includes(id)
        ? prev.selectedBeaconIds.filter(bId => bId !== id)
        : [...prev.selectedBeaconIds, id]
    }));
  };

  // --- Step Components ---

  const Step1Client = () => (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
        <input 
          type="text" 
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500"
          placeholder="e.g. Acme Corp"
          value={formData.client.name}
          onChange={e => setFormData({...formData, client: {...formData.client, name: e.target.value}})}
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Contact Email</label>
        <input 
          type="email" 
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500"
          placeholder="admin@acme.com"
          value={formData.client.email}
          onChange={e => setFormData({...formData, client: {...formData.client, email: e.target.value}})}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Tier</label>
        <div className="grid grid-cols-3 gap-3">
          {['Starter', 'Growth', 'Enterprise'].map((tier) => (
            <button
              key={tier}
              onClick={() => setFormData({...formData, client: {...formData.client, tier: tier as any}})}
              className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${
                formData.client.tier === tier 
                  ? 'bg-plexyz-50 border-plexyz-500 text-plexyz-700' 
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const Step2Event = () => (
    <div className="space-y-4 animate-fade-in-up">
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800 mb-4">
        Creating first event container for <strong>{formData.client.name || 'New Client'}</strong>.
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
        <input 
          type="text" 
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500"
          placeholder="e.g. CES 2024"
          value={formData.event.name}
          onChange={e => setFormData({...formData, event: {...formData.event, name: e.target.value}})}
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
        <input 
          type="date" 
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500"
          value={formData.event.date}
          onChange={e => setFormData({...formData, event: {...formData.event, date: e.target.value}})}
        />
      </div>
    </div>
  );

  const Step3Space = () => (
    <div className="space-y-4 animate-fade-in-up">
       <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-sm text-purple-800 mb-4">
        Define the primary physical space to track within <strong>{formData.event.name || 'Current Event'}</strong>.
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Space / Booth Name</label>
        <input 
          type="text" 
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500"
          placeholder="e.g. Main Hall Booth A12"
          value={formData.space.name}
          onChange={e => setFormData({...formData, space: {...formData.space, name: e.target.value}})}
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Space Type</label>
        <select 
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-plexyz-500"
          value={formData.space.type}
          onChange={e => setFormData({...formData, space: {...formData.space, type: e.target.value as any}})}
        >
          <option value="Booth">Exhibition Booth</option>
          <option value="Room">Conference Room</option>
          <option value="Entrance">Main Entrance / Gate</option>
        </select>
      </div>
    </div>
  );

  const Step4Beacons = () => (
    <div className="space-y-4 animate-fade-in-up">
       <div className="flex justify-between items-center mb-2">
         <h4 className="text-sm font-bold text-gray-900">Available Inventory</h4>
         <span className="text-xs font-medium text-gray-500">{formData.selectedBeaconIds.length} Selected</span>
       </div>
       
       <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
         {availableBeacons.length === 0 ? (
           <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
             No unassigned beacons available.
           </div>
         ) : (
           availableBeacons.map(beacon => (
             <div 
                key={beacon.id}
                onClick={() => toggleBeaconSelection(beacon.id)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  formData.selectedBeaconIds.includes(beacon.id)
                    ? 'bg-mole-50 border-mole-400 shadow-sm'
                    : 'bg-white border-gray-100 hover:border-gray-300'
                }`}
             >
               <div className="flex items-center gap-3">
                 <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    formData.selectedBeaconIds.includes(beacon.id) ? 'bg-mole-500 border-mole-600' : 'bg-white border-gray-300'
                 }`}>
                    {formData.selectedBeaconIds.includes(beacon.id) && <CheckCircle2 size={12} className="text-white" />}
                 </div>
                 <div>
                   <div className="text-sm font-bold text-gray-900">{beacon.macAddress}</div>
                   <div className="text-xs text-gray-500">Bat: {beacon.batteryLevel}%</div>
                 </div>
               </div>
               <div className="text-xs font-mono text-gray-400">{beacon.id}</div>
             </div>
           ))
         )}
       </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Onboard New Client</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-plexyz-600">Step {step} of {totalSteps}</span>
              <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-plexyz-500 transition-all duration-300"
                  style={{ width: `${(step / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {step === 1 && (
            <>
              <div className="flex items-center gap-2 mb-6 text-plexyz-900">
                <Building2 size={24} />
                <h3 className="text-xl font-bold">Client Details</h3>
              </div>
              <Step1Client />
            </>
          )}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 mb-6 text-blue-900">
                <Calendar size={24} />
                <h3 className="text-xl font-bold">Create Event</h3>
              </div>
              <Step2Event />
            </>
          )}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 mb-6 text-purple-900">
                <MapPin size={24} />
                <h3 className="text-xl font-bold">Configure Space</h3>
              </div>
              <Step3Space />
            </>
          )}
          {step === 4 && (
            <>
              <div className="flex items-center gap-2 mb-6 text-mole-800">
                <Radio size={24} />
                <h3 className="text-xl font-bold">Assign Beacons</h3>
              </div>
              <Step4Beacons />
            </>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-6 border-t border-gray-100 flex justify-between bg-gray-50">
          <button 
            onClick={step === 1 ? onClose : handleBack}
            className="px-5 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-200 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          <button 
            onClick={step === totalSteps ? handleFinish : handleNext}
            disabled={step === 1 && !formData.client.name} // Simple validation
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-mole-yellow text-mole-900 font-bold hover:bg-mole-400 shadow-lg shadow-mole-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
          >
            {step === totalSteps ? 'Complete Setup' : 'Next Step'}
            {step !== totalSteps && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};