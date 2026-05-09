export const onRequest: PagesFunction = async (context) => {
  const { request, params } = context;
  
  // params.path is an array from [[path]]
  const path = Array.isArray(params.path) ? params.path.join('/') : '';
  
  // Construct NVIDIA URL
  const nvidiaUrl = `https://integrate.api.nvidia.com/v1/${path}${new URL(request.url).search}`;
  
  console.log(`Proxying request to: ${nvidiaUrl}`);

  // Create new headers to avoid passing host header
  const headers = new Headers(request.headers);
  headers.delete('host');

  try {
    const nvidiaResponse = await fetch(nvidiaUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : undefined,
    });

    // Create a new response to add CORS headers and return to client
    const responseHeaders = new Headers(nvidiaResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(nvidiaResponse.body, {
      status: nvidiaResponse.status,
      statusText: nvidiaResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
};
