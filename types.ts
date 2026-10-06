export interface FunnelStageData {
  id: string;
  label: string;
  count: number;
  subtext?: string;
  conversionRate?: number; // Calculated relative to previous step or total
  iconType: 'people' | 'pin' | 'clock' | 'connection';
  colorTheme: 'neutral' | 'transition' | 'engaged' | 'success';
  helperText?: string;
  description: string;
  howItIsMeasured: string;
}

export enum TimeGranularity {
  EVENT = 'Event',
  DAY = 'Day',
  HOUR = 'Hour',
}

export interface FunnelState {
  dwellThreshold: number;
  granularity: TimeGranularity;
  showPercentage: boolean;
  selectedBooth: string;
  connectionGoal: number;
}

export const BOOTH_OPTIONS = [
  "Main Hall – Booth A12 (TechFlow)",
  "North Wing – Booth B04 (GreenLeaf)",
  "Tech Pavilion – Booth C99 (Nexus)"
];

// --- Admin Types ---

export interface Client {
  id: string;
  name: string;
  tier: 'Starter' | 'Growth' | 'Enterprise';
  status: 'Active' | 'Pending' | 'Suspended';
  contact: string;
  beaconsAssigned: number;
}

export interface Event {
  id: string;
  clientId: string;
  name: string;
  date: string;
}

export interface Space {
  id: string;
  eventId: string;
  name: string;
  type: 'Booth' | 'Room' | 'Entrance';
}

export interface Beacon {
  id: string;
  macAddress: string;
  batteryLevel: number;
  status: 'Active' | 'Inactive' | 'Maintenance';
  assignedClientId: string | null; 
  assignedSpaceId?: string | null; // Optional: specific space within client context
  lastPing: string;
}

export type ViewMode = 'LANDING' | 'ORGANIZER_DASHBOARD' | 'EXHIBITOR_DASHBOARD' | 'ADMIN_LOGIN' | 'ADMIN_PORTAL';
