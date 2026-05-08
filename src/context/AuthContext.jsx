import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { uiManager } from '../context/UIContext';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    const isKickingRef = useRef(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                verificarAcceso(session.user);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                verificarAcceso(session.user);
            } else {
                setUser(null);
                setRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const verificarAcceso = async (authUser) => {
        const { data, error } = await supabase
            .from('perfiles')
            .select('rol, estado')
            .eq('id', authUser.id)
            .single();

        if (data) {
            if (data.estado === 'inactivo') {
                // EL CANDADO SE REVISA Y SE CIERRA AQUÍ: 
                // Si otro hilo ya lanzó la notificación hace 1 milisegundo, los demás se cancelan.
                if (isKickingRef.current) return;
                isKickingRef.current = true;

                uiManager.notify("ACCESO DENEGADO: Tu cuenta ha sido suspendida. Contacta al administrador.", "error");

                await supabase.auth.signOut();
                setUser(null);
                setRole(null);

                setTimeout(() => { isKickingRef.current = false; }, 2000);
            } else {
                setUser(authUser);
                setRole(data.rol);
                isKickingRef.current = false;
            }
        } else {
            console.error("Error obteniendo perfil:", error);
            setUser(authUser);
        }

        setLoading(false);
    };

    return (
        <AuthContext.Provider value={{ user, role, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);