import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertAffiliateEngineType,
  assertAffiliateAccessMode,
  buildAffiliateStudioCapabilities
} from '../lib/affiliate-studio-contract.js';

import {
  parseAffiliateStudioFlag
} from '../lib/affiliate-studio-feature-flags.js';

import {
  evaluateAffiliateStudioAccess
} from '../lib/affiliate-studio-access.js';

import {
  registerAffiliateConnectorDescriptor,
  listAffiliateConnectorDescriptors,
  resetAffiliateConnectorRegistryForTests
} from '../lib/affiliate-studio-connector-registry.js';

test('contract validations', () => {
  assert.doesNotThrow(() => assertAffiliateEngineType('pillar'));
  assert.throws(() => assertAffiliateEngineType('invalid-engine'));

  assert.doesNotThrow(() => assertAffiliateAccessMode('read'));
  assert.throws(() => assertAffiliateAccessMode('write-invalid'));
});

test('feature flag is default-deny', () => {
  assert.equal(parseAffiliateStudioFlag(true), true);
  assert.equal(parseAffiliateStudioFlag('true'), true);
  assert.equal(parseAffiliateStudioFlag('TRUE'), true);
  assert.equal(parseAffiliateStudioFlag(false), false);
  assert.equal(parseAffiliateStudioFlag('false'), false);
  assert.equal(parseAffiliateStudioFlag(null), false);
  assert.equal(parseAffiliateStudioFlag(undefined), false);
});

test('access requires permission, tenant enablement, and non-disabled menu', () => {
  const validUser = {
    id: 'u1',
    role: 'user',
    tenantId: 'tenant1',
    menuPermissions: ['affiliate_studio'],
    tenantDisabledMenus: []
  };

  const enabledFlags = { enabled: true };

  const resultPass = evaluateAffiliateStudioAccess({ user: validUser, flags: enabledFlags, mode: 'read' });
  assert.equal(resultPass.allowed, true);

  const userDisabledMenu = {
    ...validUser,
    tenantDisabledMenus: ['affiliate_studio']
  };
  const resultDisabledMenu = evaluateAffiliateStudioAccess({ user: userDisabledMenu, flags: enabledFlags, mode: 'read' });
  assert.equal(resultDisabledMenu.allowed, false);
  assert.equal(resultDisabledMenu.code, 'MENU_DISABLED');

  const userMissingPerm = {
    ...validUser,
    menuPermissions: []
  };
  const resultMissingPerm = evaluateAffiliateStudioAccess({ user: userMissingPerm, flags: enabledFlags, mode: 'read' });
  assert.equal(resultMissingPerm.allowed, false);
  assert.equal(resultMissingPerm.code, 'PERMISSION_DENIED');

  const disabledFlags = { enabled: false };
  const resultFeatureDisabled = evaluateAffiliateStudioAccess({ user: validUser, flags: disabledFlags, mode: 'read' });
  assert.equal(resultFeatureDisabled.allowed, false);
  assert.equal(resultFeatureDisabled.code, 'FEATURE_DISABLED');
});

test('admin access mode rejects regular users', () => {
  const regularUser = {
    id: 'u1',
    role: 'user',
    tenantId: 'tenant1',
    menuPermissions: ['affiliate_studio'],
    tenantDisabledMenus: []
  };

  const adminUser = {
    id: 'u2',
    role: 'admin',
    tenantId: 'tenant1',
    menuPermissions: ['affiliate_studio'],
    tenantDisabledMenus: []
  };

  const enabledFlags = { enabled: true };

  const resultRegular = evaluateAffiliateStudioAccess({ user: regularUser, flags: enabledFlags, mode: 'admin' });
  assert.equal(resultRegular.allowed, false);
  assert.equal(resultRegular.code, 'ADMIN_REQUIRED');

  const resultAdmin = evaluateAffiliateStudioAccess({ user: adminUser, flags: enabledFlags, mode: 'admin' });
  assert.equal(resultAdmin.allowed, true);
});

test('connector registry rejects duplicate and unknown engines', () => {
  resetAffiliateConnectorRegistryForTests();

  const validDescriptor = {
    engineType: 'pillar',
    label: 'Pillar Campaign',
    capabilities: ['read', 'launch'],
    phase: 6
  };

  assert.doesNotThrow(() => registerAffiliateConnectorDescriptor(validDescriptor));
  assert.throws(() => registerAffiliateConnectorDescriptor(validDescriptor));

  const invalidEngineDescriptor = {
    engineType: 'unknown-engine',
    label: 'Unknown',
    capabilities: ['read'],
    phase: 1
  };
  assert.throws(() => registerAffiliateConnectorDescriptor(invalidEngineDescriptor));

  const handlerDescriptor = {
    engineType: 're',
    label: 'RE Campaign',
    capabilities: ['read'],
    phase: 6,
    myFunction: () => {}
  };
  assert.throws(() => registerAffiliateConnectorDescriptor(handlerDescriptor));

  const invalidCapsDescriptor = {
    engineType: 'recipe',
    label: 'Recipe',
    capabilities: ['invalid-cap'],
    phase: 5
  };
  assert.throws(() => registerAffiliateConnectorDescriptor(invalidCapsDescriptor));

  resetAffiliateConnectorRegistryForTests();
});

test('capabilities return immutable copies and an empty phase-0 registry', () => {
  resetAffiliateConnectorRegistryForTests();

  const list = listAffiliateConnectorDescriptors();
  assert.deepEqual(list, []);

  const capabilities = buildAffiliateStudioCapabilities(list);
  assert.equal(capabilities.module, 'affiliate_studio');
  assert.equal(capabilities.phase, 0);
  assert.deepEqual(capabilities.connectors, []);

  const descriptor = {
    engineType: 're',
    label: 'RE',
    capabilities: ['read'],
    phase: 5
  };
  registerAffiliateConnectorDescriptor(descriptor);

  const updatedList = listAffiliateConnectorDescriptors();
  assert.equal(updatedList.length, 1);

  updatedList[0].capabilities.push('extra');
  const freshList = listAffiliateConnectorDescriptors();
  assert.deepEqual(freshList[0].capabilities, ['read']);

  resetAffiliateConnectorRegistryForTests();
});
