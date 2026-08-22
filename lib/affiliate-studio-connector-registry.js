import { assertAffiliateEngineType } from './affiliate-studio-contract.js';

const descriptors = new Map();

const ALLOWED_CAPABILITIES = Object.freeze(['read', 'launch', 'status', 'deep_link', 'source']);

export function registerAffiliateConnectorDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    const err = new Error('Descriptor must be an object');
    err.code = 'INVALID_DESCRIPTOR';
    err.status = 400;
    throw err;
  }

  const { engineType, label, capabilities, phase, ...rest } = descriptor;

  if (Object.keys(rest).length > 0) {
    const err = new Error('Descriptor contains unsupported fields');
    err.code = 'INVALID_DESCRIPTOR';
    err.status = 400;
    throw err;
  }

  for (const [key, val] of Object.entries(descriptor)) {
    if (typeof val === 'function') {
      const err = new Error(`Descriptor property ${key} cannot be a function`);
      err.code = 'INVALID_DESCRIPTOR';
      err.status = 400;
      throw err;
    }
  }

  assertAffiliateEngineType(engineType);

  if (descriptors.has(engineType)) {
    const err = new Error(`Duplicate engineType descriptor: ${engineType}`);
    err.code = 'DUPLICATE_DESCRIPTOR';
    err.status = 400;
    throw err;
  }

  if (typeof label !== 'string' || label.trim() === '') {
    const err = new Error('Label must be a non-empty string');
    err.code = 'INVALID_DESCRIPTOR';
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(capabilities)) {
    const err = new Error('Capabilities must be an array');
    err.code = 'INVALID_DESCRIPTOR';
    err.status = 400;
    throw err;
  }

  for (const cap of capabilities) {
    if (!ALLOWED_CAPABILITIES.includes(cap)) {
      const err = new Error(`Unsupported capability: ${cap}`);
      err.code = 'INVALID_DESCRIPTOR';
      err.status = 400;
      throw err;
    }
  }

  if (typeof phase !== 'number') {
    const err = new Error('Phase must be a number');
    err.code = 'INVALID_DESCRIPTOR';
    err.status = 400;
    throw err;
  }

  const cloned = {
    engineType,
    label,
    capabilities: [...capabilities],
    phase
  };

  descriptors.set(engineType, Object.freeze(cloned));
}

export function listAffiliateConnectorDescriptors() {
  return Array.from(descriptors.values()).map(d => ({
    ...d,
    capabilities: [...d.capabilities]
  }));
}

export function resetAffiliateConnectorRegistryForTests() {
  descriptors.clear();
}
