export const pinoTransport = {
  targets: [
    {
      level: 'info',
      target: 'pino/file',
      options: {
        mkdir: true,
        destination: './logs/info.log',
      },
    },
    {
      level: 'error',
      target: 'pino/file',
      options: {
        mkdir: true,
        destination: './logs/error.log',
      },
    },
    {
      level: 'info',
      target: 'pino-pretty',
      options: {
        colorize: true,
        levelFirst: true,
        translateTime: "yyyy-dd-mm'T'hh:MM:ss.lo",
        singleLine: true,
        ignore: 'pid,hostname',
      },
    },
  ],
};
