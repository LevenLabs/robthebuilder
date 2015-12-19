var util = require('util'),
    path = require('path'),
    assert = require('assert'),
    escape = require('escape-html'),
    Log = require('modulelog')('robthebuilder'),
    currentDir = path.join(path.dirname(process.mainModule.filename)),
    templatesDir = path.join(currentDir, 'out');

function validateParams(template, params) {
    var res = {
            valid: true,
            requiresUser: false,
            error: ''
        },
        i = 0, l = template.params.length;
    for (; i < l; i++) {
        if (!params.hasOwnProperty(template.params[i])) {
            res.valid = false;
            res.error = 'Missing param "' + template.params[i] + '"';
            res.errorParam = template.params[i];
            break;
        }
    }
    return res;
}

function render(name, p) {
    return new Promise(function(resolve, reject) {
        var params = p || {},
            html = '',
            template, validity;
        try {
            assert.equal(name.indexOf('.'), -1); //do not allow them to go up directories
            template = require([templatesDir, name + '.js'].join('/'));
            assert(typeof template === 'function');
        } catch (e) {
            Log.error('Failed to require template', {name: name, error: e});
            reject(e);
            return;
        }
        validity = validateParams(template, params);
        if (!validity.valid) {
            Log.warn("error validating params", {
                error: validity.error,
                name: name
            });
            reject(new ParameterMissingError(validity.error, validity.errorParam));
            return;
        }
        try {
            params.escape = escape;
            html = template(params);
            resolve({html: html, subject: template.subject});
        } catch (e) {
            Log.error('Failed to render template', {name: name, error: e});
            reject(e);
        }
    });
}

function ParameterMissingError(message, param) {
    this.message = message || 'unknown';
    this.param = param;
}
util.inherits(ParameterMissingError, Error);
render.ParameterMissingError = ParameterMissingError;

module.exports = render;

