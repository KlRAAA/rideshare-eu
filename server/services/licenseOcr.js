// Reading the text on a license photo (OCR) with Tesseract, on our own server:
// free, no outside service, the English model bundled in node_modules.
// One read at a time, so a burst of uploads can't hog the CPU.
const path = require('path');

let reader = null; // a stand-in for tests
let workerPromise = null;
let queue = Promise.resolve();

async function tesseractRead(image) {
  workerPromise ??= (async () => {
    const { createWorker } = require('tesseract.js');
    const langPath = path.dirname(require.resolve('@tesseract.js-data/eng/4.0.0/eng.traineddata.gz'));
    // Without an errorHandler a photo Tesseract can't read throws outside the
    // job's promise and takes the whole server down.
    return createWorker('eng', 1, { langPath, gzip: true, cacheMethod: 'none', errorHandler: () => {} });
  })();
  const worker = await workerPromise;
  const { data } = await worker.recognize(await normalise(image));
  return data.text;
}

// Decode the photo ourselves first (a broken file fails here, harmlessly), and
// give Tesseract a clean grayscale image of a sensible size, which reads better.
async function normalise(image) {
  const sharp = require('sharp');
  return sharp(image).rotate().grayscale().resize({ width: 1600, withoutEnlargement: true }).normalise().png().toBuffer();
}

function setOcrReader(fn) {
  reader = fn;
}

// On unless LICENSE_OCR=off; under Jest only when a test supplies a reader.
function ocrEnabled() {
  if (reader) return true;
  if (process.env.LICENSE_OCR === 'off') return false;
  return process.env.NODE_ENV !== 'test';
}

function readText(image) {
  return (reader ?? tesseractRead)(image);
}

// Runs `task` after every earlier one; resolves with its result.
function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

// Resolves once every queued check has finished (tests).
const idle = () => queue;

module.exports = { readText, setOcrReader, ocrEnabled, enqueue, idle };
