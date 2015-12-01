var util = require('util'),
    flags = require('flags'),
    RPCLib = require('rpclib'),
    SkyRPCClient = require('skyrpcclient'),
    Log = require('modulelog')('robthebuilder'),
    render = require('../render.js'),
    defaultFromEmail = flags.get('from-email'),
    defaultFromName = flags.get('from-name'),
    postmasterClient = null;

function getPostmasterClient() {
    if (postmasterClient === null) {
        postmasterClient = new SkyRPCClient(flags.get('postmaster-addr'));
    }
    return postmasterClient;
}

function callRender(name, params, response) {
    var user = response.get('user'),
        toEmail = response.get('toEmail') || (user && user.email),
        toName = response.get('toName') || (user && user.toName);
    if (user && !params.hasOwnProperty('user')) {
        params.user = user;
    }
    if (toEmail && !params.hasOwnProperty('toEmail')) {
        params.toEmail = toEmail;
    }
    if (toName && !params.hasOwnProperty('toName')) {
        params.toName = toName;
    }
    return render(name, params).catch(function(err) {
        Log.error('Error when calling render', {name: name, error: err});
        if (err instanceof render.ParameterMissingError) {
            response.reject(3, {param: err.param});
        } else {
            response.reject(RPCLib.ERROR_INTERNAL_ERROR, {error: err.message});
        }
    });
}

module.exports = function(rpc) {

    rpc.addMethod('Rob.Render', {
        handler: function(params, response) {
            callRender(params.name, params.params, response).then(function(html) {
                response.resolve({html: html});
            });
        },
        params: {
            name: 'string',
            params: 'object'
        },
        description: '',
        errors: {
            3: 'Missing required template parameter'
        }
    });

    rpc.addMethod('Rob.RenderAndEmail', {
        handler: function(params, response) {
            var user = response.get('user') || params.params.user || params.user,
                toEmail = params.toEmail || response.get('toEmail') || (user && user.email),
                toName = params.toName || response.get('toName') || (user && user.name),
                emailParams = {
                    to: toEmail,
                    toName: toName || undefined,
                    from: params.fromEmail || defaultFromEmail,
                    fromName: params.fromName || defaultFromName || undefined,
                    subject: params.subject,
                    flags: params.flags
                };
            if (!emailParams.to) {
                response.reject(RPCLib.ERROR_INVALID_PARAMS, {param: 'toEmail'});
                return;
            }
            if (!emailParams.from) {
                response.reject(RPCLib.ERROR_INVALID_PARAMS, {param: 'fromEmail'});
                return;
            }
            callRender(params.name, params.params, response).then(function(html) {
                emailParams.html = html;
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
                }).setTimeout(10000);
            });
        },
        params: {
            toEmail: 'string',
            toName: {type: 'string', optional: true},
            subject: 'string',
            params: 'object',
            name: 'string',
            fromEmail: {type: 'string', optional: true},
            fromName: {type: 'string', optional: true},
            flags: {type: 'number', optional: true}
        },
        description: '',
        errors: {
            3: 'Missing required template parameter'
        }
    });

};
