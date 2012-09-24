var assert = require('assert'),
    sharedconfig = require('..'),
    testdb = require('./helpers/testdb'),
    config;

describe('filter tests', function() {
    before(testdb.prepare);

    it('should be able to connect to the config endpoint', function(done) {
        config = sharedconfig('http://damonoehlman.iriscouch.com/sharedconfig-test').on('connect', done);

        // ensure that the config is defined
        assert(config);
    });

    it('should be have initialized the environments array', function() {
        assert(config._environments.length > 0);
    });
    
    it('should be able to define a filter function', function() {
        config.filter = function(input) {
            return typeof input == 'string' ? input.toUpperCase() : input;
        };
        
        assert.equal(config.filter('test'), 'TEST');
    });

    it('can retrieve the full prod config', function(done) {
        var bUpdated = false;
        
        config.once('update.b', function() {
            bUpdated = true;
        });

        config.use('prod', function(err, data) {
            assert.ifError(err);
            assert(bUpdated, 'Invidividual update events were not fired on initial configutation load');
            assert.equal(config._current, 'prod');
            assert.equal(data.a, 1);
            assert.equal(data.redis.host, 'REDIS.MYSUPERDOMAIN.COM');

            done(err);
        });
    });

    it('has mapped the configuration data to the config object', function() {
        assert.equal(config.redis.host, 'REDIS.MYSUPERDOMAIN.COM');
    });

    it('can retrieve the dev config, which overrides elements of the default config', function(done) {
        config.use('dev', function(err, data) {
            assert.ifError(err);
            assert.equal(config._current, 'dev');
            assert.equal(data.a, 5);
            assert.equal(data.redis.host, 'LOCALHOST');

            done(err);
        });
    });

    it('has mapped the dev config data to the config object', function() {
        assert.equal(config.a, 5);
        assert.equal(config.redis.host, 'LOCALHOST');
    });
    
    it('can remove the filter', function() {
        delete config.filter;
    });

    it('can use events to wait for config load', function(done) {
        config.use('test')
            .once('changed', function(data, environment) {
                assert.equal(environment, 'test');
                assert.equal(data.a, 3);
                assert.equal(data.redis.host, 'localhost');

                done();
            })
            .on('error', done);
    });
});