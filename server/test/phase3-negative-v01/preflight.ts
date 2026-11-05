// Reuse the exact helper verified against PostgreSQL by the separately approved
// read-only execution. Do not copy/reintroduce the uncast catalog projection.
export {assertLocalURL,preflight,preserve} from '../phase3-db-preflight-v02.js';
