import { NextResponse } from 'next/server';
import { updateRecommendedProduct } from '@/lib/re-recomm-engine';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const contentType = request.headers.get('content-type') || '';

    let updateData = {};
    let uploadedFile = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      
      updateData = {
        recommended_product_name: formData.get('recommended_product_name') !== null ? formData.get('recommended_product_name') : undefined,
        short_description: formData.get('short_description') !== null ? formData.get('short_description') : undefined,
        unique_selling_point: formData.get('unique_selling_point') !== null ? formData.get('unique_selling_point') : undefined,
        is_selected_by_user: formData.get('is_selected_by_user') !== null ? Number(formData.get('is_selected_by_user')) : undefined
      };

      const file = formData.get('image_file');
      if (file && typeof file !== 'string' && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        uploadedFile = {
          name: file.name,
          buffer
        };
      }
    } else {
      const json = await request.json();
      updateData = {
        recommended_product_name: json.recommended_product_name,
        short_description: json.short_description,
        unique_selling_point: json.unique_selling_point,
        is_selected_by_user: json.is_selected_by_user !== undefined ? Number(json.is_selected_by_user) : undefined
      };
    }

    const result = await updateRecommendedProduct(id, updateData, uploadedFile);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[API output update PUT] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
