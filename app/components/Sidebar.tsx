'use client'

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const menuItems = [
        { name: 'Dashboard', href: '/dashboard', icon: '📊' },
        { name: 'Mis Rutinas', href: '/rutinas', icon: '🏋️' },
        { name: 'Progreso', href: '/progreso', icon: '📈' },
        { name: 'Mensajes', href: '/mensajes', icon: '💬' },
        { name: 'Mi Perfil', href: '/perfil', icon: '👤' },
    ];

    return (
        <aside className={`kr-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Header del Sidebar */}
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <Image src="/kairos-title.png" alt="Logo" width={40} height={40} />
                    {!isCollapsed && <span className="brand-name">Kairós</span>}
                </div>
                <button 
                    className="toggle-btn" 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? '→' : '←'}
                </button>
            </div>

            {/* Navegación */}
            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link 
                            key={item.href} 
                            href={item.href}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {!isCollapsed && <span className="nav-label">{item.name}</span>}
                            {isActive && <div className="active-indicator" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / Logout */}
            <div className="sidebar-footer">
                <button className="nav-item logout-btn">
                    <span className="nav-icon">🚪</span>
                    {!isCollapsed && <span className="nav-label">Cerrar Sesión</span>}
                </button>
            </div>
        </aside>
    );
}