// Barcode-Scanner über die Kamera. Liefert die gescannte ISBN oder null (abgebrochen).
//
// Nutzt den eingebauten BarcodeDetector des Browsers, falls vorhanden (z. B. Android/Chrome),
// sonst die mitgelieferte ZXing-Bibliothek (iPhone). ZXing wird erst beim ersten Scannen geladen.

import { isbnFromBarcode } from '../core/index.js';

const ZXING_URL = 'src/vendor/zxing/zxing.min.js';
const SCAN_INTERVAL_MS = 150;

let zxingLoading = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxingLoading ||= new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), { src: ZXING_URL });
    script.onload = () => resolve(window.ZXing);
    script.onerror = () => {
      zxingLoading = null;
      reject(new Error('Scanner konnte nicht geladen werden.'));
    };
    document.head.append(script);
  });
  return zxingLoading;
}

// Liefert eine Funktion, die ein Canvas nach einem EAN-13-Barcode durchsucht.
async function createDecoder() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('ean_13')) {
        const detector = new window.BarcodeDetector({ formats: ['ean_13'] });
        return async (canvas) => (await detector.detect(canvas))[0]?.rawValue || null;
      }
    } catch {
      // Weiter mit ZXing.
    }
  }
  const Z = await loadZXing();
  const reader = new Z.MultiFormatReader();
  reader.setHints(new Map([
    [Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13]],
    [Z.DecodeHintType.TRY_HARDER, true],
  ]));
  return async (canvas) => {
    try {
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
      return reader.decode(bitmap).getText();
    } catch {
      return null; // Kein Barcode in diesem Bild.
    }
  };
}

function cameraError(err) {
  if (err?.name === 'NotAllowedError') {
    return 'Kein Zugriff auf die Kamera. Bitte in den iPhone-Einstellungen erlauben (Safari → Kamera).';
  }
  if (err?.name === 'NotFoundError') return 'Keine Kamera gefunden.';
  return err?.message || 'Kamera konnte nicht gestartet werden.';
}

export function createScanner($) {
  const dialog = $('scanner');
  const video = $('scanner-video');
  const hint = $('scanner-hint');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let stream = null;
  let timer = null;
  let finish = null;

  function stop() {
    clearTimeout(timer);
    timer = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    if (dialog.open) dialog.close();
  }

  // Mittleren Streifen des Kamerabilds (dort liegt der Rahmen) auf das Canvas kopieren.
  function grabFrame() {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return false;
    const cropW = w * 0.85;
    const cropH = h * 0.45;
    const scale = Math.min(1, 1000 / cropW);
    canvas.width = Math.round(cropW * scale);
    canvas.height = Math.round(cropH * scale);
    ctx.drawImage(video, (w - cropW) / 2, (h - cropH) / 2, cropW, cropH, 0, 0, canvas.width, canvas.height);
    return true;
  }

  async function loop(decode) {
    if (!stream) return;
    if (grabFrame()) {
      const isbn = isbnFromBarcode(await decode(canvas));
      if (isbn && stream) {
        finish(isbn);
        return;
      }
    }
    timer = setTimeout(() => loop(decode), SCAN_INTERVAL_MS);
  }

  function scan() {
    return new Promise((resolve, reject) => {
      finish = (result) => {
        stop();
        finish = null;
        resolve(result);
      };
      hint.textContent = 'Kamera wird gestartet …';
      dialog.showModal();

      (async () => {
        try {
          const media = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          });
          if (!finish) {
            media.getTracks().forEach((t) => t.stop());
            return;
          }
          stream = media;
          video.srcObject = stream;
          const [decode] = await Promise.all([createDecoder(), video.play()]);
          if (!stream) return;
          hint.textContent = 'Barcode auf der Buchrückseite in den Rahmen halten';
          loop(decode);
        } catch (err) {
          stop();
          finish = null;
          reject(new Error(cameraError(err)));
        }
      })();
    });
  }

  const cancel = () => finish?.(null);
  $('scanner-cancel').addEventListener('click', cancel);
  // Wischgeste/Escape schließt den Dialog ebenfalls.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    cancel();
  });

  const supported = Boolean(navigator.mediaDevices?.getUserMedia);
  return { scan, supported };
}
