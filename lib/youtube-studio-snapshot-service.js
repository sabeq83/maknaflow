import { getUniverseProfile, getUniverseCharacters, getUniverseLocations } from './db.js';
import { getVisualIdentity } from './visual-identity-repository.js';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export async function createProductionSnapshot({ episode, strategy }) {
  const tenantId = getActiveTenantId();
  
  let universe = null;
  if (strategy.universe_id) {
    const profile = await getUniverseProfile(strategy.universe_id);
    if (profile) {
      const characters = await getUniverseCharacters(strategy.universe_id) || [];
      const locations = await getUniverseLocations(strategy.universe_id) || [];
      universe = { profile, characters, locations };
    }
  }

  let visualIdentity = null;
  if (strategy.visual_identity_preset_id) {
    visualIdentity = await getVisualIdentity(strategy.visual_identity_preset_id);
  }

  const snapshot = {
    strategyConfig: strategy.config_json,
    universe,
    visualIdentity,
    createdAt: new Date().toISOString()
  };

  // Update episode table with snapshot
  await pgQuery(
    'UPDATE youtube_episodes SET production_snapshot_json = $1 WHERE id = $2 AND tenant_id = $3',
    [JSON.stringify(snapshot), episode.id, tenantId]
  );

  return snapshot;
}
