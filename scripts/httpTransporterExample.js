/**
 * This is an example of a simple HTTP server that can be used to test the HTTP transporter.
 * It listens on port 8111 and has two endpoints:
 * - /pusher: POST endpoint that receives data from the control instance
 * - /puller: GET endpoint that sends data to the control instance
 * run: node ./httpTransporterExample.js
 */
const http = require('http');

const host = 'localhost';
const port = 8111;
const yourInstanceSessionId = 'ZFmuqesHOlp6ZOuNWypomJjS0ZuDY0';

const requestListener = function (req, res) {
  console.log(`Received request for ${req.url}`);
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  resData = { success: false };
  if (req.url === '/pusher' && req.method === 'POST') {
    request.on('data', function (chunk) {
      console.log('Received body data:');
      console.log(chunk.toString());
    });
    resData = { success: true };
  } else if (req.url === '/puller' && req.method === 'GET') {
    resData = {
      controlInstance: {
        sessionId: yourInstanceSessionId,
        instructions: [
          {
            command: 'browserEval',
            args: ["console.info('hello there')"],
          },
        ],
      },
    };
  }
  res.end(JSON.stringify(resData));
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});
