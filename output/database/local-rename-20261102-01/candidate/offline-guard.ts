import {Client} from 'pg';
Client.prototype.connect = function () { throw new Error('OFFLINE_DATABASE_CONNECTION_FORBIDDEN'); } as typeof Client.prototype.connect;
