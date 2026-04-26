const appOptions = {
  agentId: 'test',
  serverName: 'MyServer',
  transporters: {
    default: {
      type: 'http',
      options: {
        puller: {
          url: 'http://localhost:8111/puller',
          intervalSeconds: 5,
        },
        pusher: {
          url: 'http://localhost:8111/pusher',
        },
      },
    },
  },
};

const generateConnectionString = (options) => {
  const jsonString = JSON.stringify(options);
  // encode to base64
  return Buffer.from(jsonString).toString('base64url');
};

const connectionString = generateConnectionString(appOptions);

console.log('Connection String:');
console.log(connectionString);
