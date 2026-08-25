export function resolveEpisodeStages({ episode, research, blueprint, script, productionPackage, assemblyJob }) {
  if (!episode) return [];

  const stages = [
    {
      key: 'research',
      label: 'Brief & Research',
      enabled: true,
      status: research ? 'complete' : (episode.status === 'Planned' || episode.status === 'Researching' ? 'active' : 'pending'),
      reason: null
    },
    {
      key: 'blueprint',
      label: 'Blueprint',
      enabled: !!research,
      status: !research ? 'blocked' : (blueprint?.status === 'approved' ? 'complete' : 'active'),
      reason: !research ? 'Research brief required' : null
    },
    {
      key: 'script',
      label: 'Script & Voice-over',
      enabled: blueprint?.status === 'approved',
      status: blueprint?.status !== 'approved' ? 'blocked' : (script?.status === 'approved' ? 'complete' : 'active'),
      reason: blueprint?.status !== 'approved' ? 'Blueprint approval required' : null
    },
    {
      key: 'scene-plan',
      label: 'Scene Plan',
      enabled: script?.status === 'approved',
      status: script?.status !== 'approved' ? 'blocked' : (episode.generation_profile_key ? 'complete' : 'active'),
      reason: script?.status !== 'approved' ? 'Script approval required' : null
    },
    {
      key: 'start-frames',
      label: 'Start Frames',
      enabled: false,
      status: 'coming_next',
      reason: 'Coming next (start frame approval workflow will be integrated in future phases)'
    },
    {
      key: 'video-production',
      label: 'Video Production',
      enabled: !!episode.generation_profile_key,
      status: !episode.generation_profile_key ? 'blocked' : 
        (productionPackage ? 
          (['preview_ready', 'final_rendering', 'completed'].includes(productionPackage.status) ? 'complete' : 'active') 
          : 'active'),
      reason: !episode.generation_profile_key ? 'Generation profile selection required' : null
    },
    {
      key: 'assemble-review',
      label: 'Assemble & Review',
      enabled: (productionPackage && ['preview_ready', 'final_rendering', 'completed'].includes(productionPackage.status)) || (assemblyJob && ['queued', 'running'].includes(assemblyJob.status)),
      status: (assemblyJob && ['queued', 'running'].includes(assemblyJob.status)) ? 'assembling' :
        (!(productionPackage && ['preview_ready', 'final_rendering', 'completed'].includes(productionPackage.status)) ? 'blocked' :
          (productionPackage.status === 'completed' ? 'complete' : 'active')),
      reason: !(productionPackage && ['preview_ready', 'final_rendering', 'completed'].includes(productionPackage.status)) ? 'Video production render required' : null
    },
    {
      key: 'packaging',
      label: 'Packaging',
      enabled: false,
      status: 'coming_next',
      reason: 'Coming next (metadata packaging workflow)'
    },
    {
      key: 'publish',
      label: 'Publish',
      enabled: false,
      status: 'coming_next',
      reason: 'Coming next (YouTube API publishing integration)'
    }
  ];

  return stages;
}
