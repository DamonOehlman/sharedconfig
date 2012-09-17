var debug = require('debug')('sharedconfig-tests'),
    nano = require('nano'),
    db = nano('http://sidelab.iriscouch.com/sharedconfig'),
    async = require('async'),
    docTemplates = {
        default: {
            a: 1
        },
        
        dev: {
            a: 5
        },
        
        test: {
            
        },
        
        stg: {
            
        },
        
        prod: {
            
        }
    };
    
function prime(name) {
    var tasks = [db.insert.bind(db, docTemplates[name], name)];
    
    return function(done) {
        debug('attempting to get "' + name + '" doc');
        
        // initialise the default settings
        db.get(name, function(err, body) {
            // if the document exists, then remove it
            if (! err) {
                tasks.unshift(db.destroy.bind(db, name, body._rev));
            }
            
            debug('deleting and inserting "' + name + '" document as required.');
            async.series(tasks, done);
        });    
    };
}
    
// patch in a prepare method
db.prepare = function(callback) {
    /*
    async.parallel([
        prime('default'),
        prime('dev'),
        prime('test'),
        prime('stg'),
        prime('prod')
    ], callback);
    */
    
    callback();
};
    
module.exports = db;