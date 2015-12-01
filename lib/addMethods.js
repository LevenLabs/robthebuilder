var fs = require('fs'),
    path = require('path');

function handleFile(file, rpc) {
    return new Promise(function(resolve, reject) {
        fs.stat(file, function(err, stat) {
            if (err) {
                reject(err);
                return;
            }
            if (stat.isDirectory()) {
                addMethods(file, rpc).then(resolve);
                return;
            }
            require(file)(rpc);
            resolve();
        });
    });
}

function addMethods(dir, rpc) {
    return new Promise(function(resolve, reject) {
        fs.readdir(dir, function(err, files) {
            if (err) {
                reject(err);
                return;
            }
            var i = 0,
                promises = [];
            for (; i < files.length; i++) {
                promises.push(handleFile(path.join(dir, files[i]), rpc));
            }
            Promise.all(promises).then(function() {
                resolve(dir);
            }, reject);
        });
    });
}

module.exports = addMethods;
