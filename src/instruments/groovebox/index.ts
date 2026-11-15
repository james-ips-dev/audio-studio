import type { InstrumentDefinition } from '../../core/types';
import { GrooveboxRoot } from './GrooveboxRoot';

export const GrooveboxDefinition: InstrumentDefinition = {
  id: 'groovebox',
  name: 'GROOVEBOX',
  version: 'v4.0',
  badge: {
    accentHex: '#F43F5E',
    tagline: '8-Track Synth, Clip Matrix & Dual-Persona Workstation',
  },
  component: GrooveboxRoot,
};
