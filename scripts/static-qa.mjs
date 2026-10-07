// Test-only static fixture. Not part of the deployed app; no API routes.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function openStaticSite() {
  const root=fileURLToPath(new URL('../',import.meta.url));
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/test-repo/')){res.writeHead(404).end();return;}
    let path=decodeURIComponent(url.pathname.slice('/test-repo/'.length));
    if(!path)path='index.html';
    const file=resolve(root,path);
    if(!file.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
    try{
      const body=await readFile(file);
      const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(file)] || 'application/octet-stream';
      res.writeHead(200,{'Content-Type':type});res.end(body);
    }catch{res.writeHead(404).end();}
  });
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  return {base:`http://127.0.0.1:${server.address().port}/test-repo/`,close:()=>new Promise((resolve)=>{server.closeAllConnections();server.close(resolve);})};
}
