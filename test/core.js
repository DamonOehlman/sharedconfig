var assert = require('assert'),
    sharedconfig = require('..'),
    testdb = require('./helpers/testdb'),
    config;
    
describe('simple read tests', function() {
    before(testdb.prepare);
    
    it('should be able to connect to the config endpoint', function(done) {
        config = sharedconfig('http://sidelab.iriscouch.com/sharedconfig').on('connect', done);
        
        // ensure that the config is defined
        assert(config);
    });
    
    it('should be have initialized the environments array', function() {
        assert(config._environments.length > 0);
    });
    
    it('can retrieve the full prod config', function(done) {
        config.use('prod', function(err, data) {
            assert.ifError(err);
            assert.equal(config._current, 'prod');
            assert.equal(data.a, 1);
            
            done(err);
        });
    });
    
    it('has mapped the configuration data to the config object', function() {
        assert.equal(config.a, 1);
    });

    it('can retrieve the dev config, which overrides elements of the default config', function(done) {
        config.use('dev', function(err, data) {
            assert.ifError(err);
            assert.equal(config._current, 'dev');
            assert.equal(data.a, 5);
            
            done(err);
        });
    });
    
    it('has mapped the dev config data to the config object', function() {
        assert.equal(config.a, 5);
    });
});