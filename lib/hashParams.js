var crypto = require('crypto'),
    Log = require('modulelog')('robthebuilder');

module.exports = function hashParams(params) {
    var str = "",
        shasum;
    try {
        str = JSON.stringify(params);
    } catch (err) {
        Log.error('Error hashing params', err);
        return "";
    }
    shasum = crypto.createHash('sha512');
    shasum.update(str);
    return shasum.digest('base64');
};
