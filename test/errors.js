var assert = require('assert'),
    sharedconfig = require('..'),
    testdb = require('./helpers/testdb'),
    config;

describe('erroring tests', function() {
    it('should detect connection errors when invalid', function(done) {
        var config = sharedconfig(testdb.host+'/asdfadsfasdfasdfasdf');
        
        config.on('connect', function() {
            done(new Error('Received connect event in error'));
        });
        
        config.on('error', function(err) {
            assert(err);
            done();
        });
    });
});