import type { InstrumentDefinition } from '../../core/types';
import { Aether8Root } from './Aether8Root';

export const Aether8Definition: InstrumentDefinition = {
  id: 'aether8',
  name: 'AETHER-8',
  version: 'v4.0',
  badge: {
    accentHex: '#38BDF8',
    tagline: '12-Module Dub-Drone, Beat Synth & Biosphere Workstation',
  },
  component: Aether8Root,
};
