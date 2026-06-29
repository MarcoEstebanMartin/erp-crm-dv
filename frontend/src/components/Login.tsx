import React, { useState, useEffect } from 'react';
import { api, setSimulationMode, testServerConnection } from '../utils/api';
import { Shield, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulation, setSimulation] = useState(true);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Verificar estado del servidor backend al montar
  useEffect(() => {
    async function checkServer() {
      const isOnline = await testServerConnection();
      setServerOnline(isOnline);
      
      const savedMode = localStorage.getItem('simulation_mode');
      if (savedMode === 'false' && isOnline) {
        setSimulation(false);
        setSimulationMode(false);
      } else {
        // Por defecto o si el servidor está caído, forzamos modo simulación para ingreso local instantáneo
        setSimulation(true);
        setSimulationMode(true);
      }
    }
    checkServer();
  }, []);

  const handleToggleSimulation = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSimulation(checked);
    setSimulationMode(checked);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.login(username, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout-auth">
      <div className="card auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          {!logoFailed ? (
            <img 
              src="/logo.png" 
              alt="Logo DV" 
              style={{ height: '60px', objectFit: 'contain', marginBottom: '8px' }}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div style={{
              background: 'var(--text-primary)',
              color: '#fff',
              padding: '12px',
              borderRadius: '50%',
              display: 'inline-flex'
            }}>
              <Shield size={28} />
            </div>
          )}
        </div>
        
        <h2 style={{ fontSize: '1.45rem', marginBottom: '4px' }}>ERP-CRM Mayorista</h2>
        <p style={{ fontSize: '0.85rem', marginBottom: '28px' }}>Ingresá tus credenciales de acceso</p>

        {error && (
          <div style={{
            backgroundColor: 'var(--accent-bg-light)',
            color: 'var(--accent-color)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            textAlign: 'left',
            marginBottom: '20px',
            border: '1px solid rgba(227, 6, 19, 0.15)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              className="input"
              placeholder="ej: admin, vendedor, deposito"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ textAlign: 'left', position: 'relative' }}>
            <label htmlFor="password">Contraseña</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ margin: '20px 0 24px 0', alignItems: 'flex-start' }}>
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={simulation}
                onChange={handleToggleSimulation}
                style={{ cursor: 'pointer' }}
              />
              <span>Modo Simulación (Sin Servidor)</span>
            </label>
            {serverOnline === false && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', textAlign: 'left' }}>
                ℹ️ Servidor desconectado. Modo simulación obligatorio.
              </span>
            )}
            {serverOnline === true && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '4px', textAlign: 'left' }}>
                🟢 Servidor local en línea detectado.
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px' }}
            disabled={loading}
          >
            {loading ? 'Accediendo...' : 'Iniciar sesión'}
          </button>
        </form>

        <div style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <p>Credenciales de prueba:</p>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '6px' }}>
            <span><strong>Admin</strong>: admin / admin123</span>
            <span><strong>Vendedor</strong>: diego / diego123</span>
            <span><strong>Depósito</strong>: miguel / miguel123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
