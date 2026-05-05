export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';

export async function nvidiaChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens = 1024
): Promise<string> {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
  
  if (!apiKey) {
    throw new Error('NVIDIA API Key is missing. Please add VITE_NVIDIA_API_KEY to your environment.');
  }

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.5,
      top_p: 1,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
