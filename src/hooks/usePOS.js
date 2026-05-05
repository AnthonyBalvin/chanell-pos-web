import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import gsap from 'gsap';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { uiManager } from '../context/UIContext';

export function usePOS(cartRef) {
    const { user } = useAuth();

    const [turnoActivo, setTurnoActivo] = useState(null);
    const [loadingTurno, setLoadingTurno] = useState(true);
    const [cierreStats, setCierreStats] = useState({ ventas: 0, gastos: 0, esperado: 0 });

    const [filteredProductos, setFilteredProductos] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [categories, setCategories] = useState(['Todos']);

    // --- ESTADOS DE PAGINACIÓN ---
    const [currentPage, setCurrentPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 12; // Perfecto para grillas de 2, 3 o 4 columnas

    const [cart, setCart] = useState([]);
    const [clienteNombre, setClienteNombre] = useState('');
    const [clienteDni, setClienteDni] = useState('');
    const [clienteEncontrado, setClienteEncontrado] = useState(false);
    const [metodoPago, setMetodoPago] = useState('efectivo');
    const [tipoComprobante, setTipoComprobante] = useState('ticket');
    const [isProcessing, setIsProcessing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('online');

    const totalCart = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const [configuracionGlobal, setConfiguracionGlobal] = useState({ impuesto_porcentaje: 18 });

    const impuestoPorcentaje = configuracionGlobal?.impuesto_porcentaje || 18;
    const tasaDecimal = impuestoPorcentaje / 100;
    const subtotalCart = Math.round((totalCart / (1 + tasaDecimal)) * 100) / 100;
    const igvCart = Number((totalCart - subtotalCart).toFixed(2));

    useEffect(() => {
        const checkTurno = async () => {
            if (!user) return;
            const { data } = await supabase.from('turnos_caja').select('*').eq('usuario_id', user.id).eq('estado', 'abierto').single();
            if (data) setTurnoActivo(data);
            setLoadingTurno(false);
        };
        checkTurno();
        fetchConfiguracion();
        fetchCategoriasEstaticas();
    }, [user]);

    const fetchConfiguracion = async () => {
        if (!navigator.onLine) return;
        const { data } = await supabase.from('configuracion').select('impuesto_porcentaje').eq('id', 1).single();
        if (data) setConfiguracionGlobal(data);
    };

    const fetchCategoriasEstaticas = async () => {
        const { data } = await supabase.from('productos').select('category');
        if (data) {
            const uniqueCats = ['Todos', ...new Set(data.map(p => p.category).filter(Boolean))];
            setCategories(uniqueCats);
        }
    };

    // --- EFECTO DE BÚSQUEDA Y PAGINACIÓN ---
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProductos();
        }, 300); // Debounce para no saturar BD
        return () => clearTimeout(timer);
    }, [currentPage, searchTerm, selectedCategory]);

    const fetchProductos = async () => {
        setLoadingProducts(true);
        const from = currentPage * itemsPerPage;
        const to = from + itemsPerPage - 1;

        if (!navigator.onLine) {
            const localProducts = await db.catalog.toArray();
            let filtered = localProducts;
            if (selectedCategory !== 'Todos') filtered = filtered.filter(p => p.category === selectedCategory);
            if (searchTerm) {
                const lowerSearch = searchTerm.toLowerCase();
                filtered = filtered.filter(p => p.name.toLowerCase().includes(lowerSearch) || (p.barcode && p.barcode.toLowerCase() === lowerSearch));
            }
            setTotalCount(filtered.length);
            setFilteredProductos(filtered.slice(from, to + 1));
            setLoadingProducts(false);
            return;
        }

        let query = supabase.from('productos').select('*', { count: 'exact' }).order('name', { ascending: true });

        if (selectedCategory !== 'Todos') query = query.eq('category', selectedCategory);
        if (searchTerm) query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`);

        const { data, count, error } = await query.range(from, to);

        if (!error && data) {
            setFilteredProductos(data);
            setTotalCount(count || 0);
            await db.catalog.bulkPut(data); // Actualizar caché local
        }
        setLoadingProducts(false);
    };

    // --- LECTURA DE PISTOLA DE BARRAS ULTRA RÁPIDA ---
    const handleSearchKeyDown = async (e) => {
        if (e.key === 'Enter' && searchTerm) {
            e.preventDefault();
            const { data } = await supabase.from('productos').select('*').eq('barcode', searchTerm).single();
            if (data && data.stock > 0) {
                addToCart(data);
                setSearchTerm('');
            } else if (data && data.stock <= 0) {
                uiManager.notify("Producto sin stock.", "warning");
            }
        }
    };

    const processSyncQueue = async () => {
        if (!navigator.onLine) { setSyncStatus('offline'); return; }
        const pendingSales = await db.sync_queue.where('status').equals('pending').toArray();
        if (pendingSales.length === 0) { setSyncStatus('online'); return; }

        setSyncStatus('syncing');
        for (const sale of pendingSales) {
            try {
                const { error } = await supabase.rpc('procesar_venta_segura', { payload: sale.payload });
                if (!error) {
                    await db.sync_queue.delete(sale.idempotency_key);
                } else {
                    if (error.message && (error.message.toLowerCase().includes('insuficiente') || error.code === 'P0001')) {
                        await db.sync_queue.update(sale.idempotency_key, { status: 'error', errorMessage: 'Stock insuficiente en la nube.' });
                    } else if (error.message && (error.message.includes('Idempotencia') || error.message.includes('duplicate') || error.message.includes('ya existe'))) {
                        await db.sync_queue.delete(sale.idempotency_key);
                    }
                }
            } catch (err) { console.error("Error sincronizando", err); }
        }
        setSyncStatus('online');
        fetchProductos();
    };

    useEffect(() => {
        const handleOnline = () => processSyncQueue();
        const handleOffline = () => setSyncStatus('offline');
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        if (navigator.onLine) processSyncQueue(); else setSyncStatus('offline');
        return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
    }, []);

    useEffect(() => {
        const buscarCliente = async () => {
            if (clienteDni.length === 8 || clienteDni.length === 11) {
                const { data, error } = await supabase.from('clientes').select('nombre').eq('dni_ruc', clienteDni).single();
                if (data && !error) {
                    setClienteNombre(data.nombre);
                    setClienteEncontrado(true);
                    gsap.fromTo(".dni-icon", { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 });
                } else setClienteEncontrado(false);
            } else setClienteEncontrado(false);
        };
        const timeoutId = setTimeout(buscarCliente, 500);
        return () => clearTimeout(timeoutId);
    }, [clienteDni]);

    const abrirCaja = async (monto) => {
        const { data, error } = await supabase.from('turnos_caja').insert([{
            usuario_id: user.id, usuario_nombre: user?.user_metadata?.full_name || user?.email,
            monto_apertura: monto, estado: 'abierto'
        }]).select().single();
        if (error) throw error;
        setTurnoActivo(data);
    };

    const calcularCierre = async () => { };

    const cerrarCaja = async (declarado) => {
        const { error } = await supabase.rpc('cerrar_caja_segura', { p_turno_id: turnoActivo.id, p_declarado: declarado });
        if (error) throw new Error(error.message);
        setTurnoActivo(null);
    };

    const registrarGasto = async (desc, monto) => {
        const { error } = await supabase.from('gastos_caja').insert([{ turno_id: turnoActivo.id, descripcion: desc, monto: monto }]);
        if (error) throw error;
    };

    const addToCart = (product) => {
        if (product.stock <= 0) return;
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.product.id === product.id);
            if (existingItem) {
                if (existingItem.quantity < product.stock) return prevCart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                return prevCart;
            }
            return [...prevCart, { product, quantity: 1 }];
        });
        if (cartRef?.current) gsap.fromTo(cartRef.current, { scale: 1.02 }, { scale: 1, duration: 0.2 });
    };

    const removeFromCart = (productId) => setCart(prevCart => prevCart.filter(item => item.product.id !== productId));

    const updateQuantity = (productId, newQuantityStr, maxStock) => {
        let newQuantity = parseInt(newQuantityStr, 10);
        if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;
        if (newQuantity > maxStock) { newQuantity = maxStock; uiManager.notify(`Stock máximo: ${maxStock} u.`, "warning"); }
        setCart(prevCart => prevCart.map(item => item.product.id === productId ? { ...item, quantity: newQuantity } : item));
    };

    const clearCart = async () => {
        if (cart.length === 0 && !clienteDni) return;
        const isConfirmed = await uiManager.confirm("Vaciar Carrito", "¿Vaciar carrito y cancelar la venta actual?", true);
        if (isConfirmed) {
            setCart([]); setClienteNombre(''); setClienteDni(''); setClienteEncontrado(false); setTipoComprobante('ticket');
        }
    };

    const handleCheckout = async () => {
        if (!turnoActivo) return uiManager.notify("Error crítico: No tienes una caja abierta.", "error");
        if (cart.length === 0) return uiManager.notify("El carrito está vacío", "warning");
        if (tipoComprobante === 'factura' && (!clienteDni || clienteDni.length !== 11 || !clienteNombre || clienteNombre === 'Cliente Público')) {
            return uiManager.notify("Para Factura, ingresa RUC (11 dígitos) y Razón Social.", "warning");
        }
        if (tipoComprobante === 'boleta' && clienteDni && clienteDni.length !== 8) return uiManager.notify("DNI para Boleta debe tener 8 dígitos.", "warning");

        setIsProcessing(true);
        try {
            const ticketNumber = `CT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const nombreUsuario = user?.user_metadata?.full_name || user?.email || 'Vendedor POS';
            const idempotencyKey = uuidv4();

            const payloadTransaccion = {
                idempotency_key: idempotencyKey,
                ticket: ticketNumber,
                cliente_nombre: clienteNombre || 'Cliente Público',
                cliente_dni: clienteDni || null,
                metodo_entrega: 'pickup',
                metodo_pago: metodoPago,
                estado: 'vendido',
                total: Number(totalCart.toFixed(2)),
                subtotal: subtotalCart,
                igv: igvCart,
                tipo_comprobante: tipoComprobante.toUpperCase(),
                ruc_cliente: tipoComprobante === 'factura' ? clienteDni : null,
                razon_social: tipoComprobante === 'factura' ? clienteNombre : null,
                items: cart,
                direccion: `Comprobante Solicitado: ${tipoComprobante.toUpperCase()}`,
                vendedor_id: user?.id,
                vendedor_nombre: nombreUsuario,
                turno_id: turnoActivo.id,
                motivo_kardex: `Venta POS #${ticketNumber} (${tipoComprobante.toUpperCase()})`
            };

            if (navigator.onLine) {
                const { error: rpcError } = await supabase.rpc('procesar_venta_segura', { payload: payloadTransaccion });
                if (rpcError) throw new Error(rpcError.message || "Transacción rechazada por seguridad.");
                uiManager.notify(`Venta exitosa: #${ticketNumber}`, "success");
            } else {
                await db.sync_queue.add({ idempotency_key: idempotencyKey, payload: payloadTransaccion, status: 'pending', created_at: new Date().toISOString() });
                uiManager.notify(`[MODO OFFLINE] Venta guardada: #${ticketNumber}`, "info");
            }

            setCart([]); setClienteNombre(''); setClienteDni(''); setClienteEncontrado(false); setTipoComprobante('ticket');
            fetchProductos();

        } catch (error) {
            uiManager.notify("Operación cancelada: " + error.message, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        turnoActivo, loadingTurno, abrirCaja, calcularCierre, cerrarCaja, registrarGasto, cierreStats,
        filteredProductos, loadingProducts, searchTerm, setSearchTerm, handleSearchKeyDown, selectedCategory, setSelectedCategory, categories,
        currentPage, setCurrentPage, totalCount, totalPages: Math.ceil(totalCount / itemsPerPage), // Paginación exportada
        cart, addToCart, removeFromCart, updateQuantity, clearCart, totalCart,
        clienteNombre, setClienteNombre, clienteDni, setClienteDni, clienteEncontrado,
        metodoPago, setMetodoPago, tipoComprobante, setTipoComprobante,
        handleCheckout, isProcessing, syncStatus, configuracionGlobal,
        impuestoPorcentaje, subtotalCart, igvCart
    };
}