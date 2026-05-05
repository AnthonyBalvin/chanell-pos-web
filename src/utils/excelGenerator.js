import * as XLSX from 'xlsx-js-style';

// ─── PALETA CHANELL TECNOLOGÍA ────────────────────────────────────────────────
const C = {
    azulOscuro: '1E3A5F',
    azulHeader: '2563A8',
    azulClaro: 'D6E4F7',
    blanco: 'FFFFFF',
    amarillo: 'FFF9C4',
    verde: 'C8E6C9',
    rojo: 'FFCDD2',
    celeste: 'BBDEFB',
    negro: '212121',
    azulTexto: '1A237E',
    verdeOscuro: '1B5E20',
    gris: '90A4AE',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fill = (rgb) => ({ patternType: 'solid', fgColor: { rgb } });
const border = (rgb = 'B0BEC5', style = 'thin') => ({ style, color: { rgb } });
const fullBorder = () => ({
    top: border(), bottom: border(), left: border(), right: border(),
});
const totalBorder = () => ({
    top: border(C.azulOscuro, 'medium'), bottom: border(C.azulOscuro, 'medium'),
    left: border(), right: border(),
});

const font = (bold, sz, rgb, italic = false) =>
    ({ name: 'Arial', bold, sz, color: { rgb }, italic });

const align = (horizontal, wrapText = false) =>
    ({ horizontal, vertical: 'center', wrapText });

// Badge de estado → color de fondo
const BADGE = {
    VENDIDO: C.verde,
    ANULADO: C.rojo,
    PENDIENTE: C.amarillo,
    'EN PROCESO': C.celeste,
    ENTRADA: C.verde,
    SALIDA: C.rojo,
    AJUSTE: C.amarillo,
    TRASLADO: C.celeste,
    RECIBIDA: C.verde,
    'EN TRÁNSITO': C.celeste,
    ANULADA: C.rojo,
    PAGADO: C.verde,
    PARCIAL: C.celeste,
};

// ─── CABECERA CORPORATIVA (filas 1–4) ─────────────────────────────────────────
const buildHeader = (tituloReporte, ncols) => {
    const ahora = new Date().toLocaleString('es-PE');
    const pad = (s, n) => [s, ...Array(n - 1).fill({ v: '' })];

    return [
        pad({
            v: 'CHANELL  TECNOLOGÍA', s: {
                font: font(true, 18, 'FFB6C1'), fill: fill(C.azulOscuro), alignment: align('center'),
            }
        }, ncols),
        pad({
            v: tituloReporte, s: {
                font: font(true, 13, C.blanco), fill: fill(C.azulOscuro), alignment: align('center'),
            }
        }, ncols),
        pad({
            v: `Generado el:  ${ahora}`, s: {
                font: font(false, 9, 'AECBEB', true), fill: fill(C.azulOscuro), alignment: align('center'),
            }
        }, ncols),
        Array(ncols).fill({ v: '', s: { fill: fill(C.azulOscuro) } }),
    ];
};

// ─── FILA DE ENCABEZADOS ──────────────────────────────────────────────────────
const buildTableHeaders = (headers) =>
    headers.map(h => ({
        v: h,
        s: {
            font: font(true, 10, C.blanco),
            fill: fill(C.azulHeader),
            alignment: align('center', true),
            border: {
                top: border(C.blanco), bottom: border(C.blanco, 'medium'),
                left: border(C.blanco), right: border(C.blanco),
            },
        },
    }));

// ─── CELDA DE DATO ────────────────────────────────────────────────────────────
const dataCell = (v, tipo, bg, badgeColor = null) => {
    const bgFinal = badgeColor || bg;
    const base = { fill: fill(bgFinal), border: fullBorder() };

    if (tipo === 'moneda') return {
        v, t: 'n', z: '#,##0.00',
        s: { ...base, font: font(false, 10, C.negro), alignment: align('right') }
    };

    if (tipo === 'badge') return {
        v,
        s: { ...base, font: font(true, 9, C.azulTexto), alignment: align('center') }
    };

    if (tipo === 'numero') return {
        v, t: 'n',
        s: { ...base, font: font(false, 10, C.negro), alignment: align('center') }
    };

    return {
        v,
        s: { ...base, font: font(false, 10, C.negro), alignment: align('left', true) }
    };
};

// ─── FILA DE TOTAL ────────────────────────────────────────────────────────────
const buildTotalRow = (label, monto, ncols, colLabel, colMonto) =>
    Array.from({ length: ncols }, (_, i) => {
        if (i === colLabel) return {
            v: label,
            s: {
                fill: fill(C.amarillo), border: totalBorder(),
                font: font(true, 10, C.azulTexto), alignment: align('right')
            }
        };
        if (i === colMonto) return {
            v: monto, t: 'n', z: '"S/" #,##0.00',
            s: {
                fill: fill(C.amarillo), border: totalBorder(),
                font: font(true, 11, C.verdeOscuro), alignment: align('right')
            }
        };
        return { v: '', s: { fill: fill(C.amarillo), border: totalBorder() } };
    });

// ─── PIE ──────────────────────────────────────────────────────────────────────
const buildFooterRow = (ncols) => [
    {
        v: '© Chanell Tecnología  —  Documento confidencial. Uso interno.',
        s: { font: font(false, 8, C.gris, true), alignment: align('center') }
    },
    ...Array(ncols - 1).fill({ v: '' }),
];

// ─── METADATOS DE HOJA ────────────────────────────────────────────────────────
const applySheetMeta = (ws, wscols, totalDataRows, ncols, hasTotal) => {
    ws['!cols'] = wscols;

    const ROW_ENCABEZADO = 4;   // 0-indexed → fila 5 en Excel
    const ROW_DATOS_INI = 5;   // 0-indexed → fila 6 en Excel
    const ROW_TOTAL = hasTotal ? ROW_DATOS_INI + totalDataRows + 1 : null;
    const ROW_PIE = (ROW_TOTAL ?? ROW_DATOS_INI + totalDataRows) + 2;

    const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: ncols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: ncols - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: ncols - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: ncols - 1 } },
        { s: { r: ROW_PIE, c: 0 }, e: { r: ROW_PIE, c: ncols - 1 } },
    ];
    if (ROW_TOTAL !== null) {
        merges.push({ s: { r: ROW_TOTAL, c: 0 }, e: { r: ROW_TOTAL, c: ncols - 3 } });
    }
    ws['!merges'] = merges;
    ws['!freeze'] = { xSplit: 0, ySplit: 5 };
    ws['!sheetView'] = [{ showGridLines: false }];
};

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT 1 — VENTAS
// ══════════════════════════════════════════════════════════════════════════════
export const exportarVentasExcel = (data) => {
    const workbook = XLSX.utils.book_new();

    const headers = ['Ticket', 'Fecha', 'Cliente', 'DNI/RUC',
        'Logística', 'Método Pago', 'Estado', 'Total (S/)'];
    const NCOLS = headers.length;

    let totalIngresos = 0;
    const dataRows = data.map((p, i) => {
        const monto = p.total ? Number(p.total.toFixed(2)) : 0;
        const estado = p.estado ? p.estado.toUpperCase() : 'N/A';
        if (p.estado === 'vendido') totalIngresos += monto;
        const bg = i % 2 === 0 ? C.azulClaro : C.blanco;

        return [
            dataCell(p.ticket, 'texto', bg),
            dataCell(new Date(p.created_at).toLocaleString('es-PE'), 'texto', bg),
            dataCell(p.cliente_nombre || 'Cliente Público', 'texto', bg),
            dataCell(p.cliente_dni_ruc || 'N/A', 'texto', bg),
            dataCell(p.metodo_entrega === 'pickup' ? 'Recojo Tienda' : 'Envío', 'texto', bg),
            dataCell(p.metodo_pago ? p.metodo_pago.toUpperCase() : 'N/A', 'texto', bg),
            dataCell(estado, 'badge', bg, BADGE[estado]),
            dataCell(monto, 'moneda', bg),
        ];
    });

    const aoa = [
        ...buildHeader('REPORTE GERENCIAL DE VENTAS', NCOLS),
        buildTableHeaders(headers),
        ...dataRows,
        Array(NCOLS).fill({ v: '' }),
        buildTotalRow('INGRESOS TOTALES (Vendidos):', totalIngresos, NCOLS, NCOLS - 2, NCOLS - 1),
        Array(NCOLS).fill({ v: '' }),
        buildFooterRow(NCOLS),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applySheetMeta(ws, [
        { wch: 12 }, { wch: 22 }, { wch: 35 }, { wch: 15 },
        { wch: 16 }, { wch: 15 }, { wch: 14 }, { wch: 13 },
    ], dataRows.length, NCOLS, true);

    XLSX.utils.book_append_sheet(workbook, ws, 'Historial_Ventas');
    const fechaStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Reporte_Ventas_Chanell_${fechaStr}.xlsx`);
};

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT 2 — KARDEX
// ══════════════════════════════════════════════════════════════════════════════
export const exportarKardexExcel = (data) => {
    const workbook = XLSX.utils.book_new();

    const headers = ['Fecha', 'Hora', 'Producto', 'Tipo Movimiento',
        'Cant.', 'Stock Anterior', 'Stock Nuevo', 'Motivo', 'Responsable'];
    const NCOLS = headers.length;

    const dataRows = data.map((m, i) => {
        const fecha = new Date(m.created_at);
        const tipo = m.tipo_movimiento.toUpperCase();
        const bg = i % 2 === 0 ? C.azulClaro : C.blanco;

        return [
            dataCell(fecha.toLocaleDateString('es-PE'), 'texto', bg),
            dataCell(fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }), 'texto', bg),
            dataCell(m.producto_nombre, 'texto', bg),
            dataCell(tipo, 'badge', bg, BADGE[tipo]),
            dataCell(m.cantidad, 'numero', bg),
            dataCell(m.stock_anterior, 'numero', bg),
            dataCell(m.stock_nuevo, 'numero', bg),
            dataCell(m.motivo, 'texto', bg),
            dataCell(m.usuario_nombre?.split('@')[0] || 'Admin', 'texto', bg),
        ];
    });

    const aoa = [
        ...buildHeader('REPORTE DE AUDITORÍA KARDEX', NCOLS),
        buildTableHeaders(headers),
        ...dataRows,
        Array(NCOLS).fill({ v: '' }),
        buildFooterRow(NCOLS),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applySheetMeta(ws, [
        { wch: 12 }, { wch: 10 }, { wch: 35 }, { wch: 15 },
        { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 45 }, { wch: 15 },
    ], dataRows.length, NCOLS, false);

    XLSX.utils.book_append_sheet(workbook, ws, 'Kardex');
    const fechaStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Kardex_Auditoria_${fechaStr}.xlsx`);
};

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT 3 — COMPRAS
// ══════════════════════════════════════════════════════════════════════════════
export const exportarComprasExcel = (data) => {
    const workbook = XLSX.utils.book_new();

    const headers = ['Código OC', 'Fecha', 'Proveedor',
        'Estado Logístico', 'Estado Financiero', 'Total (S/)'];
    const NCOLS = headers.length;

    let totalDeuda = 0;
    const dataRows = data.map((c, i) => {
        const monto = c.total_estimado || c.total || 0;
        const estadoPago = c.estado_pago || 'pendiente';
        const estadoLog = c.estado ? c.estado.toUpperCase() : 'N/A';
        const estadoFin = estadoPago.toUpperCase();
        if (estadoPago !== 'pagado' && c.estado !== 'Anulada') totalDeuda += monto;
        const bg = i % 2 === 0 ? C.azulClaro : C.blanco;

        return [
            dataCell(c.numero_orden || c.codigo, 'texto', bg),
            dataCell(new Date(c.created_at).toLocaleDateString('es-PE'), 'texto', bg),
            dataCell(c.proveedores?.razon_social || c.proveedor?.nombre || 'Desconocido', 'texto', bg),
            dataCell(estadoLog, 'badge', bg, BADGE[estadoLog]),
            dataCell(estadoFin, 'badge', bg, BADGE[estadoFin]),
            dataCell(monto, 'moneda', bg),
        ];
    });

    const aoa = [
        ...buildHeader('REPORTE DE COMPRAS Y CUENTAS POR PAGAR', NCOLS),
        buildTableHeaders(headers),
        ...dataRows,
        Array(NCOLS).fill({ v: '' }),
        buildTotalRow('DEUDA TOTAL PENDIENTE:', totalDeuda, NCOLS, NCOLS - 2, NCOLS - 1),
        Array(NCOLS).fill({ v: '' }),
        buildFooterRow(NCOLS),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applySheetMeta(ws, [
        { wch: 15 }, { wch: 12 }, { wch: 35 },
        { wch: 18 }, { wch: 18 }, { wch: 15 },
    ], dataRows.length, NCOLS, true);

    XLSX.utils.book_append_sheet(workbook, ws, 'Cuentas_Por_Pagar');
    const fechaStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Reporte_Compras_${fechaStr}.xlsx`);
};

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT 4 — REPORTE DE VENTAS DIARIAS (FINANCIERO)
// ══════════════════════════════════════════════════════════════════════════════
export const exportarVentasDiariasExcel = (data, periodoTexto) => {
    const workbook = XLSX.utils.book_new();

    const headers = ['Fecha', 'N° Pedidos', 'Ingreso Bruto (S/)', 'Costo Total (S/)', 'Ganancia Neta (S/)'];
    const NCOLS = headers.length;

    let totalIngresos = 0;
    let totalGanancia = 0;

    const dataRows = data.map((d, i) => {
        const ingresos = Number(d.ingresos || 0);
        const ganancia = Number(d.ganancia || 0);
        totalIngresos += ingresos;
        totalGanancia += ganancia;
        const bg = i % 2 === 0 ? C.azulClaro : C.blanco;

        return [
            dataCell(new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-PE'), 'texto', bg),
            dataCell(d.num_pedidos, 'numero', bg),
            dataCell(ingresos, 'moneda', bg),
            dataCell(d.costo_total, 'moneda', bg),
            dataCell(ganancia, 'moneda', bg),
        ];
    });

    const aoa = [
        ...buildHeader(`REPORTE DE VENTAS DIARIAS (${periodoTexto})`, NCOLS),
        buildTableHeaders(headers),
        ...dataRows,
        Array(NCOLS).fill({ v: '' }),
        buildTotalRow('TOTALES:', totalIngresos, NCOLS, NCOLS - 3, NCOLS - 2), // Total Ingresos
        buildTotalRow('GANANCIA NETA TOTAL:', totalGanancia, NCOLS, NCOLS - 2, NCOLS - 1), // Total Ganancias
        Array(NCOLS).fill({ v: '' }),
        buildFooterRow(NCOLS),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applySheetMeta(ws, [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }], dataRows.length, NCOLS, true);

    // Arreglar el row total extra que metimos
    ws['!merges'].push({ s: { r: ws['!merges'][ws['!merges'].length - 1].s.r - 1, c: 0 }, e: { r: ws['!merges'][ws['!merges'].length - 1].s.r - 1, c: NCOLS - 4 } });


    XLSX.utils.book_append_sheet(workbook, ws, 'Ventas_Diarias');
    XLSX.writeFile(workbook, `Ventas_Diarias_${periodoTexto}.xlsx`);
};

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT 5 — REPORTE DE RANKING DE PRODUCTOS (FINANCIERO)
// ══════════════════════════════════════════════════════════════════════════════
export const exportarRankingProductosExcel = (data, periodoTexto) => {
    const workbook = XLSX.utils.book_new();

    const headers = ['Producto', 'Unidades Vendidas', 'Ingreso Bruto (S/)', 'Costo Total (S/)', 'Ganancia Neta (S/)', 'Margen Real (%)'];
    const NCOLS = headers.length;

    const dataRows = data.map((d, i) => {
        const bg = i % 2 === 0 ? C.azulClaro : C.blanco;
        return [
            dataCell(d.producto_nombre, 'texto', bg),
            dataCell(d.unidades, 'numero', bg),
            dataCell(d.ingresos, 'moneda', bg),
            dataCell(d.costo_total, 'moneda', bg),
            dataCell(d.ganancia, 'moneda', bg),
            dataCell(Number(d.margen_pct) / 100, 'moneda', bg), // El formato xlsx soporta % si pasamos el valor entre 0 y 1
        ];
    });

    // Ajustamos el formato de la última columna (Margen) para que se vea como % en Excel
    dataRows.forEach(row => { row[5].z = '0.00%'; });

    const aoa = [
        ...buildHeader(`RANKING DE PRODUCTOS (${periodoTexto})`, NCOLS),
        buildTableHeaders(headers),
        ...dataRows,
        Array(NCOLS).fill({ v: '' }),
        buildFooterRow(NCOLS),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applySheetMeta(ws, [{ wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }], dataRows.length, NCOLS, false);

    XLSX.utils.book_append_sheet(workbook, ws, 'Ranking_Productos');
    XLSX.writeFile(workbook, `Ranking_Productos_${periodoTexto}.xlsx`);
};

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT 6 — REPORTES DE RENDIMIENTO POR VENDEDOR (FINANCIERO)
// ══════════════════════════════════════════════════════════════════════════════
export const exportarVendedorRankingExcel = (data, periodoTexto) => {
    const workbook = XLSX.utils.book_new();

    // Ajustamos las columnas a lo que devuelve el RPC (Nombre, Pedidos, Ingresos, Ticket Promedio)
    const headers = ['Vendedor', 'N° Pedidos', 'Ingreso Total (S/)', 'Ticket Promedio (S/)'];
    const NCOLS = headers.length;

    let totalIngresos = 0;

    const dataRows = data.map((d, i) => {
        // Variables exactas de la base de datos
        const ingresos = Number(d.ingresos || 0);
        const ticketPromedio = Number(d.ticket_promedio || 0);
        totalIngresos += ingresos;
        const bg = i % 2 === 0 ? C.azulClaro : C.blanco;

        return [
            dataCell(d.vendedor_nombre || 'Desconocido', 'texto', bg),
            dataCell(d.num_pedidos, 'numero', bg),
            dataCell(ingresos, 'moneda', bg),
            dataCell(ticketPromedio, 'moneda', bg),
        ];
    });

    const aoa = [
        ...buildHeader(`RANKING DE RENDIMIENTO POR VENDEDOR (${periodoTexto})`, NCOLS),
        buildTableHeaders(headers),
        ...dataRows,
        Array(NCOLS).fill({ v: '' }),
        buildTotalRow('INGRESOS TOTALES:', totalIngresos, NCOLS, NCOLS - 2, NCOLS - 1),
        Array(NCOLS).fill({ v: '' }),
        buildFooterRow(NCOLS),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applySheetMeta(ws, [{ wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 25 }], dataRows.length, NCOLS, true);

    XLSX.utils.book_append_sheet(workbook, ws, 'Ranking_Vendedores');
    XLSX.writeFile(workbook, `Ranking_Vendedores_${periodoTexto}.xlsx`);
};

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT 7 — REPORTE DE MÉTODOS DE PAGO (FINANCIERO)
// ══════════════════════════════════════════════════════════════════════════════
export const exportarMetodosPagoExcel = (data, periodoTexto) => {
    const workbook = XLSX.utils.book_new();

    // Ajustamos las columnas a lo que devuelve el RPC (Método, Pedidos, Ingresos)
    const headers = ['Método de Pago', 'Cantidad de Transacciones', 'Monto Total Ingresado (S/)'];
    const NCOLS = headers.length;

    let totalIngresos = 0;

    const dataRows = data.map((d, i) => {
        const ingresos = Number(d.ingresos || 0);
        totalIngresos += ingresos;
        const bg = i % 2 === 0 ? C.azulClaro : C.blanco;

        // Capitalizamos el método de pago
        const metodo = String(d.metodo_pago || 'N/A').toUpperCase();

        return [
            dataCell(metodo, 'texto', bg),
            dataCell(d.num_pedidos, 'numero', bg),
            dataCell(ingresos, 'moneda', bg),
        ];
    });

    const aoa = [
        ...buildHeader(`REPORTE POR MÉTODOS DE PAGO (${periodoTexto})`, NCOLS),
        buildTableHeaders(headers),
        ...dataRows,
        Array(NCOLS).fill({ v: '' }),
        buildTotalRow('INGRESOS TOTALES:', totalIngresos, NCOLS, NCOLS - 2, NCOLS - 1),
        Array(NCOLS).fill({ v: '' }),
        buildFooterRow(NCOLS),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applySheetMeta(ws, [{ wch: 25 }, { wch: 30 }, { wch: 30 }], dataRows.length, NCOLS, true);

    XLSX.utils.book_append_sheet(workbook, ws, 'Metodos_Pago');
    XLSX.writeFile(workbook, `Metodos_Pago_${periodoTexto}.xlsx`);
};