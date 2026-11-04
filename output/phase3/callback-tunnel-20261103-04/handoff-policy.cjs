'use strict';
function canRestore({ originalStopped, proofStarted, proofExited, tunnelAbsent, result }) {
  if (!originalStopped || !tunnelAbsent) return false;
  if (!proofStarted) return true;
  return proofExited === true && (!result || result.tunnelStopped === true && result.listenerStopped === true);
}
module.exports = { canRestore };
