import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

const CAROUSEL_BOFU_PROMPT = `أنت خبير في تصميم محتوى كاروسيلات تسويقية متخصصة في Bottom of Funnel (BOFU).

عندما يكتب المستخدم وصفاً، قم بتوليد خطة كاروسيل كاملة بالشكل التالي:

## القواعد الأساسية
- كل صورة يجب أن تكون 9:16 عمودية (vertical) — هذا إلزامي ولا يمكن تغييره
- عدد الشرائح: من 6 إلى 8 شرائح
- الكاروسيل تستهدف جمهور دافئ وجاهز للشراء
- الهدف المباشر: دفع المستخدم لاتخاذ قرار الشراء

## هيكل الكاروسيل

الشريحة 1 — HOOK (جذب انتباه)
- جملة قوية تتحدث عن رغبته وليس مشكلته
- يمكن أن تكون الصورة فقط بدون نص إذا كانت قوية جداً

الشريحة 2 و 3 — القيمة (VALUE)
- ميزة محددة → فائدة محددة → نتيجة محددة
- أرقام وتفاصيل حقيقية لا كلام عام

الشريحة 4 و 5 — كسر الاعتراضات (OBJECTION CRUSHER)
- عالج أكبر اعتراضين يمنعان الشراء
- أعد صياغة المعلومة بطريقة مقنعة

الشريحة 6 — إثبات اجتماعي (SOCIAL PROOF)
- شهادة أو أرقام أو نتائج حقيقية

الشريحة 7 — استعجال (URGENCY)
- سبب حقيقي للشراء الآن وليس لاحقاً

الشريحة 8 — دعوة للعمل (CTA)
- أمر واضح ومباشر واحد فقط

## قواعد النص فوق الصورة
- النص فوق الصورة اختياري وليس إلزامياً
- بعض الشرائح يمكن أن تكون صورة فقط بدون أي نص
- إذا كان هناك نص: عنوان максимум 8 كلمات، نص فرعي最大限度 15 كلمة
- لا تضع النص داخل وصف الصورة — النص يُعرض كطبقة منفصلة فوق الصورة

## لغة المحتوى
- إذا كتب المستخدم بالعربية → كل النصوص بالعربية
- إذا كتب المستخدم بالإنجليزية → كل النصوص بالإنجليزية

## المطلوب كإنتاج
أرجع JSON فقط بهذا الشكل:
{
  "carousel_title": "string",
  "slides": [
    {
      "slide_number": 1,
      "slide_type": "hook",
      "image_prompt": "وصف تفصيلي للصورة بـ الإنجليزية دائماً مع ذكر 9:16 vertical في الوصف، بدون أي نص في الصورة",
      "header_text": "string أو null",
      "body_text": "string أو null",
      "text_position": "top أو center أو bottom"
    }
  ]
}

ملاحظات مهمة:
- image_prompt تكتبها دائماً بالإنجليزية حتى لو المحتوى عربي
- header_text و body_text ممكن تكون null إذا الشريحة صورة فقط
- لا تكرر نفس النوع من الشرائح`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: CAROUSEL_BOFU_PROMPT,
        },
        {
          role: 'user',
          content: description.trim(),
        },
      ],
      temperature: 0.8,
      max_tokens: 4000,
    });

    const responseText = completion.choices?.[0]?.message?.content;

    if (!responseText) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    // Try to extract JSON from the response
    let carouselPlan;
    try {
      // Try direct parse first
      carouselPlan = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          carouselPlan = JSON.parse(jsonMatch[1]);
        } catch {
          // Try to find JSON object in the response
          const objectMatch = responseText.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            carouselPlan = JSON.parse(objectMatch[0]);
          } else {
            return NextResponse.json(
              { error: 'Could not parse carousel plan from AI response', raw: responseText },
              { status: 500 }
            );
          }
        }
      } else {
        // Try to find JSON object in the response
        const objectMatch = responseText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          carouselPlan = JSON.parse(objectMatch[0]);
        } else {
          return NextResponse.json(
            { error: 'Could not parse carousel plan from AI response', raw: responseText },
            { status: 500 }
          );
        }
      }
    }

    // Validate the plan structure
    if (!carouselPlan.carousel_title || !Array.isArray(carouselPlan.slides)) {
      return NextResponse.json(
        { error: 'Invalid carousel plan structure', raw: responseText },
        { status: 500 }
      );
    }

    // Validate each slide
    for (const slide of carouselPlan.slides) {
      if (!slide.slide_number || !slide.slide_type || !slide.image_prompt) {
        return NextResponse.json(
          { error: 'Invalid slide structure in carousel plan', raw: responseText },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ plan: carouselPlan });
  } catch (error: unknown) {
    console.error('Carousel plan generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate carousel plan', details: message },
      { status: 500 }
    );
  }
}
