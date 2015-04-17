var mongoose = require('mongoose');
var findOrCreate = require('mongoose-findorcreate');


var igUserSchema = mongoose.Schema({
	"name" : { type: String },
	"id" : { type: String },
	"access_token" : { type: String }
});
igUserSchema.plugin(findOrCreate);
exports.igUser = mongoose.model('UserIG', igUserSchema);


var fbUserSchema = mongoose.Schema({
    "name" : { type: String },
    "id" : { type: String },
    "access_token" : { type: String }
});
fbUserSchema.plugin(findOrCreate);
exports.fbUser = mongoose.model('UserFB', fbUserSchema);