'use strict';require('node:net').Socket.prototype.connect=function(){throw Error('OFFLINE_NETWORK_FORBIDDEN')};globalThis.fetch=function(){throw Error('OFFLINE_NETWORK_FORBIDDEN')};
