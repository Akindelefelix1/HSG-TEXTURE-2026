const DB_NAME="hsg-product-media";
const STORE_NAME="media";
const DB_VERSION=1;

function openMediaDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME)};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

export async function saveProductMedia(id:string,file:File){
  const db=await openMediaDb();
  await new Promise<void>((resolve,reject)=>{const transaction=db.transaction(STORE_NAME,"readwrite");transaction.objectStore(STORE_NAME).put(file,id);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});
  db.close();
}

export async function getProductMedia(id:string):Promise<Blob|null>{
  const db=await openMediaDb();
  const value=await new Promise<Blob|null>((resolve,reject)=>{const request=db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).get(id);request.onsuccess=()=>resolve(request.result instanceof Blob?request.result:null);request.onerror=()=>reject(request.error)});
  db.close();return value;
}

export async function deleteProductMedia(id:string){
  const db=await openMediaDb();
  await new Promise<void>((resolve,reject)=>{const transaction=db.transaction(STORE_NAME,"readwrite");transaction.objectStore(STORE_NAME).delete(id);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});
  db.close();
}
