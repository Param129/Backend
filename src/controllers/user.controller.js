import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"

const registerUser = asyncHandler( async(req,res)=>{
    //get user details from frontend;
    //validation - not empty
    //check if user already exist:username,email
    //check for images,check for avatar
    //upload them to cloudinary
    //create a user object --create entry in db
    //remove password and refresh token field from response
    //check for user creation and return response
    
    const {fullName,email,username,password} = req.body;


                        //   VALIDATION
    // this is one method for validation you can do this for all fields

    /*
    if(fullName===""){
        throw new ApiError(400,"fullname is required")
    }
    */


    // here we can pass array of all fields we want to validate and some fun return bool val false if any of field is empty.
    if([fullName,email,username,password].some((field)=>field ?.trim() === "")){
        throw new ApiError(400,"All fields are required");
    }

    // check if user already exist 
    //we simple check for for email if it exist but we use operator that checks for many fields
    const existedUser = await User.findOne({
        $or:[{email},{username}] // check for both email and username and return if any of them exist
    })

    if(existedUser){
        throw new ApiError(409,"User already exist");
    }

    //handling for images
    const avatarLocalpath = req.files ?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalpath){
        throw new ApiError(400,"Avatar file is required");
    }

    // uploding to cloudinary from local
    const avatar = await uploadOnCloudinary(avatarLocalpath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar is required");
    }


    // creating object of user
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // checking if user created and founded and removing fields like password
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new ApiError(500,"user not created or founded");
    }

    // returning response
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )

})




export {registerUser}