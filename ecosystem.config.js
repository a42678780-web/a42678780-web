module.exports = {
  apps: [{
    name: "539-analysis",
    script: "./src/server.js",
    instances: "max",
    exec_mode: "cluster",
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 80,
      DATA_DIR: "/app/data"
    }
  }]
}
