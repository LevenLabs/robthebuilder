var assert = require('assert'),
    RPCLib = require('rpclib'),
    flags = require('flags'),
    SkyRPCClient = require('skyrpcclient'),
    rpc = new RPCLib(),
    authClientHostname = 'auth-api.services.example',
    postmasterClientHostname = 'postmaster.services.example',
    robMethods, preMethods;

// we have to override the postmaster flag first
flags.defineString('postmaster-addr', '');
flags.defineString('from-email', '');
flags.defineString('from-name', '');

flags.FLAGS['postmaster-addr'].set(postmasterClientHostname);
flags.FLAGS['from-email'].set('test@test');
robMethods = require('../../lib/methods/rob.js');
preMethods = require('../pre/pre.js');

SkyRPCClient.setHostnameHandler(authClientHostname, function(name, params, callback) {
    switch (name) {
        case 'User.GetUserByID':
            assert.equal(params.userID, 1);
            callback(null, {userID: 1, name: 'UserName', email: 'test@test'});
            break;
    }
});

SkyRPCClient.setHostnameHandler(postmasterClientHostname, function(name, params, callback) {
    switch (name) {
        case 'Postmaster.Enqueue':
            assert.equal(params.subject, 'Test Email');
            if (params.to === 'test@test') {
                assert.equal(params.to, 'test@test');
                assert.equal(params.toName, 'UserName');
            } else if (params.to === 'test2@test') {
                assert.equal(params.to, 'test2@test');
                assert.equal(params.toName, 'UserName');
            } else if (params.to === 'noname@test') {
                assert.equal(params.to, 'noname@test');
                assert.equal(params.toName, undefined);
            } else {
                throw new Error('Invalid to sent to Postmaster.Enqueue: ' + params.to);
            }
            callback(null, {success: true});
            break;
    }
});

exports.addMethods = function(test) {
    robMethods(rpc);
    preMethods(rpc);
    test.done();
};

exports['Rob.Render'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        name: 'test',
        params: {
            name: 'ParamName'
        }
    }, function(result) {
        test.equal(result.result.html, 'Hello,ParamName');
        test.done();
    });
};

exports['Rob.Render.InvalidName'] = function(test) {
    test.expect(2);
    rpc.call('Rob.Render', {
        userID: 1,
        name: '__test__',
        params: {}
    }, function(result) {
        test.equal(result.error.message, 'Internal error');
        test.equal(result.error.code, -32603);
        test.done();
    });
};

exports['Rob.Render.NoParam'] = function(test) {
    test.expect(3);
    rpc.call('Rob.Render', {
        userID: 1,
        name: 'test',
        params: {}
    }, function(result) {
        test.equal(result.error.message, 'Missing required template parameter');
        test.equal(result.error.code, 3);
        test.equal(result.error.data.param, 'name');
        test.done();
    });
};

exports['Rob.RenderAndEmail'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        userID: 1,
        toEmail: 'test2@test',
        name: 'test',
        subject: 'Test Email',
        params: {
            name: 'Sup'
        },
        fromEmail: 'test@test'
    }, function(result) {
        test.equal(result.result.success, true);
        test.equal(result.result.toEmail, 'test2@test');
        test.done();
    });
};

exports['Rob.RenderAndEmail.FallbackEmail'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        userID: 1,
        toEmail: '',
        name: 'test',
        subject: 'Test Email',
        params: {
            name: 'Sup'
        },
        fromEmail: 'test@test'
    }, function(result) {
        test.equal(result.result.success, true);
        test.equal(result.result.toEmail, 'test@test');
        test.done();
    });
};

exports['Rob.RenderAndEmail.NoUserID'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        toEmail: 'noname@test',
        name: 'test',
        subject: 'Test Email',
        params: {
            name: 'ParamName'
        },
        fromEmail: 'test@test'
    }, function(result) {
        if (!result.result) {
            console.log(result);
        }
        test.equal(result.result.success, true);
        test.equal(result.result.toEmail, 'noname@test');
        test.done();
    });
};


exports['Rob.RenderAndEmail.NoFrom'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        toEmail: 'noname@test',
        name: 'test',
        subject: 'Test Email',
        params: {
            name: 'ParamName'
        },
        fromEmail: ''
    }, function(result) {
        test.equal(result.result.success, true);
        test.equal(result.result.toEmail, 'noname@test');
        test.done();
    });
};

exports['Rob.RenderAndEmail.NoEmail'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        name: 'test',
        subject: 'Test Email',
        params: {
            name: 'ParamName'
        },
        fromEmail: 'test@test'
    }, function(result) {
        test.equal(result.error.message, 'Invalid params');
        test.equal(result.error.code, -32602);
        test.done();
    });
};
