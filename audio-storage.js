// Imported songs stay on this device. No network requests or uploads are made.
let database;
async function openAudioStore() {
  if (typeof indexedDB === 'undefined') throw new Error('Audio storage is unavailable');
  database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('zankii-audio-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Audio storage is busy'));
  });
  return database;
}
export async function storedAudio(id) {
  const db = await openAudioStore();
  return new Promise((resolve, reject) => {
    const request = db.transaction('tracks', 'readonly').objectStore('tracks').get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
export async function storeAudio(id, blob) {
  const db = await openAudioStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('tracks', 'readwrite');
    transaction.objectStore('tracks').put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Audio was not saved'));
  });
}
export async function removeAudio(id) {
  const db = await openAudioStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('tracks', 'readwrite');
    transaction.objectStore('tracks').delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Audio was not removed'));
  });
}
