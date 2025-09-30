module.exports = {
  apps: [{
    name: 'cooperative-banking-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Process management
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Memory management
    max_memory_restart: '1G',
    
    // Monitoring
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    
    // Advanced features
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Health monitoring
    health_check_grace_period: 3000,
    
    // Environment specific settings
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      instances: 4,
      max_memory_restart: '2G'
    }
  }],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/cooperative-banking-backend.git',
      path: '/var/www/cooperative-banking',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
