const DATABASE_NAME = 'knowledge-maps-media';
const DATABASE_VERSION = 6;
const STORE_NAME = 'node-images';
const NOTE_BACKGROUND_STORE = 'note-backgrounds';
const CARD_IMAGE_STORE = 'card-images';
const HOME_BACKGROUND_STORE = 'home-backgrounds';
const FLOATING_MEDIA_STORE = 'floating-media';
const FLASHCARD_IMAGE_STORE = 'flashcard-images';
const MEDIA_SCOPE_INDEX = 'scope';
const MAP_NODE_INDEX = 'map-node';

export type StoredNodeImage = {
  id: string;
  mapId: string;
  nodeId: string;
  mapNodeKey: string;
  name: string;
  type: string;
  caption: string;
  createdAt: number;
  blob: Blob;
};

function getMapNodeKey(mapId: string, nodeId: string) {
  return `${mapId}:${nodeId}`;
}

function openImageDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: 'id' });

      if (store && !store.indexNames.contains(MAP_NODE_INDEX)) {
        store.createIndex(MAP_NODE_INDEX, 'mapNodeKey', { unique: false });
      }
      if (!database.objectStoreNames.contains(NOTE_BACKGROUND_STORE)) {
        database.createObjectStore(NOTE_BACKGROUND_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(CARD_IMAGE_STORE)) {
        database.createObjectStore(CARD_IMAGE_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(HOME_BACKGROUND_STORE)) {
        database.createObjectStore(HOME_BACKGROUND_STORE, { keyPath: 'key' });
      }
      const mediaStore = database.objectStoreNames.contains(FLOATING_MEDIA_STORE)
        ? request.transaction?.objectStore(FLOATING_MEDIA_STORE)
        : database.createObjectStore(FLOATING_MEDIA_STORE, { keyPath: 'id' });
      if (mediaStore && !mediaStore.indexNames.contains(MEDIA_SCOPE_INDEX)) {
        mediaStore.createIndex(MEDIA_SCOPE_INDEX, 'scope', { unique: false });
      }
      if (!database.objectStoreNames.contains(FLASHCARD_IMAGE_STORE)) {
        database.createObjectStore(FLASHCARD_IMAGE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to open image storage.'));
  });
}

const flashcardImageKey = (mapId: string, cardId: string) => `${mapId}:${cardId}`;

export type StoredFlashcardImage = {
  key: string;
  mapId: string;
  cardId: string;
  name: string;
  type: string;
  blob: Blob;
};

export function getFlashcardImage(mapId: string, cardId: string) {
  return openImageDatabase().then((database) => new Promise<StoredFlashcardImage | undefined>((resolve, reject) => {
    const transaction = database.transaction(FLASHCARD_IMAGE_STORE, 'readonly');
    const request = transaction.objectStore(FLASHCARD_IMAGE_STORE).get(flashcardImageKey(mapId, cardId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  }));
}

export function setFlashcardImage(mapId: string, cardId: string, file: File) {
  const image: StoredFlashcardImage = {
    key: flashcardImageKey(mapId, cardId),
    mapId,
    cardId,
    name: file.name,
    type: file.type,
    blob: file,
  };
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FLASHCARD_IMAGE_STORE, 'readwrite');
    transaction.objectStore(FLASHCARD_IMAGE_STORE).put(image);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

export function deleteFlashcardImage(mapId: string, cardId: string) {
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FLASHCARD_IMAGE_STORE, 'readwrite');
    transaction.objectStore(FLASHCARD_IMAGE_STORE).delete(flashcardImageKey(mapId, cardId));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

function copyOrDeleteFlashcardImages(sourceMapId: string, targetMapId?: string) {
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FLASHCARD_IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(FLASHCARD_IMAGE_STORE);
    const request = store.getAll();
    request.onsuccess = () => request.result
      .filter((item) => item.mapId === sourceMapId)
      .forEach((item) => {
        if (targetMapId) {
          store.put({ ...item, key: flashcardImageKey(targetMapId, item.cardId), mapId: targetMapId });
        } else {
          store.delete(item.key);
        }
      });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

export const duplicateMapFlashcardImages = (sourceMapId: string, targetMapId: string) =>
  copyOrDeleteFlashcardImages(sourceMapId, targetMapId);
export const deleteMapFlashcardImages = (mapId: string) =>
  copyOrDeleteFlashcardImages(mapId);

export type StoredFloatingMedia = {
  id: string;
  scope: string;
  name: string;
  type: string;
  blob: Blob;
};

export function setFloatingMedia(
  scope: string,
  id: string,
  file: File | Blob,
  name = 'media',
) {
  const media: StoredFloatingMedia = {
    id,
    scope,
    name: file instanceof File ? file.name : name,
    type: file.type,
    blob: file,
  };
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FLOATING_MEDIA_STORE, 'readwrite');
    transaction.objectStore(FLOATING_MEDIA_STORE).put(media);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

export function listFloatingMedia(scope: string) {
  return openImageDatabase().then((database) => new Promise<StoredFloatingMedia[]>((resolve, reject) => {
    const transaction = database.transaction(FLOATING_MEDIA_STORE, 'readonly');
    const request = transaction.objectStore(FLOATING_MEDIA_STORE).index(MEDIA_SCOPE_INDEX).getAll(scope);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  }));
}

export function deleteFloatingMedia(id: string) {
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FLOATING_MEDIA_STORE, 'readwrite');
    transaction.objectStore(FLOATING_MEDIA_STORE).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

function copyOrDeleteFloatingMedia(sourceScope: string, targetScope?: string) {
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FLOATING_MEDIA_STORE, 'readwrite');
    const store = transaction.objectStore(FLOATING_MEDIA_STORE);
    const request = store.index(MEDIA_SCOPE_INDEX).getAll(sourceScope);
    request.onsuccess = () => request.result.forEach((media) => {
      if (targetScope) {
        const nextId = media.id.replace(sourceScope, targetScope);
        store.put({ ...media, id: nextId, scope: targetScope });
      } else {
        store.delete(media.id);
      }
    });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

export const duplicateMapFloatingMedia = (sourceMapId: string, targetMapId: string) =>
  copyOrDeleteFloatingMedia(sourceMapId, targetMapId);
export const deleteMapFloatingMedia = (mapId: string) =>
  copyOrDeleteFloatingMedia(mapId);

export type StoredCardImage = {
  key: string;
  mapId: string;
  nodeId: string;
  name: string;
  type: string;
  blob: Blob;
};

export function getCardImage(mapId: string, nodeId: string) {
  return openImageDatabase().then((database) => new Promise<StoredCardImage | undefined>((resolve, reject) => {
    const transaction = database.transaction(CARD_IMAGE_STORE, 'readonly');
    const request = transaction.objectStore(CARD_IMAGE_STORE).get(getMapNodeKey(mapId, nodeId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  }));
}

export function setCardImage(mapId: string, nodeId: string, file: File) {
  const image: StoredCardImage = { key: getMapNodeKey(mapId, nodeId), mapId, nodeId, name: file.name, type: file.type, blob: file };
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CARD_IMAGE_STORE, 'readwrite');
    transaction.objectStore(CARD_IMAGE_STORE).put(image);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

export function deleteCardImage(mapId: string, nodeId: string) {
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CARD_IMAGE_STORE, 'readwrite');
    transaction.objectStore(CARD_IMAGE_STORE).delete(getMapNodeKey(mapId, nodeId));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

export async function copyCardImageToNodes(
  mapId: string,
  sourceNodeId: string,
  targetNodeIds: string[],
) {
  const source = await getCardImage(mapId, sourceNodeId);
  const database = await openImageDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CARD_IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(CARD_IMAGE_STORE);
    targetNodeIds.forEach((nodeId) => {
      const key = getMapNodeKey(mapId, nodeId);
      if (source) {
        store.put({ ...source, key, nodeId });
      } else {
        store.delete(key);
      }
    });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function copyOrDeleteCardImages(sourceMapId: string, targetMapId?: string) {
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CARD_IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(CARD_IMAGE_STORE);
    const request = store.getAll();
    request.onsuccess = () => request.result.filter((item) => item.mapId === sourceMapId).forEach((item) => {
      if (targetMapId) store.put({ ...item, key: getMapNodeKey(targetMapId, item.nodeId), mapId: targetMapId });
      else store.delete(item.key);
    });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}
export const duplicateMapCardImages = (sourceMapId: string, targetMapId: string) => copyOrDeleteCardImages(sourceMapId, targetMapId);
export const deleteMapCardImages = (mapId: string) => copyOrDeleteCardImages(mapId);

export type StoredHomeBackground = {
  key: string;
  name: string;
  type: string;
  blob: Blob;
};

function getHomeBackground(key: string) {
  return openImageDatabase().then((database) => new Promise<StoredHomeBackground | undefined>((resolve, reject) => {
    const transaction = database.transaction(HOME_BACKGROUND_STORE, 'readonly');
    const request = transaction.objectStore(HOME_BACKGROUND_STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  }));
}

function setHomeBackground(key: string, file: File) {
  const background: StoredHomeBackground = { key, name: file.name, type: file.type, blob: file };
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(HOME_BACKGROUND_STORE, 'readwrite');
    transaction.objectStore(HOME_BACKGROUND_STORE).put(background);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

function deleteHomeBackground(key: string) {
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(HOME_BACKGROUND_STORE, 'readwrite');
    transaction.objectStore(HOME_BACKGROUND_STORE).delete(key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

const HOME_PAGE_BACKGROUND_KEY = 'home-page';
const mapCardBackgroundKey = (mapId: string) => `map-card:${mapId}`;
const mapCanvasBackgroundKey = (mapId: string) => `map-canvas:${mapId}`;

export const getHomePageBackground = () => getHomeBackground(HOME_PAGE_BACKGROUND_KEY);
export const setHomePageBackground = (file: File) => setHomeBackground(HOME_PAGE_BACKGROUND_KEY, file);
export const deleteHomePageBackground = () => deleteHomeBackground(HOME_PAGE_BACKGROUND_KEY);
export const getMapCardBackground = (mapId: string) => getHomeBackground(mapCardBackgroundKey(mapId));
export const setMapCardBackground = (mapId: string, file: File) => setHomeBackground(mapCardBackgroundKey(mapId), file);
export const deleteMapCardBackground = (mapId: string) => deleteHomeBackground(mapCardBackgroundKey(mapId));
export const getMapCanvasBackground = (mapId: string) => getHomeBackground(mapCanvasBackgroundKey(mapId));
export const setMapCanvasBackground = (mapId: string, file: File) => setHomeBackground(mapCanvasBackgroundKey(mapId), file);
export const deleteMapCanvasBackground = (mapId: string) => deleteHomeBackground(mapCanvasBackgroundKey(mapId));

export async function duplicateMapCardBackground(sourceMapId: string, targetMapId: string) {
  const source = await getMapCardBackground(sourceMapId);
  if (!source) return;
  const file = new File([source.blob], source.name, { type: source.type });
  await setMapCardBackground(targetMapId, file);
}

export async function duplicateMapCanvasBackground(sourceMapId: string, targetMapId: string) {
  const source = await getMapCanvasBackground(sourceMapId);
  if (!source) return;
  const file = new File([source.blob], source.name, { type: source.type });
  await setMapCanvasBackground(targetMapId, file);
}

export type StoredNoteBackground = {
  key: string;
  mapId: string;
  nodeId: string;
  name: string;
  type: string;
  blob: Blob;
};

export function getNoteBackground(mapId: string, nodeId: string) {
  const key = getMapNodeKey(mapId, nodeId);
  return openImageDatabase().then(
    (database) =>
      new Promise<StoredNoteBackground | undefined>((resolve, reject) => {
        const transaction = database.transaction(NOTE_BACKGROUND_STORE, 'readonly');
        const request = transaction.objectStore(NOTE_BACKGROUND_STORE).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
      }),
  );
}

export function setNoteBackground(mapId: string, nodeId: string, file: File) {
  const background: StoredNoteBackground = {
    key: getMapNodeKey(mapId, nodeId),
    mapId,
    nodeId,
    name: file.name,
    type: file.type,
    blob: file,
  };
  return openImageDatabase().then(
    (database) =>
      new Promise<StoredNoteBackground>((resolve, reject) => {
        const transaction = database.transaction(NOTE_BACKGROUND_STORE, 'readwrite');
        transaction.objectStore(NOTE_BACKGROUND_STORE).put(background);
        transaction.oncomplete = () => {
          database.close();
          resolve(background);
        };
        transaction.onerror = () => reject(transaction.error);
      }),
  );
}

export function deleteNoteBackground(mapId: string, nodeId: string) {
  return openImageDatabase().then(
    (database) =>
      new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(NOTE_BACKGROUND_STORE, 'readwrite');
        transaction.objectStore(NOTE_BACKGROUND_STORE).delete(getMapNodeKey(mapId, nodeId));
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      }),
  );
}

export async function duplicateMapNoteBackgrounds(
  sourceMapId: string,
  targetMapId: string,
) {
  const database = await openImageDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(NOTE_BACKGROUND_STORE, 'readwrite');
    const store = transaction.objectStore(NOTE_BACKGROUND_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      request.result
        .filter((item) => item.mapId === sourceMapId)
        .forEach((item) =>
          store.put({
            ...item,
            key: getMapNodeKey(targetMapId, item.nodeId),
            mapId: targetMapId,
          }),
        );
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteMapNoteBackgrounds(mapId: string) {
  const database = await openImageDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(NOTE_BACKGROUND_STORE, 'readwrite');
    const store = transaction.objectStore(NOTE_BACKGROUND_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      request.result
        .filter((item) => item.mapId === mapId)
        .forEach((item) => store.delete(item.key));
    };
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openImageDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error('Image storage operation failed.'));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(
            transaction.error ?? new Error('Image storage transaction failed.'),
          );
        };
      }),
  );
}

export function listNodeImages(mapId: string, nodeId: string) {
  return runTransaction<StoredNodeImage[]>('readonly', (store) =>
    store.index(MAP_NODE_INDEX).getAll(getMapNodeKey(mapId, nodeId)),
  ).then((images) => images.sort((a, b) => a.createdAt - b.createdAt));
}

export function addNodeImage(mapId: string, nodeId: string, file: File) {
  const image: StoredNodeImage = {
    id: crypto.randomUUID(),
    mapId,
    nodeId,
    mapNodeKey: getMapNodeKey(mapId, nodeId),
    name: file.name,
    type: file.type,
    caption: '',
    createdAt: Date.now(),
    blob: file,
  };

  return runTransaction<IDBValidKey>('readwrite', (store) =>
    store.add(image),
  ).then(() => image);
}

export function updateNodeImageCaption(
  image: StoredNodeImage,
  caption: string,
) {
  const updatedImage = { ...image, caption };
  return runTransaction<IDBValidKey>('readwrite', (store) =>
    store.put(updatedImage),
  ).then(() => updatedImage);
}

export function deleteNodeImage(imageId: string) {
  return runTransaction<undefined>('readwrite', (store) =>
    store.delete(imageId),
  );
}

export function replaceNodeImages(
  mapId: string,
  nodeId: string,
  images: StoredNodeImage[],
) {
  return openImageDatabase().then((database) => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.index(MAP_NODE_INDEX).getAll(getMapNodeKey(mapId, nodeId));
    request.onsuccess = () => {
      request.result.forEach((image) => store.delete(image.id));
      images.forEach((image) => store.put(image));
    };
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  }));
}

export function duplicateMapImages(sourceMapId: string, targetMapId: string) {
  return openImageDatabase().then(
    (database) =>
      new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          request.result
            .filter((image) => image.mapId === sourceMapId)
            .forEach((image) => {
              store.add({
                ...image,
                id: crypto.randomUUID(),
                mapId: targetMapId,
                mapNodeKey: getMapNodeKey(targetMapId, image.nodeId),
              });
            });
        };
        request.onerror = () =>
          reject(request.error ?? new Error('Unable to copy map images.'));
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error('Unable to copy map images.'));
        };
      }),
  );
}

export function deleteMapImages(mapId: string) {
  return openImageDatabase().then(
    (database) =>
      new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          request.result
            .filter((image) => image.mapId === mapId)
            .forEach((image) => store.delete(image.id));
        };
        request.onerror = () =>
          reject(request.error ?? new Error('Unable to delete map images.'));
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(
            transaction.error ?? new Error('Unable to delete map images.'),
          );
        };
      }),
  );
}
