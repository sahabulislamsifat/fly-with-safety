'use strict';
async function closeFrontend(server, app, log = () => {}, budget = 10000) {
  log('shutdown-started');
  let timer;
  const httpClosed = new Promise((resolve, reject) => server.close(error => {
    if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') { reject(Error('HTTP_CLOSE_FAILED')); return; }
    log('http-closed'); resolve();
  }));
  // Start Next cleanup before waiting on HTTP close: it owns HMR/upgraded sockets.
  const nextClosed = Promise.resolve().then(() => app.close()).then(() => log('next-closed'), () => { throw Error('NEXT_CLOSE_FAILED'); });
  server.closeAllConnections();
  try { await Promise.race([Promise.all([httpClosed, nextClosed]), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('FRONTEND_DRAIN_TIMEOUT')), budget); })]); }
  finally { clearTimeout(timer); }
}
module.exports = { closeFrontend };
