var path = require('path'),
    flags = require('flags'),
    Log = require('modulelog')('robthebuilder'),
    Server = require('./lib/server.js'),
    compile = require('./lib/compile.js'),
    addMethods = require('./lib/addMethods.js'),
    currentDir = path.join(path.dirname(process.mainModule.filename)),
    myDir = path.join(path.dirname(module.filename)),
    templatesDir = path.join(currentDir, 'templates'),
    methodsPath = path.resolve(myDir, './lib/methods'),
    server, rpc;

function onExit(error) {
    if (server) {
        server.stop();
    }
    if (error instanceof Error) {
        throw error;
    }
}
process.on('exit', onExit);
process.once('SIGTERM', process.exit.bind(process, 0));
process.once('SIGINT', process.exit.bind(process, 0));

flags.defineString('runmode', 'dev', 'are you running in dev or production');
flags.defineInteger('rpc-port', 0, 'port address to listen on');
flags.defineString('skyapi-addr', '', 'address of skyapi to advertise to');
flags.defineString('postmaster-addr', '', 'address to reach postmaster instance');
flags.defineString('templates-dir', templatesDir, 'directory to load templates from');
flags.defineString('addl-methods-dir', '', 'add additional methods from this directory');
flags.defineString('from-email', '', 'default the fromEmail to this address');
flags.defineString('from-name', '', 'default the fromName to this address');
flags.defineString('logger', '', 'the class to use for logging (defaults to console)');
flags.defineString('log-level', '', 'the log level (defaults to info)');
flags.defineString('priority', '5', 'lower means higher priority in dns');

server = new Server();

// give someone a chance to provide a callback to provide a server middleware
setImmediate(function() {
    // if they've already called parse don't call it again
    if (!flags.isSet('rpc-port')) {
        flags.parse(null, true);
    }

    var logger = flags.get('logger'),
        logLevel = flags.get('log-level');
    if (logger) {
        Log.setClass(logger);
    }
    if (logger) {
        Log.setLevel(logLevel);
    }

    global.RUN_MODE = flags.get('runmode');
    templatesDir = flags.get('templates-dir');

    compile(templatesDir).then(function() {
        Log.info('compiled templates', {dir: templatesDir});
        return addMethods(methodsPath, server.rpc);
    }).then(function(dirAdded) {
        Log.info('added methods', {dir: dirAdded});
        var addlMethodsPath = flags.get('addl-methods-dir');
        if (!addlMethodsPath) {
            return null;
        }
        return addMethods(path.resolve(currentDir, addlMethodsPath), server.rpc);
    }).then(function(dirAdded) {
        if (dirAdded) {
            Log.info('added methods', {dir: dirAdded});
        }
        return server.start(flags.get('rpc-port'));
    }).then(function() {
        var skyapiAddr = flags.get('skyapi-addr');
        if (skyapiAddr && typeof server.setSkyAPIEndpoint === 'function') {
            server.setSkyAPIEndpoint(skyapiAddr);
            server.provide('robthebuilder', flags.get('priority'));
        }
    }).catch(function(e) {
        console.error('Error while starting:\n', e);
        if (e.stack) {
            console.error(e.stack);
        }
        server.stop();
        process.exit(1);
    });
});

module.exports = function(cb) {
    if (cb) {
        server = cb(server);
    }
};
