import type { InstrumentDefinition } from '../../core/types';
import { RileyRackInstrument } from './components/RileyRackInstrument';

export { RileyRackInstrument };

export const RileyRackDefinition: InstrumentDefinition = {
  id: 'riley-rack',
  name: 'RILEYRACK 800',
  version: 'v1.0',
  badge: {
    accentHex: '#F59E0B',
    tagline:
      '8-Voice Polymetric Minimalist, West Coast Modular & Time-Lag Tape Workstation',
  },
  component: RileyRackInstrument,
};
