// PM2 ecosystem configuration for Skillswap Backend
// https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [{
    name: 'skillswap-be',
    script: 'index.js',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster', // Enable cluster mode for better performance
    env: {
      NODE_ENV: 'development',
      PORT: process.env.PORT || 5000,
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      FRONTEND_URL: process.env.FRONTEND_URL || 'https://yourdomain.com'
    }
  }],

  // Optional: Deployment configuration
  deploy: {
    production: {
      user: 'your-deploy-user',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:adithyan-sajan/skillswapBE.git',
      path: '/var/www/skillswap-be',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};