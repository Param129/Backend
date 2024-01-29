import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import jwt from "jsonwebtoken";



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



const generateAccessAndRefreshToken = async(userId)=>{
    try{

       const user= await User.findById(userId); 
       const accessToken = user.generateAccessToken();
       const refreshToken = user.generateRefreshToken();

       // saving refershtoken to db
       user.refreshToken=refreshToken;
       await user.save({validateBeforeSave:false});

       return {accessToken,refreshToken};

    }catch(error){
        throw new ApiError(500,"Something went wrong while generating access and refresh token");
    }
}



const loginUser = asyncHandler(async(req,res) =>{
    //req body se data lelo
    //username or email 
    //find the user
    //password check
    //give access and refresh token
    //send token in cookies

    const {email,username,password} = req.body;
    if(!username && !email){
        throw new ApiError(400,"Credentials are required");
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })


    if(!user){
        throw new ApiError(404,"User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Password incorrect!");
    }


    // generating access and refresh token from above function we created
    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);

    // removing extra fields from user that we dont want to send after logging in
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // sending token in cookies
    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{user:loggedInUser,accessToken,refreshToken},"User logged in successfully")
    )

})



const logoutUser = asyncHandler(async(req,res)=>{

    await User.findByIdAndUpdate(req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
        )

    const option = {
        httpOnly:true,
        secure:true
    }

    return res.status(200)
    .clearCookie("accessToken",option)
    .clearCookie("refreshToken",option)
    .json(new ApiResponse(200,{},"User logeed out successfully"));
})


const refershAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken  || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request");
    }

    try{

        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401,"Invalid refresh token");
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"refersh token is expired");
        }

        const options = {
            httpOnly:true,
            secure:true
        }

        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id);

        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(200,{accessToken,refreshToken:newRefreshToken},"Access token refreshed"))



    }catch(error){
        throw new ApiError(401,"Invalid refersh token");
    }

})


export {registerUser,loginUser,logoutUser,refershAccessToken}