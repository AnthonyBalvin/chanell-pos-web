import { useEffect, useRef, useState } from 'react';
import { Asterisk, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { supabase } from '../lib/supabase';
import { useChanellUI } from '../context/UIContext';

export default function ResetPassword() {
    const { notify } = useChanellUI();
    const containerRef = useRef(null);
    const leftPanelRef = useRef(null);

    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Animación inicial igual a la del Login
    useEffect(() => {
        const tl = gsap.timeline();
        if (window.innerWidth >= 1024) {
            tl.fromTo(leftPanelRef.current,
                { opacity: 0, x: -50 },
                { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }
            );
        }
        tl.fromTo(containerRef.current,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
            "-=0.4"
        );
    }, []);

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);

        // 1. Actualizamos la contraseña
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            notify("Hubo un error al actualizar: " + error.message, "error");
            setLoading(false);
        } else {
            // 2. MAGIA AQUÍ: Cerramos la sesión automáticamente
            // Así obligamos al usuario a loguearse de verdad con su nueva clave
            await supabase.auth.signOut();

            setSuccess(true);
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white font-sans overflow-hidden">

            {/* PANEL IZQUIERDO AZUL */}
            <div ref={leftPanelRef} className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#1e2a4a] to-blue-900 flex-col justify-between p-16 relative shadow-2xl z-20">
                <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] border-[1px] border-white/30 rounded-full scale-[1.5] translate-x-1/4 translate-y-1/4"></div>
                    <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] border-[1px] border-white/30 rounded-full scale-[1.8] translate-x-1/3 translate-y-1/3"></div>
                </div>

                <div className="relative z-10 flex flex-col gap-8 mt-12">
                    <div className="text-white"><Asterisk size={64} strokeWidth={1.5} /></div>
                    <div className="space-y-4">
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mb-6 border border-white/20 shadow-xl">
                            <Lock size={32} />
                        </div>
                        <h1 className="text-white text-5xl xl:text-6xl font-bold leading-tight tracking-tight">
                            Paso Final.
                        </h1>
                        <p className="text-blue-100/80 text-lg max-w-md leading-relaxed mt-4">
                            Estás a un paso de recuperar tu acceso. Por seguridad, te pediremos que inicies sesión nuevamente tras el cambio.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 text-blue-200/60 text-sm font-medium">
                    © {new Date().getFullYear()} Chanell Tecnología.
                </div>
            </div>

            {/* PANEL DERECHO BLANCO */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-16 lg:p-24 relative bg-white z-10">
                <div className="w-full max-w-md" ref={containerRef}>
                    <div className="mb-12">
                        <span className="font-extrabold tracking-tighter text-2xl text-gray-900">Chanell Tecnología</span>
                    </div>

                    {!success ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="mb-10">
                                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">Crea tu clave</h2>
                                <p className="text-gray-500 text-sm">Escribe una contraseña segura que puedas recordar fácilmente.</p>
                            </div>

                            <form onSubmit={handlePasswordUpdate} className="space-y-6">
                                <div className="space-y-1 relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-white border-b-2 border-gray-200 pl-4 pr-12 py-3.5 text-gray-900 text-sm font-medium focus:outline-none focus:border-gray-900 transition-all placeholder:text-gray-400"
                                        placeholder="Nueva contraseña (Mín. 6 caracteres)"
                                        required
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
                                        tabIndex="-1"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || newPassword.length < 6}
                                    className="w-full bg-[#111] text-white font-semibold py-4 rounded-xl flex items-center justify-center hover:bg-black transition-colors disabled:opacity-70 mt-6 shadow-lg shadow-black/10"
                                >
                                    {loading ? 'Actualizando...' : 'Guardar y Cerrar Sesión'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="text-center py-6 animate-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-lg">
                                <ShieldCheck size={32} />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-3">¡Todo listo!</h2>
                            <p className="text-gray-500 text-sm leading-relaxed mb-8">
                                Tu contraseña ha sido actualizada con éxito y hemos cerrado tu sesión por seguridad.
                            </p>

                            <a
                                href="/login"
                                className="inline-flex items-center justify-center w-full gap-2 bg-[#111] text-white py-4 rounded-xl text-sm font-bold shadow-lg shadow-black/10 hover:bg-black transition-colors"
                            >
                                Volver a Iniciar Sesión <ArrowRight size={16} />
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}