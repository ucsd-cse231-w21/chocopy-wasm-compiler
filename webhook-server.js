const http = require('http');
const child_process = require('child_process');

var fuzzProcess;
const hostname = "localhost"
const port = 11500;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Success');
  fuzzProcess.killSignal();
  exec("git pull origin main");
  fizzProcess = child_process.exec("npm run fuzz");
});

fuzzProcess = child_process.exec("npm run fuzz");

server.listen(port, hostname, () => {
  console.log(`Server running at http:${hostname}:${port}`);
});
