// src/utils/tauriFileSaver.js

export const saveFileNatively = async (arrayBuffer, defaultFileName, fileType) => {
    const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

    if (!isTauri) return false; // Si estás en la web normal, retorna falso para que use la descarga clásica

    try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');

        const filterName = fileType === 'pdf' ? 'Documento PDF' : 'Libro de Excel';

        // 1. Abre la ventana de Windows "Guardar como..."
        const filePath = await save({
            defaultPath: defaultFileName,
            filters: [{ name: filterName, extensions: [fileType] }]
        });

        // 2. Si el usuario eligió una ruta y le dio a guardar, escribimos el archivo
        if (filePath) {
            const uint8Array = new Uint8Array(arrayBuffer);
            await writeFile(filePath, uint8Array);
        }

        return true;
    } catch (error) {
        console.error("Error al guardar el archivo nativamente:", error);
        return false;
    }
};