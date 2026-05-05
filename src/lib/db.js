import Dexie from 'dexie';

// Inicializar la base de datos local
export const db = new Dexie('ChanellPOS');

// Definir el esquema de la base de datos
db.version(1).stores({
    // 'id' es la clave primaria. Guardaremos todo el objeto producto.
    catalog: 'id, barcode, name, category', 
    
    // 'idempotency_key' es la clave primaria para la cola de sincronización.
    // 'status' nos permite filtrar por 'pending'.
    sync_queue: 'idempotency_key, status, created_at'
});
