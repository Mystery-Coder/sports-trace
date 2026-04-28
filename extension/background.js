// ─── SportTrace Background Service Worker ───────────────────────────────────
// Handles Firestore REST API operations, image proxy for CORS, and message routing.

const FIREBASE_PROJECT = 'sports-trace';
const FIREBASE_API_KEY = 'AIzaSyBjYaFZnm0E95Qg05YXeSV0HIjHBqJ6c40';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// ─── Firestore REST Helpers ─────────────────────────────────────────────────

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val) && Math.abs(val) < 2 ** 53)
      return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'object' && !Array.isArray(val)) {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val) {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return new Date(val.timestampValue).getTime();
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  return null;
}

function fromFirestoreDoc(doc) {
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = fromFirestoreValue(v);
  }
  // Extract doc ID from name path
  if (doc.name) {
    const parts = doc.name.split('/');
    obj._docId = parts[parts.length - 1];
  }
  return obj;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

// ─── Firestore Operations ───────────────────────────────────────────────────

async function queryAssetByToken(token) {
  const url = `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'assets' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'watermarkToken' },
          op: 'EQUAL',
          value: { stringValue: token },
        },
      },
      limit: 1,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data && data.length > 0 && data[0].document) {
      return fromFirestoreDoc(data[0].document);
    }
    return null;
  } catch (err) {
    console.error('Firestore query failed:', err);
    return null;
  }
}

async function writeFirestoreDoc(collectionId, docId, fields) {
  const url = `${FIRESTORE_BASE}/${collectionId}/${docId}?key=${FIREBASE_API_KEY}`;
  try {
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(fields) }),
    });
    return true;
  } catch (err) {
    console.error('Firestore write failed:', err);
    return false;
  }
}

function generateId() {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Process Scan Results ───────────────────────────────────────────────────

async function processScanResults(results, pageUrl, pageTitle) {
  const processed = [];

  for (const item of results) {
    const entry = { ...item, assetMatch: null, ping: null, enforcement: null };

    if (item.token) {
      // Query Firestore for matching asset
      const asset = await queryAssetByToken(item.token);
      if (asset) {
        entry.assetMatch = {
          id: asset.id || asset._docId,
          name: asset.name,
          owner: asset.owner,
          type: asset.type,
          status: asset.status,
        };
      }

      // Fire detection ping
      const pingId = generateId();
      const ping = {
        id: pingId,
        assetId: asset ? (asset.id || asset._docId) : 'unknown',
        watermarkToken: item.token,
        timestamp: Date.now(),
        gps: { lat: 0, lng: 0 }, // Extension can't easily get GPS
        platform: 'Chrome Extension',
        userAgent: 'SportTrace Extension v1.0',
        ipAddress: '0.0.0.0',
        action: 'dmca', // Piracy site = always unlicensed
        isLicensed: false,
        pageUrl: pageUrl,
        pageTitle: pageTitle,
      };

      await writeFirestoreDoc('pings', pingId, ping);
      entry.ping = ping;

      // Create enforcement action
      const enfId = generateId();
      const enforcement = {
        id: enfId,
        assetId: asset ? (asset.id || asset._docId) : 'unknown',
        pingId: pingId,
        type: 'dmca',
        status: 'pending',
        severity: 'high',
        evidence: {
          timestamp: Date.now(),
          gps: { lat: 0, lng: 0 },
          platform: 'Chrome Extension',
          pageUrl: pageUrl,
        },
        createdAt: Date.now(),
      };

      await writeFirestoreDoc('enforcements', enfId, enforcement);
      entry.enforcement = enforcement;
    }

    processed.push(entry);
  }

  return processed;
}

// ─── Image Proxy for CORS ───────────────────────────────────────────────────

async function proxyFetchImage(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Proxy fetch failed:', err);
    return null;
  }
}

// ─── Message Handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'proxyFetch') {
    proxyFetchImage(message.url).then((dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true; // async
  }

  if (message.action === 'scanComplete') {
    processScanResults(message.results, message.pageUrl, message.pageTitle).then(
      (processed) => {
        // Store results for popup to read
        chrome.storage.local.set({
          lastScan: {
            timestamp: Date.now(),
            pageUrl: message.pageUrl,
            pageTitle: message.pageTitle,
            results: processed,
            totalMedia: message.results.length,
            watermarksFound: processed.filter((r) => r.token).length,
          },
        });
      }
    );
    return false;
  }
});
