'use client';

import ReCampaignConfigurationForm from '../campaign-forms/ReCampaignConfigurationForm';
import MultiplierConfigurationForm from '../campaign-forms/MultiplierConfigurationForm';
import RecipeLabsConfigurationForm from '../campaign-forms/RecipeLabsConfigurationForm';
import PillarConfigurationForm from '../campaign-forms/PillarConfigurationForm';

/** Keep this mounted through schedule/review so canonical controller state is retained. */
export default function StudioCampaignWizard({ engine, planner, onCapture, onCancel }) {
  if (engine === 'pillar') return planner ? <PillarConfigurationForm isOpen initialPlannerId={planner.id} layout="wizard" onConfigurationSubmit={onCapture} onClose={onCancel} /> : null;
  const Form = {re:ReCampaignConfigurationForm,multiplier:MultiplierConfigurationForm,recipe:RecipeLabsConfigurationForm}[engine];
  return Form ? <Form mode="capture" onCapture={onCapture} onCancel={onCancel} /> : null;
}
