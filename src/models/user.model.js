import mongoose,{Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";



const userSchema = new Schema({
    
        username:{
            type:String,
            required:true,
            unique:true,
            index:true,
            lowercase:true,
            trim:true,
        },
        email:{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true,
        },
        fullName:{
            type:String,
            required:true,
            trim:true,
            index:true,
        },
        avatar:{
            type:String, //cloudinary
            required:true
        },
        coverImage:{
            type:String  // cloudinary
        },
        watchHistory:[
            {
                type:Schema.types.ObjectId,
                ref:"Video"
            }
        ],
        password:{
            type:String,
            required:[true,"Password is required"]
        },
        refreshToken:{
            type:String
        }
},{timestamps:true})


// just before press save button this will execute
userSchema.pre("save",async function(next) {
    if(! this.isModified("password")) return next(); // if pass is not modified just return dont execute further

    this.password = bcrypt.hash(this.password,10); // if password is modiefied then creae a new hash and save it.
    next();
})



// adding my own method in mongoose to check if hashed password and entered password is correct
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password,this.password); // it returns true or false
}



// access token is just for ccessing the data it is not saved in DB
// but refresh token is saved in DB
// generatin access token
userSchema.methods.generateAccessToken = function(){
    return jwt.sign({
        _id:this._id,
        email:this.email,
        username:this.username,
        fullName:this.fullName
    },process.env.ACCESS_TOKEN_SECRET,{expiresIn:process.env.ACCESS_TOKEN_EXPIRY})
}



//generating refresh token
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign({
        _id:this._id
    },process.env.REFRESH_TOKEN_SECRET,{expiresIn:process.env.REFRESH_TOKEN_EXPIRY})
}


export const User = mongoose.model("User",userSchema);