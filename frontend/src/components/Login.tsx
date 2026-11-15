import React, { useState, useEffect } from 'react';
import { api, testServerConnection } from '../utils/api';
import { Shield, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
  onOpenStore?: () => void;
}

export default function Login({ onLoginSuccess, onOpenStore }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Verificar estado del servidor backend al montar
  useEffect(() => {
    async function checkServer() {
      const isOnline = await testServerConnection();
      setServerOnline(isOnline);
    }
    checkServer();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.login(cleanUsername, password);
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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
          {!logoFailed ? (
            <img
              src="/logo.png"
              alt="Logo DV"
              style={{ height: '60px', objectFit: 'contain' }}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div style={{
              background: 'var(--text-primary)',
              color: '#fff',
              padding: '12px',
              borderRadius: '50%',
              display: 'inline-flex',
            }}>
              <Shield size={28} />
            </div>
          )}
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--accent-bg-light)',
            color: 'var(--accent-color)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            textAlign: 'left',
            marginBottom: '20px',
            border: '1px solid rgba(227, 6, 19, 0.15)',
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
              name="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group" style={{ textAlign: 'left', position: 'relative' }}>
            <label htmlFor="password">Clave</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
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
                  padding: '4px',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {serverOnline === false && (
            <div style={{ marginTop: '14px', textAlign: 'left', fontSize: '0.82rem', color: '#E30613', fontWeight: 600 }}>
              Servidor sin conexión
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', marginTop: '20px' }}
            disabled={loading || serverOnline === false}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
