import http from 'node:http';
import { readFile } from 'node:fs/promises';
const page = await readFile(new URL('./fixtures/browser-smoke.html', import.meta.url));
http.createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(page);
}).listen(8877, '127.0.0.1', () => process.stdout.write('Fixture ready at http://127.0.0.1:8877\n'));
