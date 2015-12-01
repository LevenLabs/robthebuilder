var util = require('util'),
    path = require('path'),
    assert = require('assert'),
    escape = require('escape-html'),
    Deferred = require('deferred'),
    Log = require('modulelog')('robthebuilder'),
    templatesDir = path.join(path.dirname(module.filename), 'templates');

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
    var dfd = new Deferred(),
        params = p || {},
        html = '',
        template, validity;
    try {
        assert.equal(name.indexOf('.'), -1); //do not allow them to go up directories
        template = require([templatesDir, name + '.js'].join('/'));
        assert(typeof template === 'function');
    } catch (e) {
        Log.error('Failed to require template', {name: name, error: e});
        dfd.reject(e);
        return dfd.promise;
    }
    validity = validateParams(template, params);
    if (!validity.valid) {
        Log.warn("error validating params", {error: validity.error, name: name});
        dfd.reject(new ParameterMissingError(validity.error, validity.errorParam));
        return dfd.promise;
    }
    try {
        params.escape = escape;
        html = template(params);
        dfd.resolve(html);
    } catch (e) {
        Log.error('Failed to render template', {name: name, error: e});
        dfd.reject(e);
    }
    return dfd.promise;
}

function ParameterMissingError(message, param) {
    this.message = message || 'unknown';
    this.param = param;
}
util.inherits(ParameterMissingError, Error);
render.ParameterMissingError = ParameterMissingError;

module.exports = render;

