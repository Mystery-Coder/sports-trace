// ─── SportTrace Content Script ──────────────────────────────────────────────
// Self-contained watermark decoder + DOM scanner.
// Injected programmatically via popup → scans page → sends results to background.

(async () => {
  // ─── Watermark Constants ────────────────────────────────────────────────
  const MAGIC_HEADER = '10101010';
  const SPREAD_FACTOR = 16;
  const CHANNEL = 2; // Blue channel
  const PIXEL_STRIDE = 4;

  // ─── Crypto Helpers ─────────────────────────────────────────────────────
  function tokenToBinary(token) {
    return token
      .split('')
      .map(c => parseInt(c, 16).toString(2).padStart(4, '0'))
      .join('');
  }

  function binaryToToken(binary) {
    let token = '';
    for (let i = 0; i < binary.length; i += 4) {
      const nibble = binary.slice(i, i + 4);
      token += parseInt(nibble, 2).toString(16);
    }
    return token;
  }

  // ─── Watermark Decoder ──────────────────────────────────────────────────
  function decodeImageWatermark(imageData) {
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;
    const totalBits = (MAGIC_HEADER.length + 64) * SPREAD_FACTOR;

    if (totalPixels < totalBits) {
      return { token: null, confidence: 0 };
    }

    const step = Math.max(1, Math.floor(totalPixels / totalBits));
    const rawBits = [];

    for (let i = 0; i < totalBits; i++) {
      const pixelIndex = (i * step) % totalPixels;
      const byteIndex = pixelIndex * PIXEL_STRIDE + CHANNEL;
      rawBits.push(data[byteIndex] & 1);
    }

    const totalOriginalBits = MAGIC_HEADER.length + 64;
    const decoded = [];
    let totalConfidence = 0;

    for (let i = 0; i < totalOriginalBits; i++) {
      const chunk = rawBits.slice(i * SPREAD_FACTOR, (i + 1) * SPREAD_FACTOR);
      const ones = chunk.filter(b => b === 1).length;
      const bit = ones > SPREAD_FACTOR / 2 ? 1 : 0;
      const confidence = Math.max(ones, SPREAD_FACTOR - ones) / SPREAD_FACTOR;
      totalConfidence += confidence;
      decoded.push(bit);
    }

    const avgConfidence = totalConfidence / totalOriginalBits;
    const headerBits = decoded.slice(0, MAGIC_HEADER.length).join('');

    if (headerBits !== MAGIC_HEADER) {
      return { token: null, confidence: avgConfidence };
    }

    const tokenBits = decoded.slice(MAGIC_HEADER.length).join('');
    const token = binaryToToken(tokenBits);
    return { token, confidence: avgConfidence };
  }

  // ─── Image Scanner ──────────────────────────────────────────────────────
  async function scanImage(img) {
    try {
      const canvas = document.createElement('canvas');
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < 50 || h < 50) return null; // skip tiny images/icons

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      try {
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const result = decodeImageWatermark(imageData);
        return {
          type: 'image',
          src: img.src.substring(0, 200),
          width: w,
          height: h,
          token: result.token,
          confidence: result.confidence,
        };
      } catch (corsErr) {
        // Tainted canvas — try fetching through background
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'proxyFetch',
            url: img.src,
          });
          if (response && response.dataUrl) {
            const proxyImg = new Image();
            proxyImg.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
              proxyImg.onload = resolve;
              proxyImg.onerror = reject;
              proxyImg.src = response.dataUrl;
            });
            canvas.width = proxyImg.naturalWidth;
            canvas.height = proxyImg.naturalHeight;
            ctx.drawImage(proxyImg, 0, 0);
            const imageData = ctx.getImageData(0, 0, proxyImg.naturalWidth, proxyImg.naturalHeight);
            const result = decodeImageWatermark(imageData);
            return {
              type: 'image',
              src: img.src.substring(0, 200),
              width: proxyImg.naturalWidth,
              height: proxyImg.naturalHeight,
              token: result.token,
              confidence: result.confidence,
            };
          }
        } catch (e) {
          // ignore
        }
        return {
          type: 'image',
          src: img.src.substring(0, 200),
          width: w,
          height: h,
          token: null,
          confidence: 0,
          error: 'CORS blocked',
        };
      }
    } catch (err) {
      return null;
    }
  }

  // ─── Video Scanner ──────────────────────────────────────────────────────
  async function scanVideo(video) {
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w < 50 || h < 50) return null;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      try {
        ctx.drawImage(video, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const result = decodeImageWatermark(imageData);
        return {
          type: 'video',
          src: video.src ? video.src.substring(0, 200) : (video.currentSrc || '').substring(0, 200),
          width: w,
          height: h,
          token: result.token,
          confidence: result.confidence,
        };
      } catch (corsErr) {
        return {
          type: 'video',
          src: (video.src || video.currentSrc || '').substring(0, 200),
          width: w,
          height: h,
          token: null,
          confidence: 0,
          error: 'CORS blocked',
        };
      }
    } catch (err) {
      return null;
    }
  }

  // ─── Main Scan ──────────────────────────────────────────────────────────
  const results = [];

  // Scan images
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (!img.complete || !img.naturalWidth) continue;
    const r = await scanImage(img);
    if (r) results.push(r);
  }

  // Scan videos
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    if (video.readyState < 2) continue; // needs at least HAVE_CURRENT_DATA
    const r = await scanVideo(video);
    if (r) results.push(r);
  }

  // Send results to background for Firestore processing
  chrome.runtime.sendMessage({
    action: 'scanComplete',
    results,
    pageUrl: window.location.href,
    pageTitle: document.title,
  });
})();
