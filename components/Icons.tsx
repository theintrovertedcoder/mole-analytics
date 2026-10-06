import React from 'react';
import { Users, MapPin, Clock, Handshake } from 'lucide-react';

export const StageIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'people':
      return <Users className={className} />;
    case 'pin':
      return <MapPin className={className} />;
    case 'clock':
      return <Clock className={className} />;
    case 'connection':
      return <Handshake className={className} />;
    default:
      return <Users className={className} />;
  }
};