// src/utils/pdfGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { uiManager } from '../context/UIContext';
import { saveFileNatively } from './tauriFileSaver'; // Importamos el puente nativo

// --- FUNCIÓN AYUDANTE PARA TRAER LA CONFIGURACIÓN ---
const getConfig = async () => {
    const { data, error } = await supabase.from('configuracion').select('*').eq('id', 1).single();
    if (error || !data) {
        return {
            empresa_nombre: 'CHANELL TECNOLOGÍA',
            empresa_ruc: '20123456789',
            empresa_telefono: '+51 987 654 321',
            impuesto_nombre: 'IGV',
            impuesto_porcentaje: 18,
            moneda: 'S/',
            ticket_mensaje: '¡Gracias por su compra!'
        };
    }
    return data;
};

// -------------------------------------------------------------
// 1. GENERADOR DEL REPORTE GENERAL (CUADRE DE CAJA) - A4
// -------------------------------------------------------------
export const generateSummaryPDF = async (pedidosFiltrados) => {
    try {
        const config = await getConfig();
        const doc = new jsPDF();

        const nameParts = config.empresa_nombre.split(' ');
        const firstWord = nameParts[0] || 'Chanell';
        const restOfName = nameParts.slice(1).join(' ') || 'Tecnología';

        doc.setFontSize(22);
        doc.setTextColor(236, 72, 153);
        doc.text(firstWord.toUpperCase() + " ", 14, 20);

        const offset = 14 + (doc.getStringUnitWidth(firstWord.toUpperCase() + " ") * 22 / doc.internal.scaleFactor);
        doc.setTextColor(59, 130, 246);
        doc.text(restOfName.toUpperCase(), offset, 20);

        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text("Reporte Operativo y Cuadre de Caja", 14, 30);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Fecha de Emisión: ${new Date().toLocaleString('es-PE')}`, 14, 38);

        const tableColumn = ["Ticket", "Cliente", "Fecha", "Logística", "Estado", `Total (${config.moneda})`];
        const tableRows = [];
        let sumaTotal = 0;

        pedidosFiltrados.forEach(pedido => {
            const monto = parseFloat(pedido.total) || 0;
            tableRows.push([
                `#${pedido.ticket || 'S/N'}`,
                pedido.cliente_nombre || 'Sin Nombre',
                new Date(pedido.created_at).toLocaleDateString('es-PE'),
                pedido.metodo_entrega === 'pickup' ? 'Recojo Tienda' : `Envío (${pedido.agencia || '-'})`,
                (pedido.estado || '').toUpperCase(),
                monto.toFixed(2)
            ]);
            if (pedido.estado !== 'anulado') sumaTotal += monto;
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [245, 245, 245] },
        });

        const finalY = doc.lastAutoTable.finalY || 45;
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(`Recaudación Total Válida: ${config.moneda} ${sumaTotal.toFixed(2)}`, 14, finalY + 15);

        const fileName = `Reporte_${firstWord}_${new Date().getTime()}.pdf`;

        // LÓGICA NATIVA: Intentar guardar con ventana de Windows
        const savedNatively = await saveFileNatively(doc.output('arraybuffer'), fileName, 'pdf');
        if (!savedNatively) {
            doc.save(fileName); // Fallback para la web
        }
    } catch (error) {
        console.error("Error al generar PDF General:", error);
        uiManager.notify("Hubo un problema al generar el reporte.", "error");
    }
};

// -------------------------------------------------------------
// 2. GENERADOR DE COMPROBANTE INDIVIDUAL - PDF (DIGITAL)
// -------------------------------------------------------------
export const generateIndividualPDF = async (selectedOrder) => {
    if (!selectedOrder) return;
    try {
        const config = await getConfig();
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 150] });

        const isFactura = selectedOrder.direccion?.includes("FACTURA");
        const isBoleta = selectedOrder.direccion?.includes("BOLETA");
        let tipoDocumentoStr = "TICKET DE VENTA";
        if (isFactura) tipoDocumentoStr = "FACTURA ELECTRÓNICA";
        if (isBoleta) tipoDocumentoStr = "BOLETA ELECTRÓNICA";

        const nameParts = config.empresa_nombre.split(' ');
        const firstWord = nameParts[0] || '';
        const restOfName = nameParts.slice(1).join(' ') || '';

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(236, 72, 153);
        doc.text(firstWord.toUpperCase(), 14, 15);

        const offset = 14 + (doc.getStringUnitWidth(firstWord.toUpperCase() + " ") * 14 / doc.internal.scaleFactor);
        doc.setTextColor(59, 130, 246);
        doc.text(restOfName.toUpperCase(), offset, 15);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`RUC: ${config.empresa_ruc || '-'}`, 40, 20, { align: "center" });
        doc.text(`Telf: ${config.empresa_telefono || '-'}`, 40, 24, { align: "center" });

        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        doc.line(5, 28, 75, 28);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(tipoDocumentoStr, 40, 33, { align: "center" });
        doc.text(`N°: ${selectedOrder.ticket || 'S/N'}`, 40, 38, { align: "center" });

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha: ${new Date(selectedOrder.created_at).toLocaleString('es-PE')}`, 5, 44);

        doc.setFont("helvetica", "bold");
        doc.text(isFactura ? "Razón Social:" : "Cliente:", 5, 50);
        doc.setFont("helvetica", "normal");
        doc.text(selectedOrder.cliente_nombre || 'Público General', 5, 54);

        if (selectedOrder.cliente_dni_ruc) {
            doc.text(`${isFactura ? 'RUC' : 'DNI'}: ${selectedOrder.cliente_dni_ruc}`, 5, 58);
        }

        let currentY = selectedOrder.cliente_dni_ruc ? 64 : 60;

        const itemsRows = (selectedOrder.items || []).map(item => [
            (item.quantity || 0).toString(),
            item.product?.name || 'Producto',
            `${((item.product?.price || 0) * (item.quantity || 0)).toFixed(2)}`
        ]);

        autoTable(doc, {
            head: [['Cant', 'Producto', 'Total']],
            body: itemsRows,
            startY: currentY,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 1 },
            headStyles: { textColor: [100, 100, 100], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 38 },
                2: { cellWidth: 20, halign: 'right' }
            },
            margin: { left: 5, right: 5 }
        });

        const finalY = doc.lastAutoTable.finalY + 5;
        doc.line(5, finalY, 75, finalY);

        const total = parseFloat(selectedOrder.total) || 0;
        let yOffset = finalY + 5;

        if (isFactura && config.impuesto_porcentaje > 0) {
            const porcentaje = parseFloat(config.impuesto_porcentaje);
            const subtotal = total / (1 + (porcentaje / 100));
            const impuesto = total - subtotal;
            doc.setFontSize(8);
            doc.text("OP. GRAVADA:", 5, yOffset);
            doc.text(`${config.moneda} ${subtotal.toFixed(2)}`, 75, yOffset, { align: "right" });
            yOffset += 4;
            doc.text(`${config.impuesto_nombre} (${porcentaje}%):`, 5, yOffset);
            doc.text(`${config.moneda} ${impuesto.toFixed(2)}`, 75, yOffset, { align: "right" });
            yOffset += 4;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL PAGADO:", 5, yOffset + 2);
        doc.setTextColor(236, 72, 153);
        doc.text(`${config.moneda} ${total.toFixed(2)}`, 75, yOffset + 2, { align: "right" });

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "normal");
        doc.text(`Vendedor: ${selectedOrder.vendedor_nombre?.split(' ')[0] || 'Local'}`, 5, yOffset + 8);
        doc.text(`Pago: ${(selectedOrder.metodo_pago || '').toUpperCase()}`, 5, yOffset + 12);

        const splitMessage = doc.splitTextToSize(config.ticket_mensaje || 'Gracias', 70);
        doc.text(splitMessage, 40, yOffset + 20, { align: "center" });

        const fileName = `${isFactura ? 'Factura' : isBoleta ? 'Boleta' : 'Ticket'}_${selectedOrder.ticket}.pdf`;

        // LÓGICA NATIVA
        const savedNatively = await saveFileNatively(doc.output('arraybuffer'), fileName, 'pdf');
        if (!savedNatively) {
            doc.save(fileName);
        }
    } catch (error) {
        console.error("Error al generar PDF Individual:", error);
        uiManager.notify("Hubo un problema al generar el comprobante.", "error");
    }
};

// -------------------------------------------------------------
// 3. IMPRESIÓN DIRECTA TÉRMICA (Ventana Print 80mm - VERSIÓN PRO)
// -------------------------------------------------------------
export const printThermalTicket = async (selectedOrder) => {
    if (!selectedOrder) return;

    const config = await getConfig();
    const isFactura = selectedOrder.direccion?.includes("FACTURA");
    const isBoleta = selectedOrder.direccion?.includes("BOLETA");
    let tipoDocumentoStr = "TICKET DE VENTA";
    if (isFactura) tipoDocumentoStr = "FACTURA ELECTRÓNICA";
    if (isBoleta) tipoDocumentoStr = "BOLETA ELECTRÓNICA";

    const total = parseFloat(selectedOrder.total) || 0;
    const itemsHtml = (selectedOrder.items || []).map(item => `
        <tr>
            <td style="padding: 2px 0;">${item.quantity}</td>
            <td style="padding: 2px 0;">${item.product?.name || 'Producto'}</td>
            <td style="padding: 2px 0; text-align: right;">${((item.product?.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
        </tr>
    `).join('');

    let desgloseImpuestosHtml = '';
    if (isFactura && config.impuesto_porcentaje > 0) {
        const porcentaje = parseFloat(config.impuesto_porcentaje);
        const subtotal = total / (1 + (porcentaje / 100));
        const impuesto = total - subtotal;
        desgloseImpuestosHtml = `
            <table style="font-size: 12px; width: 100%;">
                <tr><td>OP. GRAVADA:</td><td style="text-align: right;">${config.moneda} ${subtotal.toFixed(2)}</td></tr>
                <tr><td>${config.impuesto_nombre} (${porcentaje}%):</td><td style="text-align: right;">${config.moneda} ${impuesto.toFixed(2)}</td></tr>
            </table>
        `;
    }

    const htmlContent = `
        <div style="font-family: 'Courier New', Courier, monospace; width: 78mm; margin: 0 auto; font-size: 12px; color: black; padding: 5px;">
            <div style="text-align: center; font-weight: bold; font-size: 16px;">${config.empresa_nombre.toUpperCase()}</div>
            <div style="text-align: center;">${config.empresa_direccion || ''}</div>
            <div style="text-align: center;">RUC: ${config.empresa_ruc || '-'}</div>
            <div style="text-align: center;">Cel: ${config.empresa_telefono || '-'}</div>
            <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
            <div style="text-align: center; font-weight: bold;">${tipoDocumentoStr}</div>
            <div style="text-align: center; font-weight: bold;">N°: ${selectedOrder.ticket || 'S/N'}</div>
            <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
            <div><strong>Fecha:</strong> ${new Date(selectedOrder.created_at).toLocaleString('es-PE')}</div>
            <div><strong>Cliente:</strong> ${selectedOrder.cliente_nombre || 'Público General'}</div>
            ${selectedOrder.cliente_dni_ruc ? `<div><strong>Doc:</strong> ${selectedOrder.cliente_dni_ruc}</div>` : ''}
            <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
            <table style="width: 100%; font-size: 12px;">
                <thead style="border-bottom: 1px solid black;">
                    <tr><th style="text-align: left;">Cant</th><th style="text-align: left;">Producto</th><th style="text-align: right;">Total</th></tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
            ${desgloseImpuestosHtml}
            <table style="width: 100%; font-size: 14px; font-weight: bold;">
                <tr><td>TOTAL:</td><td style="text-align: right;">${config.moneda} ${total.toFixed(2)}</td></tr>
            </table>
            <div style="margin-top: 5px;"><strong>Pago:</strong> ${(selectedOrder.metodo_pago || '').toUpperCase()}</div>
            <div style="border-bottom: 1px dashed black; margin: 5px 0;"></div>
            <div style="text-align: center; margin-top: 10px;">${config.ticket_mensaje}</div>
        </div>
    `;

    // --- SOLUCIÓN DE INYECCIÓN DIRECTA PARA TAURI ---
    // Creamos un contenedor oculto para el contenido de impresión
    let printContainer = document.getElementById('print-container');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'print-container';
        document.body.appendChild(printContainer);
    }

    // Estilos para que en pantalla NO se vea, pero al imprimir SÍ
    const style = document.createElement('style');
    style.innerHTML = `
        @media screen { #print-container { display: none; } }
        @media print {
            body > * { display: none !important; }
            #print-container { display: block !important; width: 100%; }
            @page { size: 80mm auto; margin: 0; }
        }
    `;
    document.head.appendChild(style);

    printContainer.innerHTML = htmlContent;

    // Disparamos la impresión nativa
    setTimeout(() => {
        window.print();
        // Limpiamos después de imprimir
        printContainer.innerHTML = '';
        style.remove();
    }, 250);
};