var http = require('http'),
    Log = require('modulelog')('robthebuilder'),
    bufferConcatLimit = require('buffer-concat-limit'),
    portscanner = require('portscanner');

function Server(rpc, server) {
    this.server = server || http.createServer();
    this.server.on('message', function(message, response) {
        rpc.handleRequest(message, response);
    });
    this.server.on('request', function(request, response) {
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
        if (!port) {
            Log.debug('searching for an open port between 8000-9999');
            portscanner.findAPortNotInUse(8000, 9999, '127.0.0.1', function(error, port) {
                if (error) {
                    reject(error);
                    return;
                }
                listen(server, port, resolve);
            }.bind(this));
        } else {
            listen(server, port, resolve);
        }
    });
};

Server.prototype.stop = function(cb) {
    this.server.close(cb);
};

module.exports = Server;
