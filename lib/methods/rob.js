var util = require('util'),
    flags = require('flags'),
    RPCLib = require('rpclib'),
    SkyRPCClient = require('skyrpcclient'),
    Log = require('modulelog')('robthebuilder'),
    render = require('../render.js'),
    hashParams = require('../hashParams.js'),
    defaultFromEmail = flags.get('from-email'),
    defaultFromName = flags.get('from-name'),
    postmasterClient = null;
require('nowsecs');

// Promises are dumb and so I have to throw a specific error to stop the
// chain and catch it and silently handle it
var duplicateError = new Error('email is a duplicate');

function getPostmasterClient() {
    if (postmasterClient === null) {
        postmasterClient = new SkyRPCClient(flags.get('postmaster-addr'));
    }
    return postmasterClient;
}

function getToName(params, usr, response, tParams) {
    var user = usr || response.get('user'),
        toName = (tParams && tParams.toName) || params.toName || response.get('toName') || (user && user.name);
    return toName;
}

function getToEmail(params, usr, response, tParams) {
    var user = usr || response.get('user'),
        toEmail = (tParams && tParams.toEmail) || params.toEmail || response.get('toEmail') || (user && user.email);
    return toEmail;
}

//this needs to be separate so we can hash it
function buildTemplateParams(params, response) {
    var tempParams = params.params || {},
        // this is also in RenderAndEmail and is slightly different
        user = tempParams.user || params.user || response.get('user'),
        toEmail = getToEmail(params, user, response, tempParams),
        toName = getToName(params, user, response, tempParams);
    if (user && !tempParams.hasOwnProperty('user')) {
        tempParams.user = user;
    }
    if (toEmail && !tempParams.hasOwnProperty('toEmail')) {
        tempParams.toEmail = toEmail;
    }
    if (toName && !tempParams.hasOwnProperty('toName')) {
        tempParams.toName = toName;
    }
    return tempParams;
}

function callRender(name, params, response) {
    return render(name, params).catch(function(err) {
        Log.error('Error when calling render', {name: name, error: err});
        if (err instanceof render.ParameterMissingError) {
            response.reject(3, {param: err.param});
        } else {
            response.reject(RPCLib.ERROR_INTERNAL_ERROR, {error: err.message});
        }
    });
}

function callPostmaster(fn, params, timeout) {
   return new Promise(function(resolve, reject) {
        getPostmasterClient().call(fn, params, function(err, result) {
            if (err) {
                Log.error('Error result from postmaster', {error: err, func: fn});
                reject(err);
                return;
            }
            resolve(result);
        }).setTimeout(timeout || 5000);
    });
}

module.exports = function(rpc) {

    rpc.addMethod('Rob.Render', {
        handler: function(params, response) {
            callRender(params.name, buildTemplateParams(params, response), response).then(function(res) {
                response.resolve(res);
            });
        },
        params: {
            name: 'string',
            params: 'object',
            //these are here just so they match RenderAndEmail if the template needs them
            toEmail: {type: 'string', optional: true},
            toName: {type: 'string', optional: true}
        },
        description: 'Renders a template and returns it',
        errors: {
            3: 'Missing required template parameter'
        }
    });

    rpc.addMethod('Rob.RenderAndEmail', {
        handler: function(params, response) {
            // this is different because we don't use the template params
            var user = params.user || response.get('user'),
                toEmail = getToEmail(params, user, response),
                toName = getToName(params, user, response),
                emailParams = {
                    to: toEmail,
                    toName: toName || undefined,
                    from: params.fromEmail || defaultFromEmail,
                    fromName: params.fromName || defaultFromName || undefined,
                    subject: params.subject || '',
                    flags: params.flags,
                    html: "",
                    uniqueID: ""
                },
                uniqueID = params.uniqueID,
                builtParams = buildTemplateParams(params, response),
                dupPromise, dupParams;

            if (!emailParams.to) {
                response.reject(RPCLib.ERROR_INVALID_PARAMS, {param: 'toEmail'});
                return;
            }
            if (!emailParams.from) {
                response.reject(RPCLib.ERROR_INVALID_PARAMS, {param: 'fromEmail'});
                return;
            }

            if (!uniqueID && params.dupThreshold > 0) {
                uniqueID = hashParams(builtParams);
                if (!uniqueID) {
                    response.reject(4);
                    return;
                }
            }
            if (uniqueID) {
                emailParams.uniqueID = uniqueID;
            }

            //check to see if this email is a duplicate
            if (params.dupThreshold > 0) {
                dupParams = {
                    to: emailParams.to,
                    uniqueID: emailParams.uniqueID
                };
                dupPromise = callPostmaster('Postmaster.GetLastEmail', dupParams).then(function(res) {
                    if (!res.stat) {
                        return;
                    }
                    var now = Date.nowSecs(),
                        diff = now - res.stat.tsCreated;
                    if (diff < params.dupThreshold) {
                        Log.warn("duplicate email encountered", dupParams);
                        throw duplicateError;
                    }
                });
            } else {
                dupPromise = Promise.resolve(null);
            }

            dupPromise.then(function() {
                return callRender(params.name, builtParams, response);
            }).then(function(res) {
                emailParams.html = res.html;
                if (res.subject && !emailParams.subject) {
                    emailParams.subject = res.subject;
                }
                if (!emailParams.subject) {
                    response.reject(RPCLib.ERROR_INVALID_PARAMS, {param: 'subject'});
                    return;
                }
                Log.info('sending email', {to: emailParams.to, template: params.name});
                getPostmasterClient().call('Postmaster.Enqueue', emailParams, function(err, result) {
                    if (err || !result.success) {
                        Log.error('Error result from Postmaster.Enqueue', err);
                        if (err.code > 0) {
                            response.reject(RPCLib.ERROR_INTERNAL_ERROR, err);
                        } else {
                            response.reject(RPCLib.ERROR_INTERNAL_ERROR);
                        }
                        return;
                    }
                    response.resolve({success: true, toEmail: emailParams.to});
                }).setTimeout(30000);
            }).catch(function(err) {
                if (err === duplicateError) {
                    response.reject(5);
                } else {
                    Log.error('Error handling callRender result from Postmaster.Enqueue', err);
                    response.reject(RPCLib.ERROR_INTERNAL_ERROR);
                }
            });
        },
        params: {
            toEmail: 'string',
            toName: {type: 'string', optional: true},
            subject: {type: 'string', optional: true},
            params: 'object',
            name: 'string',
            fromEmail: {type: 'string', optional: true},
            fromName: {type: 'string', optional: true},
            flags: {type: 'number', optional: true},
            uniqueID: {type: 'string', optional: true},
            dupThreshold: {type: 'number', optional: true}
        },
        description: 'Renders a template and then sends it in an email using postmaster',
        errors: {
            3: 'Missing required template parameter',
            4: 'Failed to hash params to build uniqueID',
            5: 'Previous email with the same uniqueID was sent less than dupThreshold'
        }
    });

};
