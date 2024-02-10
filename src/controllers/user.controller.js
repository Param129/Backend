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



const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid password");
    }

    user.password=newPassword;
    await user.save({validateBeforeSave:false});

    return res.status(200)
    .json(new ApiResponse(200,{},"password change successfully"));

})


const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(200,req.user,"current user fetched successfully");
})



 const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body;

    if(!fullName || !email){
        throw new ApiError(400,"all fields are required");
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
            {
                $set:{
                    fullName,
                    email:email
                }
            },
            {
                new:true
            }
        ).select("-password")

        return res.status(200)
        .json(new ApiResponse(200,{user},"Account details updated successfully"));

 })


const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is misssing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400,"erroe whileupdating avatar");
    }

    const user  = await User.findByIdAndUpdate(req.user._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new:true
        }
    )

    return res.status(200)
    .json(new ApiResponse(200),{user},"avatar updated successfully");

})


const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"coverImage is misssing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400,"erroe while updating coverImage");
    }

    const user = await User.findByIdAndUpdate(req.user._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {
            new:true
        }
    )

    return res.status(200)
    .json(new ApiResponse(200),{user},"coverImage updated successfully");

})



const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})



export {registerUser,loginUser,logoutUser,refershAccessToken,changeCurrentPassword,getCurrentUser,updateAccountDetails,updateUserAvatar,updateUserCoverImage,getUserChannelProfile}