var RPCLib = require('rpclib'),
    SkyRPCClient = require('skyrpcclient'),
    authClient = new SkyRPCClient('auth-api.services.example'),
    Log = require('modulelog')('robthebuilder');

module.exports = function(rpc) {

    rpc.setPreProcessor(function(request, response) {
        if (!request.params || !request.params.hasOwnProperty('userID')) {
            return;
        }
        //if they already passed a user then don't fetch one
        if (request.params.params && request.params.params.hasOwnProperty('user')) {
            return;
        }

        Log.debug('calling User.GetUserByID', {userID: request.params.userID});
        return new Promise(function(resolve) {
            authClient.call('User.GetUserByID', {userID: request.params.userID}, function(err, res) {
                if (err) {
                    Log.error('Error from User.GetUserByID', err);
                    if (err.code === -2) {
                        response.reject(1, 'User not found');
                    } else {
                        response.reject(RPCLib.ERROR_INTERNAL_ERROR);
                    }
                } else {
                    response.set('user', res);
                }
                //always resolve since we are rejecting the response above if it actually failed
                resolve(res);
            }).setTimeout(5000);
        });
    });

};
