var path = require('path'),
    flags = require('flags'),
    Log = require('modulelog')('robthebuilder'),
    SkyProvider = require('skyprovider'),
    RPCLib = require('rpclib'),
    Server = require('./lib/server.js'),
    compile = require('./lib/compile.js'),
    addMethods = require('./lib/addMethods.js'),
    currentDir = path.join(path.dirname(process.mainModule.filename)),
    templatesDir = path.join(currentDir, "templates"),
    methodsPath = path.resolve(currentDir, './lib/methods'),
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
flags.defineString('logger', 'default', 'the class to use for logging');
flags.defineString('log-level', 'info', 'the log level');
flags.parse();

Log.setClass(flags.get('logger'));
Log.setLevel(flags.get('log-level'));

global.RUN_MODE = flags.get('runmode');
templatesDir = flags.get('templates-dir');

rpc = new RPCLib();
server = new Server(rpc);

function advertise(addr, port) {
    var skyClient = new SkyProvider('ws://' + addr + '/provide'),
        priority = global.RUN_MODE === 'dev' ? 1 : 5,
        name = 'robthebuilder';
    Log.info('calling provideService', {name: name, port: port, priority: priority, addr: addr});
    skyClient.provideService(name, port, {priority: priority});
}

compile(templatesDir).then(function() {
    Log.info('compiled templates', {dir: templatesDir});
    return addMethods(methodsPath, rpc);
}).then(function(dirAdded) {
    Log.info('added methods', {dir: dirAdded});
    var addlMethodsPath = flags.get('addl-methods-dir');
    if (!addlMethodsPath) {
        return null;
    }
    return addMethods(path.resolve(currentDir, addlMethodsPath), rpc);
}).then(function(dirAdded) {
    if (dirAdded) {
        Log.info('added methods', {dir: dirAdded});
    }
    return server.start(flags.get('rpc-port'));
}).then(function(port) {
    var skyapiAddr = flags.get('skyapi-addr');
    if (skyapiAddr) {
        advertise(skyapiAddr, port);
    }
}).catch(function(e) {
    console.error('Error starting', e);
    console.error(e.stack);
    server.stop();
    process.exit(1);
});
