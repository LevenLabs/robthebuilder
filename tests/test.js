var path = require('path'),
    compile = require('../lib/compile.js'),
    Log = require('modulelog')('robthebuilder'),
    reporterName = process.env.NODEUNIT_REPORTER || 'default',
    reporter = require('nodeunit').reporters[reporterName],
    templatesDir = path.join(path.dirname(module.filename), 'templates'),
    printDeferredStats = false,
    options = null;

Log.setClass('console');

global.RUN_MODE = 'dev';

//from https://github.com/caolan/nodeunit/issues/244
process.on('uncaughtException', function(err) {
    console.error(err.stack);
    process.exit(1);
});

process.chdir(__dirname);

if (reporterName === 'junit') {
    options = {output: './results'};
    printDeferredStats = true;
}

compile(templatesDir).then(function() {
    reporter.run(['methods'], options, function(err) {
        if (err) {
            console.error(err.stack);
            process.exit(1);
        }
    });
}).catch(function(e) {
    console.error('Error running tests', e);
    console.error(e.stack);
    process.exit(1);
});



