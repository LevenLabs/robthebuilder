var http = require('http'),
    urlClass = require('url'),
    RPCLib = require('rpclib'),
    SkyProvider = require('skyprovider'),
    SkyRPCClient = require('skyrpcclient'),
    Log = require('modulelog')('robthebuilder'),
    bufferConcatLimit = require('buffer-concat-limit'),
    portscanner = require('portscanner'),
    skyClient;

function Server(server) {
    var rpc = new RPCLib();
    rpc.setConfigValue('server', this);
    this.rpc = rpc;
    this.port = 0;
    this.server = server || http.createServer();
    this.server.on('message', function(message, response) {
        rpc.handleRequest(message, response);
    });
    this.server.on('request', function(request, response) {
        // disable keep-alive connections until https://github.com/nodejs/node/issues/6795
        // is fixed
        response.setHeader('Connection', 'close');
        var message = null;
        request.on('data', function(body) {
            if (message === null) {
                message = body;
            } else {
                message = bufferConcatLimit(message, body, 0);
            }
        });
        //when we've received ALL the data a FIN is sent (triggering end)
        request.on('end', function() {
            //literally nothing was sent?
            if (message === null) {
                response.writeHead(400);
                response.end();
                return;
            }
            rpc.handleRequest(message.toString(), response);
        });
    });
}

function listen(server, port, cb) {
    server.listen(port, function() {
        Log.info('RPC server listening', {port: port});
        cb(port);
    });
}

Server.prototype.start = function(port) {
    var server = this.server;
    return new Promise(function(resolve, reject) {
        if (port) {
            this.port = port;
            listen(server, port, resolve);
            return;
        }
        Log.debug('searching for an open port between 8000-9999');
        portscanner.findAPortNotInUse(8000, 9999, '127.0.0.1', function(error, port) {
            if (error) {
                reject(error);
                return;
            }
            this.port = port;
            listen(server, port, resolve);
        }.bind(this));
    }.bind(this));
};

Server.prototype.setSkyAPIEndpoint = function(endpoint) {
    var url = urlClass.parse(endpoint);
    if (!url.slashes || !url.protocol) { // no protocol was found
        url = urlClass.parse('ws://' + endpoint);
    }
    // if you just pass `skyapi` to parse() it fills in the pathname but not
    // the host
    if (!url.host && url.pathname) {
        url.host = url.pathname;
        url.pathname = '/provide';
    }
    skyClient = new SkyProvider(urlClass.format(url));
};

Server.prototype.provide = function(name, pri) {
    if (!skyClient) {
        throw new Error('You must call setSkyAPIEndpoint before calling provide');
    }
    if (!this.port) {
        throw new Error('No port, you must call start before calling provide');
    }
    var priority = pri || 5;
    Log.info('calling provideService', {name: name, port: this.port, priority: priority});
    skyClient.provideService(name, this.port, {priority: priority});
};

Server.prototype.stop = function(cb) {
    this.server.close(cb);
};

Server.prototype.getRPCClient = function(host) {
    return new SkyRPCClient(host);
}

module.exports = Server;
