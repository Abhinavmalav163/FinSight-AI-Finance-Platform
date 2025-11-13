import { scanReceipt } from '@/actions/transaction';

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    try {
      console.log('api/scan-receipt: received formData file', { exists: !!file, name: file?.name, size: file?.size, type: file?.type });
    } catch (e) {
      console.log('api/scan-receipt: received formData (file inspect failed)');
    }

    // Delegate to the existing server-side scanReceipt helper
    const result = await scanReceipt(formData);

    // Log raw result for diagnostics
    try {
      console.log('api/scan-receipt: raw result from scanReceipt:', JSON.stringify(result));
    } catch (e) {
      console.log('api/scan-receipt: raw result from scanReceipt (non-serializable)', result);
    }

    // Normalize result to a JSON object so client never receives an empty {}
    if (!result || typeof result !== 'object' || (Object.keys(result).length === 0 && result.constructor === Object)) {
      console.error('api/scan-receipt: scanReceipt returned empty or non-object result', { raw: result });
      return jsonResponse({ success: false, error: 'Empty response from scanReceipt. Check server logs.' }, 500);
    }

    return jsonResponse(result, 200);
  } catch (err) {
    console.error('api/scan-receipt POST error:', err);
    return jsonResponse({ success: false, error: err?.message || String(err) }, 500);
  }
}
