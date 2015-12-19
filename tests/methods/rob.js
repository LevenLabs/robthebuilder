var assert = require('assert'),
    RPCLib = require('rpclib'),
    flags = require('flags'),
    SkyRPCClient = require('skyrpcclient'),
    hashParams = require('../../lib/hashParams.js'),
    rpc = new RPCLib(),
    authClientHostname = 'auth-api.services.example',
    postmasterClientHostname = 'postmaster.services.example',
    paramsToHash = {
        name: 'ParamName',
        toEmail: '',
        user: {
            name: 'betsy'
        },
        toName: ''
    },
    hashOfParams = hashParams(paramsToHash),
    robMethods, preMethods;
require('nowsecs');

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
            if (params.to === 'test@test') {
                assert.equal(params.to, 'test@test');
                assert.equal(params.toName, 'UserName');
                assert.equal(params.subject, 'Test Email');
            } else if (params.to === 'test2@test') {
                assert.equal(params.to, 'test2@test');
                assert.equal(params.toName, 'UserName');
                assert.equal(params.subject, 'Test Email');
            } else if (params.to === 'noname@test') {
                assert.equal(params.to, 'noname@test');
                assert.equal(params.subject, 'Test Email');
                assert.equal(params.toName, undefined);
            } else if (params.to === 'hello@test') {
                assert.equal(params.subject, 'hello');
            } else if (params.to === 'dup@test' || params.to === 'old@test') {
                // these are fine
            } else {
                throw new Error('Invalid to sent to Postmaster.Enqueue: ' + params.to);
            }
            callback(null, {success: true});
            break;
        case 'Postmaster.GetLastEmail':
            if (!params.uniqueID) {
                throw new Error('Invalid uniqueID sent to Postmaster.GetLastEmail: ' + params.uniqueID);
            }
            assert.equal(params.uniqueID, hashOfParams);
            if (params.to === 'dup@test') {
                callback(null, {stat: {tsCreated: Date.nowSecs() - 5}});
            } else if (params.to === 'old@test') {
                callback(null, {stat: {tsCreated: 100}});
            } else {
                callback(null, {stat: null});
            }
            break;
    }
});

exports.addMethods = function(test) {
    robMethods(rpc);
    preMethods(rpc);
    test.done();
};

exports.hashParams = function(test) {
    test.equal(hashParams(paramsToHash), hashOfParams);
    test.notEqual(hashOfParams, "");
    test.done();
};

/**
 *
 * Testing generic Render
 *
 */

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
        name: 'doesNotExist',
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

exports['Rob.Render.Parent'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        name: 'test_child',
        params: {
            name: 'ParamName'
        }
    }, function(result) {
        test.equal(result.result.html, 'Hello,ParamName');
        test.done();
    });
};
/*
exports['Rob.Render.GrandParent'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        name: 'test_grandchild',
        params: {
            name: 'ParamName'
        }
    }, function(result) {
        test.equal(result.result.html, 'Hola,ParamName');
        test.done();
    });
};
*/
exports['Rob.Render.Subject'] = function(test) {
    test.expect(2);
    rpc.call('Rob.Render', {
        userID: 1,
        name: 'test_subject',
        params: {
            name: 'ParamName'
        }
    }, function(result) {
        test.equal(result.result.html, 'Hello,ParamName');
        test.equal(result.result.subject, 'hello');
        test.done();
    });
};

/**
 *
 * Testing toEmail override/fallback
 *
 */

exports['Rob.Render.ToEmail'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        toEmail: 'top@test',
        name: 'test_email',
        params: {}
    }, function(result) {
        test.equal(result.result.html, 'top@test');
        test.done();
    });
};

exports['Rob.Render.ToEmail.User'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        name: 'test_email',
        params: {}
    }, function(result) {
        test.equal(result.result.html, 'test@test');
        test.done();
    });
};

exports['Rob.Render.ToEmail.UserOverride'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        toEmail: 'top@test',
        name: 'test_email',
        params: {}
    }, function(result) {
        test.equal(result.result.html, 'top@test');
        test.done();
    });
};

exports['Rob.Render.ToEmail.Params'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        toEmail: 'top@test',
        name: 'test_email',
        params: {
            toEmail: "params@test"
        }
    }, function(result) {
        test.equal(result.result.html, 'params@test');
        test.done();
    });
};

/**
 *
 * Testing toName override/fallback
 *
 */

exports['Rob.Render.ToName'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        toName: 'topName',
        name: 'test_name',
        params: {}
    }, function(result) {
        test.equal(result.result.html, 'topName');
        test.done();
    });
};

exports['Rob.Render.ToEmail.User'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        name: 'test_name',
        params: {}
    }, function(result) {
        test.equal(result.result.html, 'UserName');
        test.done();
    });
};

exports['Rob.Render.ToEmail.UserOverride'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        toName: 'topName',
        name: 'test_name',
        params: {}
    }, function(result) {
        test.equal(result.result.html, 'topName');
        test.done();
    });
};

exports['Rob.Render.ToEmail.Params'] = function(test) {
    test.expect(1);
    rpc.call('Rob.Render', {
        userID: 1,
        toName: 'topName',
        name: 'test_name',
        params: {
            toName: "paramsName"
        }
    }, function(result) {
        test.equal(result.result.html, 'paramsName');
        test.done();
    });
};

/**
 *
 * Testing RenderAndEmail
 *
 */

exports['Rob.RenderAndEmail'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        toEmail: 'test2@test',
        toName: 'UserName',
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

exports['Rob.RenderAndEmail.EmailNoParams'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        toEmail: 'test@test',
        toName: 'UserName',
        name: 'test',
        subject: 'Test Email',
        params: {
            name: 'Sup',
            toEmail: 'no@test'
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

/**
 *
 * Testing duplicate RenderAndEmail
 *
 */

exports['Rob.RenderAndEmail.OldDup'] = function(test) {
    test.expect(1);
    rpc.call('Rob.RenderAndEmail', {
        name: 'test',
        toEmail: 'old@test',
        subject: 'Test Email',
        params: paramsToHash,
        fromEmail: 'test@test',
        dupThreshold: 60
    }, function(result) {
        test.equal(result.result.success, true);
        test.done();
    });
};

exports['Rob.RenderAndEmail.DupHash'] = function(test) {
    test.expect(1);
    rpc.call('Rob.RenderAndEmail', {
        name: 'test',
        toEmail: 'dup@test',
        subject: 'Test Email',
        params: paramsToHash,
        fromEmail: 'test@test',
        dupThreshold: 60
    }, function(result) {
        test.equal(result.error.code, 5);
        test.done();
    });
};

exports['Rob.RenderAndEmail.DupHashProvided'] = function(test) {
    test.expect(1);
    rpc.call('Rob.RenderAndEmail', {
        name: 'test',
        toEmail: 'dup@test',
        subject: 'Test Email',
        params: {
            name: "Something"
        },
        fromEmail: 'test@test',
        uniqueID: hashOfParams,
        dupThreshold: 60
    }, function(result) {
        test.equal(result.error.code, 5);
        test.done();
    });
};

exports['Rob.RenderAndEmail.DupNull'] = function(test) {
    test.expect(1);
    rpc.call('Rob.RenderAndEmail', {
        name: 'test',
        toEmail: 'old@test',
        subject: 'Test Email',
        params: paramsToHash,
        fromEmail: 'test@test',
        uniqueID: hashOfParams,
        dupThreshold: 60
    }, function(result) {
        test.equal(result.result.success, true);
        test.done();
    });
};

/**
 *
 * Testing subject override/fallback in RenderAndEmail
 *
 */

exports['Rob.RenderAndEmail.NoSubject'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        name: 'test',
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

exports['Rob.RenderAndEmail.FallbackSubject'] = function(test) {
    test.expect(2);
    rpc.call('Rob.RenderAndEmail', {
        toEmail: 'hello@test',
        name: 'test_subject',
        params: {
            name: "Test"
        },
        fromEmail: 'test@test'
    }, function(result) {
        test.equal(result.result.success, true);
        test.equal(result.result.toEmail, 'hello@test');
        test.done();
    });
};
