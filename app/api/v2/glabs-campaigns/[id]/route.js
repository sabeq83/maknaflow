import { NextResponse } from 'next/server';
import { getGlabsCampaign, updateGlabsCampaign } from '../../../../../lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const campaign = await getGlabsCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const campaign = await getGlabsCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const body = await request.json();
    const { status } = body;

    if (status && !['active', 'paused', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await updateGlabsCampaign(id, { status });
    return NextResponse.json({ campaign: { ...campaign, status } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
