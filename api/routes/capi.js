const express = require('express');
const router = express.Router();

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE;

const ALLOWED_ORIGINS = new Set([
  'https://hurakanband.fr',
  'https://www.hurakanband.fr',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

// sendBeacon from the browser uses Content-Type: text/plain to avoid a CORS
// preflight (application/json is not a safelisted content type). Parse the
// raw text body as JSON so the same handler accepts both content types.
router.use(express.text({ type: 'text/plain', limit: '16kb' }));

router.post('/event', async (req, res) => {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return res.status(503).json({ error: 'CAPI not configured' });
  }

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const { event_name, event_id, event_source_url, custom_data, fbc, fbp } = body || {};

  if (!event_name || !event_id) {
    return res.status(400).json({ error: 'event_name and event_id are required' });
  }

  const clientIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '';

  const userAgent = req.headers['user-agent'] || '';

  const payload = {
    data: [
      {
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id,
        event_source_url,
        action_source: 'website',
        user_data: {
          client_ip_address: clientIp,
          client_user_agent: userAgent,
          ...(fbc ? { fbc } : {}),
          ...(fbp ? { fbp } : {}),
        },
        ...(custom_data ? { custom_data } : {}),
      },
    ],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };

  try {
    const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Meta CAPI rejected event:', data);
      return res.status(502).json({ error: 'Meta CAPI error', detail: data });
    }
    return res.status(200).json({ ok: true, events_received: data.events_received });
  } catch (err) {
    console.error('CAPI request failed:', err);
    return res.status(500).json({ error: 'CAPI request failed' });
  }
});

module.exports = router;
