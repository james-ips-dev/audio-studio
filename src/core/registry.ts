import type { InstrumentDefinition } from './types';
import { GrooveboxDefinition } from '../instruments/groovebox';
import { Aether8Definition } from '../instruments/aether8';
import { RileyRackDefinition } from '../instruments/riley-rack';

export const INSTRUMENT_REGISTRY: InstrumentDefinition[] = [
  GrooveboxDefinition,
  Aether8Definition,
  RileyRackDefinition,
  // Future instruments plug in here with zero changes to existing instruments:
  // KineticFmDefinition,
  // GranularManglerDefinition,
];

export const DEFAULT_INSTRUMENT_ID = 'groovebox';
