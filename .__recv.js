const http = require('http');
const fs = require('fs');
const srv = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST') {
    const name = (req.url || '').indexOf('pristine') >= 0 ? '.__recovered_pristine.html' : '.__recovered_dom.html';
    const ws = fs.createWriteStream(name);
    req.pipe(ws);
    ws.on('finish', () => {
      const sz = fs.statSync(name).size;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('saved ' + name + ' bytes=' + sz);
      console.log('SAVED ' + name + ' bytes=' + sz);
    });
    ws.on('error', (e) => { res.writeHead(500); res.end('err'); console.error(e.message); });
    return;
  }
  res.writeHead(404); res.end();
});
srv.listen(9777, () => console.log('recv listening on 9777'));
