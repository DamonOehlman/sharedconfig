// Select iris couch as the couch test server if this test is running on travis
var couchHost = (process.env.NODE_ENV === 'travis')? 'http://damonoehlman.iriscouch.com' : 'http://127.0.0.1:5984';

var debug = require('debug')('sharedconfig-tests'),
    nano = require('nano')(couchHost),
    db = nano.use('sharedconfig-test'),
    async = require('async'),
    xdiff = require('xdiff'),
    _ = require('lodash'),
    docTemplates = {
        default: {
            a: 1,
            b: 3,

            redis: {
                host: 'localhost',
                port: 6379
            }
        },

        dev: {
            a: 5
        },

        test: {
            a: 3
        },

        stg: {

        },

        prod: {
            redis: {
                host: 'redis.mysuperdomain.com'
            }
        }
    };

function prime(name) {
    var tasks = [db.insert.bind(db, docTemplates[name], name)];

    return function(done) {
        debug('attempting to get "' + name + '" doc');

        // initialise the default settings
        db.get(name, function(err, body) {
            if(err && err.message === 'no_db_file') {
                // Create db then try to prime the document again
                return nano.db.create(db.config.db, prime.call(prime, name)(done));
            }

            // if the document exists, then remove it
            if (! err) {
                tasks.unshift(db.destroy.bind(db, name, body._rev));
            }

            debug('deleting and inserting "' + name + '" document as required.');
            async.series(tasks, done);
        });
    };
}

debug('using db host: ' + couchHost);
db.host = couchHost;

// patch in a prepare method
db.prepare = function(callback) {
    async.parallel([
        prime('default'),
        prime('dev'),
        prime('test'),
        prime('stg'),
        prime('prod')
    ], callback);
};

db.update = function(environment, data, callback) {
    var changes;

    db.get(environment, function(err, body) {
        var diffable;

        if (err) return callback(err);

        // get the diffable body
        diffable = _.filter(body, function(value, key) {
            return key[0] !== '_';
        });

        // get the diff between the two and apply the patch
        changes = xdiff.diff(diffable, data);

        // apply the changes and update the document
        db.insert(xdiff.patch(body, changes), callback);
    });
};

module.exports = db;
