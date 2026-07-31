import { NextResponse } from 'next/server';
import { getRecipeCampaignById, getRecipeItemsByCampaign, deleteRecipeCampaign } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const campaign = await getRecipeCampaignById(id);

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye resep tidak ditemukan.' }, { status: 404 });
    }

    const items = await getRecipeItemsByCampaign(id);
    return NextResponse.json({
      success: true,
      data: {
        ...campaign,
        items
      }
    });
  } catch (error) {
    console.error('[API /api/recipe-labs/[id] GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteRecipeCampaign(id);
    return NextResponse.json({ success: true, message: 'Kampanye resep berhasil dihapus.' });
  } catch (error) {
    console.error('[API /api/recipe-labs/[id] DELETE Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
