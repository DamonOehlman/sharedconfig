var assert = require('assert'),
    sharedconfig = require('..'),
    config;

describe('erroring tests', function() {
    it('should detect connection errors when invalid', function(done) {
        var config = sharedconfig('http://damonoehlman.iriscouch.com/asdfadsfasdfasdfasdf');
        
        config.on('connect', function() {
            done(new Error('Received connect event in error'));
        });
        
        config.on('error', function(err) {
            assert(err);
            done();
        });
    });
});