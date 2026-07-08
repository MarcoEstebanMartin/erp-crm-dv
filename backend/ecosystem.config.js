module.exports = {
  apps: [
    {
      name: 'erp-crm-backend',
      script: 'dist/index.js',
      instances: 'max',       // Ejecutar en todos los cores de CPU disponibles
      exec_mode: 'cluster',    // Modo cluster para balanceo de carga
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Configuración de logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
      
      // Reinicios y resiliencia
      autorestart: true,
      max_memory_restart: '1G', // Reiniciar si una instancia excede 1GB de RAM
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 3000
    }
  ]
};
