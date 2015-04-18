var mongoose = require('mongoose');
var findOrCreate = require('mongoose-findorcreate');


var igUserSchema = mongoose.Schema({
	"ig_name" : { type: String },
	"ig_id" : { type: String },
	"ig_access_token" : { type: String }
});
igUserSchema.plugin(findOrCreate);
exports.igUser = mongoose.model('UserIG', igUserSchema);


var fbUserSchema = mongoose.Schema({
    "fb_name" : { type: String },
    "fb_id" : { type: String },
    "fb_access_token" : { type: String }
});
fbUserSchema.plugin(findOrCreate);
exports.fbUser = mongoose.model('UserFB', fbUserSchema);