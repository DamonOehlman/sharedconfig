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
    
    it('can create a new config, and not wait for a connect event to continue', function() {
        config = sharedconfig('http://sidelab.iriscouch.com/sharedconfig');
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
    
    it('can use events to wait for config load', function(done) {
        config.use('test')
            .once('change', function(data, environment) {
                assert.equal(environment, 'test');
                assert.equal(data.a, 3);
                done();
            })
            .on('error', done);
    });
    
    it('has mapped the test data to the config object', function() {
        assert.equal(config.a, 3);
    });
    
    it('can respond to changes on a targeted property', function(done) {
        config.once('a.change', function(newValue) {
            assert.equal(newValue, 5);
            done();
        });
        
        config.use('dev');
    });
    
    it('has mapped the test data to the config obejct correctly', function() {
        assert.equal(config.a, 5);
    });
    
    it('can respond to changes on a targeted, nested properties', function(done) {
        config.once('redis.host.change', function(newValue) {
            assert.equal(newValue, 'redis.mysuperdomain.com');
            done();
        });
        
        config.use('prod');
    });
});