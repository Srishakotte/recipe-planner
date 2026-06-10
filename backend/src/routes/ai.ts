import { Router, Request, Response } from 'express';

const router = Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// POST /api/ai/generate — general-purpose AI generation endpoint
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) { res.status(400).json({ error: 'prompt is required' }); return; }

    if (!OPENAI_API_KEY) {
      res.status(503).json({ 
        error: 'AI service not configured',
        response: 'AI features require an OpenAI API key. Add OPENAI_API_KEY to your .env file to enable this feature.'
      });
      return;
    }

    // Build system prompt based on context
    let systemPrompt = 'You are a helpful meal planning assistant. Keep responses concise and actionable.';
    
    if (context === 'grocery_cost_estimation') {
      systemPrompt = `You are a grocery price estimation assistant for Indian markets. 
Estimate costs in Indian Rupees (INR/₹). 
Reference average prices from popular online stores like BigBasket, Instamart (Swiggy), Zepto, and Amazon Fresh.
For each item, give a realistic price range. Then provide a total estimated range.
Format clearly with item-by-item breakdown. Be practical — round to nearest ₹5 or ₹10.
If an item seems unusual or hard to price, note that and give your best estimate.`;
    } else if (context === 'dashboard_insights') {
      systemPrompt = `You are a nutrition and meal planning advisor. 
Based on the user's weekly meal plan data, provide brief, helpful insights.
Be encouraging but honest. Use bullet points.
Focus on: nutritional variety, balance across meal slots, ingredient repetition, and actionable tips.
Keep it under 200 words. Don't be preachy.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errorData);
      res.status(502).json({ 
        error: 'AI service error',
        response: 'Failed to get response from AI service. Please try again later.'
      });
      return;
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated';

    res.json({ response: aiResponse, context, model: 'gpt-4o-mini' });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate AI response',
      response: 'Something went wrong with the AI service. Please try again.'
    });
  }
});

export default router;
