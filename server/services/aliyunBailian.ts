/**
 * aliyunBailian.ts
 *
 * Integration service for Aliyun Bailian / DashScope API (阿里云百炼 / 灵积).
 * Generates background images using Qwen Image Synthesis (qwen-image-plus).
 *
 * Configured via .env:
 *  - DASHSCOPE_API_KEY (or ALIYUN_BAILIAN_API_KEY)
 *  - DASHSCOPE_BASE_URL (for text chat/style generation, e.g. dedicated LLM gateway)
 *  - DASHSCOPE_IMAGE_BASE_URL (optional: defaults to https://dashscope.aliyuncs.com for image synthesis)
 *  - ALIYUN_IMAGE_MODEL (optional: defaults to "qwen-image-plus")
 */

export function getBailianApiKey(): string | null {
  const key = process.env.DASHSCOPE_API_KEY || process.env.ALIYUN_BAILIAN_API_KEY;
  if (!key || key.trim() === '' || key.startsWith('sk-placeholder')) {
    return null;
  }
  return key.trim();
}

/**
 * Normalizes URL paths against a given base URL.
 */
export function buildDashScopeUrl(path: string, customBase?: string): string {
  const base = customBase || process.env.DASHSCOPE_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com';
  let cleanBase = base.replace(/\/+$/, '');

  // If base ends in /api/v1 or /compatible-mode/v1, strip prefix for clean path joining
  if (cleanBase.endsWith('/api/v1') && path.startsWith('/api/v1')) {
    cleanBase = cleanBase.slice(0, -7);
  } else if (cleanBase.endsWith('/api/v1') && path.startsWith('/compatible-mode/v1')) {
    cleanBase = cleanBase.slice(0, -7);
  }

  return `${cleanBase}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface BailianStyleResponse {
  name: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  gridOpacity: number;
}

/**
 * Generates a color theme style object from a user prompt using Qwen via OpenAI-compatible endpoint.
 */
export async function generateBailianStyle(prompt: string): Promise<BailianStyleResponse> {
  const apiKey = getBailianApiKey();
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY (or ALIYUN_BAILIAN_API_KEY) is not configured in .env file');
  }

  const endpoint = buildDashScopeUrl('/compatible-mode/v1/chat/completions');
  const model = process.env.ALIYUN_TEXT_MODEL || 'qwen-plus';

  const systemPrompt = `You are an expert event layout designer. Given a theme description, generate a color palette for a round-table seating plan.
Return ONLY a raw JSON object with these exact fields (no markdown formatting, no code block backticks):
{
  "name": "Short Theme Title (max 4 words)",
  "fillColor": "Hex color code for table shape fill (e.g. #EEF2FF)",
  "strokeColor": "Hex color code for table border (e.g. #4F46E5)",
  "strokeWidth": 3,
  "backgroundColor": "Hex color code for floor plan canvas background (e.g. #F8FAFC)",
  "gridOpacity": 0.1
}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Create a theme for: "${prompt}". Output valid JSON only.` },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DashScope/Bailian API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const contentStr = data.choices?.[0]?.message?.content;
  if (!contentStr) {
    throw new Error('Empty text content returned from DashScope/Bailian API');
  }

  const cleanJson = contentStr.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  return {
    name: parsed.name || `${prompt.substring(0, 15)} Style`,
    fillColor: parsed.fillColor || '#EEF2FF',
    strokeColor: parsed.strokeColor || '#4F46E5',
    strokeWidth: typeof parsed.strokeWidth === 'number' ? parsed.strokeWidth : 3,
    backgroundColor: parsed.backgroundColor || '#F8FAFC',
    gridOpacity: typeof parsed.gridOpacity === 'number' ? parsed.gridOpacity : 0.1,
  };
}

/**
 * Normalizes user model selection to valid Bailian API model identifier.
 * Maps "qwen-image-2.0-pro-2026-06-22" / "qwen-image-2.0-pro" to "qwen-image-plus".
 */
export function normalizeImageModel(envModel?: string): string {
  if (!envModel) return 'qwen-image-plus';
  const clean = envModel.trim();
  if (clean.startsWith('qwen-image')) {
    return 'qwen-image-plus';
  }
  return clean;
}

/**
 * Generates a background image using Aliyun DashScope Qwen Image synthesis (qwen-image-plus).
 */
export async function generateBailianImage(prompt: string): Promise<{ imageUri: string }> {
  const apiKey = getBailianApiKey();
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY (or ALIYUN_BAILIAN_API_KEY) is not configured in .env file');
  }

  const model = normalizeImageModel(process.env.ALIYUN_IMAGE_MODEL);


  // Image synthesis requests must hit dashscope.aliyuncs.com (or DASHSCOPE_IMAGE_BASE_URL if set).
  const imageBase = process.env.DASHSCOPE_IMAGE_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com';
  const submitEndpoint = buildDashScopeUrl('/api/v1/services/aigc/text2image/image-synthesis', imageBase);

  console.log(`[DashScope Qwen Image Submit] Model: ${model} | Base: ${imageBase} | Endpoint: ${submitEndpoint}`);

  const response = await fetch(submitEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model,
      input: { prompt },
      parameters: {
        size: '1024*1024',
        n: 1,
      },
    }),
  });

  if (response.ok) {
    const data = await response.json();
    const taskId = data.output?.task_id;
    if (taskId) {
      console.log(`[DashScope Qwen Image Task Submitted] Task ID: ${taskId}`);
      return await pollDashScopeTask(taskId, apiKey, imageBase);
    }
  }

  const errText = await response.text();
  console.error(`[DashScope Qwen Image Error (${response.status})]:`, errText);
  throw new Error(`DashScope/Bailian image synthesis error (${response.status}): ${errText}`);
}

async function pollDashScopeTask(taskId: string, apiKey: string, imageBase?: string): Promise<{ imageUri: string }> {
  const maxPolls = 25;
  const pollEndpoint = buildDashScopeUrl(`/api/v1/tasks/${taskId}`, imageBase);

  for (let i = 1; i <= maxPolls; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollEndpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (pollRes.ok) {
      const pollData = await pollRes.json();
      const status = pollData.output?.task_status;
      console.log(`[DashScope Task Poll ${i}/${maxPolls}] Status: ${status}`);

      if (status === 'SUCCEEDED') {
        const imageUrl = pollData.output?.results?.[0]?.url;
        if (imageUrl) return { imageUri: imageUrl };
        throw new Error('Task succeeded but no result image URL was returned');
      } else if (status === 'FAILED') {
        throw new Error(`DashScope image synthesis task failed: ${pollData.output?.message || pollData.output?.code || 'Unknown error'}`);
      }
    }
  }
  throw new Error('DashScope/Bailian image synthesis task timed out');
}
