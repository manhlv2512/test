// PM2 process configuration for running the API directly on a host
// (SIT / UAT / STG / LIVE) without Docker.
//
// Deploy steps on the host:
//   1) Copy these files to the host:  dist/server.js, .env, ecosystem.config.js
//   2) Ensure Node is installed:      node -v
//   3) Install PM2 once (global):     npm i -g pm2   (or: yarn global add pm2)
//   4) Start:                         pm2 start ecosystem.config.js --env production
//   5) Persist across reboots:        pm2 save && pm2 startup   (follow printed cmd)
//
// Handy commands:
//   pm2 status                # list processes
//   pm2 logs node-shell-api   # tail logs
//   pm2 monit                 # live dashboard (CPU/mem)
//   pm2 reload node-shell-api # zero-downtime reload
//   pm2 restart node-shell-api
//   pm2 stop node-shell-api

module.exports = {
  apps: [
    {
      name: "node-shell-api",
      // Single-file bundle produced by `yarn build`.
      script: "dist/server.js",

      // This API mostly waits on child processes (ssh/bash), so a single
      // instance is enough. Do NOT use cluster mode here: the executor spawns
      // OS processes and there is no benefit to multiple Node workers.
      instances: 1,
      exec_mode: "fork",

      // Restart policy.
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      // Restart if memory grows beyond this (safety net).
      max_memory_restart: "300M",

      // Give the app time to finish in-flight executions on stop/reload.
      kill_timeout: 10000,
      wait_ready: false,

      // Load environment from the .env file via dotenv-style vars below.
      // PM2 does not read .env automatically; we mirror the important ones
      // here and/or rely on the shell exporting them. Prefer setting real
      // values in the `env`/`env_production` blocks or export before start.
      env: {
        NODE_ENV: "development",
        EXEC_MODE: "local",
        PORT: "3000",
      },
      env_production: {
        NODE_ENV: "production",
        // Override the rest via the host's real .env / exported vars.
        // Example values (fill in per environment):
        // EXEC_MODE: "ssh",
        // PORT: "3000",
        // API_KEY: "...",
        // SSH_HOST: "appuser@live-host.internal",
        // SSH_JUMP: "jumpuser@bastion-live.internal",
        // SSH_KEY: "/home/appuser/.ssh/id_rsa",
        // SSH_REMOTE_COMMAND: "cd /opt/app && ./admin.sh -f /local/install.py {{ARGS}}",
      },

      // Logs (PM2 also aggregates via `pm2 logs`).
      output: "logs/pm2-out.log",
      error: "logs/pm2-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
