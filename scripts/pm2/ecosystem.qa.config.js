module.exports = {
  apps: [
    {
      name: "api-linux",
      cwd: "/home/ubuntu/manustienda/build",
      script: "./api-linux",
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      out_file: "/home/ubuntu/manustienda/logs/api-linux/out.log",
      error_file: "/home/ubuntu/manustienda/logs/api-linux/error.log",
      merge_logs: false,
      env: {
        NODE_ENV: "qa",
        PORT: "4020",
        "CORS_ORIGINS": "https://www.apptiendamanus.space,http://localhost:3000"
      },
    },
    {
      name: "backend-reporteria-linux",
      cwd: "/home/ubuntu/manustienda/build-reporteria",
      script: "./backend-reporteria-linux",
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      out_file: "/home/ubuntu/manustienda/logs/backend-reporteria-linux/out.log",
      error_file: "/home/ubuntu/manustienda/logs/backend-reporteria-linux/error.log",
      merge_logs: false,
      env: {
        NODE_ENV: "qa",
        PORT: "4021",
      },
    },
    {
      name: "backend-facturacion-electronica-linux",
      cwd: "/home/ubuntu/manustienda/build-facturacion-electronica",
      script: "./backend-facturacion-electronica-linux",
      interpreter: "none",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      out_file: "/home/ubuntu/manustienda/logs/backend-facturacion-electronica-linux/out.log",
      error_file: "/home/ubuntu/manustienda/logs/backend-facturacion-electronica-linux/error.log",
      merge_logs: false,
      env: {
        NODE_ENV: "qa",
        PORT: "4022",
      },
    }
  ],
};
