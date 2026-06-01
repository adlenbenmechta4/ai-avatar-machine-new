import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image_prompt } = body;

    if (!image_prompt || typeof image_prompt !== 'string' || image_prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'image_prompt is required' },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    // Generate image with 9:16 vertical dimensions (768x1344 is closest to 9:16)
    const response = await zai.images.generations.create({
      prompt: image_prompt.trim(),
      size: '768x1344', // 9:16 vertical aspect ratio
    });

    const imageBase64 = response.data?.[0]?.base64;

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'No image generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error: unknown) {
    console.error('Carousel image generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate image', details: message },
      { status: 500 }
    );
  }
}
