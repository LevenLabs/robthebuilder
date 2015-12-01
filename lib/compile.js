var path = require('path'),
    fs = require('fs'),
    _ = require('lodash'),
    Deferred = require('deferred'),
    readdir = Deferred.promisify(fs.readdir),
    writeFile = Deferred.promisify(fs.writeFile),
    mkdir = Deferred.promisify(fs.mkdir),
    minify = require('html-minifier').minify,
    outDir = path.join(path.dirname(module.filename), "templates"),
    headerRegex = /^<!--\s*(\{[\s\S]*\})\s*-->/m, //by default . does not match new-lines but \s does, and [^] matches anything
    minifyOptions = {
        removeComments: true,
        removeCommentsFromCDATA: true,
        collapseWhitespace: true,
        conservativeCollapse: true,
        minifyCSS: true
    };

function ensureDir(dir) {
    return new Promise(function(resolve, reject) {
        fs.stat(dir, function(err) {
            if (err) {
                mkdir(dir).then(resolve, reject);
                return;
            }
            resolve();
        });
    });
}

function collectTemplates(templatesDir) {
    return readdir(templatesDir)
        //map all the files into objects if they're not a directory
        .map(function(fileName) {
            return new Promise(function(resolve, reject) {
                var filePath = path.join(templatesDir, fileName);
                fs.stat(filePath, function(err, stat) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    var res = null;
                    if (!stat.isDirectory()) {
                        res = {
                            name: fileName.replace(/\.ejs$/, ''),
                            path: filePath,
                            header: null,
                            content: null,
                            template: null,
                            dependencies: null
                        };
                    }
                    resolve(res);
                });
            });
        })
        //remove all the nulls (directories) from the array
        .invoke('filter', function(f) {
            return f !== null;
        })
        //read all the files
        .map(function(file) {
            return new Promise(function(resolve, reject) {
                fs.readFile(file.path, function(err, content) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    file.content = content;
                    resolve(file);
                });
            })
        })
        //now parse all the headers
        .map(function(file) {
            return new Promise(function(resolve, reject) {
                var match = null;
                if (Buffer.isBuffer(file.content)) {
                    file.content = file.content.toString();
                }
                match = file.content.match(headerRegex);
                if (match === null || !match[1]) {
                    reject(new Error('Failed to find header in ' + file.path));
                    return;
                }
                try {
                    file.header = JSON.parse(match[1]);
                    file.name = file.header.name || file.name;
                    resolve(file);
                } catch (e) {
                    reject(e);
                }
            });
        });
}

function renderAndMinifyTemplates(templates) {
    var i = 0;
    function process() {
        var file = null,
            name = '',
            unresolved = false,
            params = null,
            parent = null;
        for (name in templates) {
            if (!templates.hasOwnProperty(name)) {
                continue;
            }
            params = {};
            file = templates[name];
            //if we already have a template for the file then don't render it again
            if (file.template) {
                continue;
            }
            if (file.header.parent) {
                parent = file.header.parent;
                if (!templates.hasOwnProperty(parent.name)) {
                    throw new Error('Reference to not found parent "' + parent.name + '" in "' + file.path + '"');
                }
                if (templates[parent.name].template === null) {
                    unresolved = true;
                    continue;
                }
                if (parent.args) {
                    params = _.extend(params, parent.args);
                }
                if (parent.include_var) {
                    params[parent.include_var] = file.content;
                }
                file.content = templates[parent.name].template(params);
            }
            file.template = _.template(minify(file.content, minifyOptions));
        }
        return unresolved;
    }
    while (process() && i++ < 5){}
    if (i === 5) {
        throw new Error('Failed to resolve parents after 5 iterations');
    }
    return templates;
}

function mapTemplates(templates) {
    var arr = [],
        n = '';
    for (n in templates) {
        if (!templates.hasOwnProperty(n)) {
            continue;
        }
        arr.push(templates[n]);
    }
    return Deferred.map(arr);
}

function writeBodies(file) {
    if (!file.template) {
        return Promise.reject(new Error(file.file + " has no associated bodies"));
    }
    var dest = path.join(outDir, file.name) + '.js',
        funcLine = 'module.exports = ' + file.template,
        paramsLine = 'module.exports.params = ' + JSON.stringify(file.header.params || []);
    return writeFile(dest, [funcLine, paramsLine, ''].join(';\n'));
}

function compile(dir) {
    //we need to use to deferred chain to utilize the map/reduce methods
    return Deferred.resolve().
        then(function() {
            return ensureDir(outDir);
        })
        .then(function() {
            return collectTemplates(dir); //this returns a collection of files
        })
        .reduce(function(templates, file) {
            templates[file.name] = file;
            return templates;
        }, {})
        .then(renderAndMinifyTemplates) //this returns a collection of files
        .then(mapTemplates)
        .map(writeBodies);
}

module.exports = compile;
