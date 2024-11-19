import { Organizer } from '../models/organizer.model.js';
import { Image } from '../models/image.model.js';
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { createFolder } from '../utils/S3Utils.js';
import { options } from '../constants.js';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import sendVerificationMail from '../utils/mailingUtils/verificationMail.js';

const generateAcessAndRefreshTokens = async (organizerId) => {
    try {
        const organizer = await Organizer.findById(organizerId);
        const accessToken = organizer.generateAccessToken();
        const refreshToken = organizer.generateRefreshToken();
        organizer.refreshToken = refreshToken;
        await organizer.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
};

const registerOrganizer = asyncHandler(async (req, res) => {
    
    // get the data from the request body
    const { name, email, mobile, password, address } = req.body;

    if( 
        [name, email, mobile, password].some(field => field?.trim() === undefined || field?.trim() === null || field === "" )
    ){
        fs.unlinkSync(req.file?.path);
        throw new ApiError(400, "Please provide all the required fields");
    }

    const existedUser = await Organizer.findOne({
        $or: [{ email }, { mobile }]
    })

    if(existedUser){
        fs.unlinkSync(req.file?.path);
        throw new ApiError(409, "User with this email or mobile already exists");
    }

    const profilePicturePath = req.file?.path;

    if(!profilePicturePath){
        throw new ApiError(400, "Profile picture is required");
    }

    const folderName = `${name.split(" ").join("-").toLowerCase()}-${Date.now()}`;
    const createdFolder = await createFolder(folderName);

    if(!createdFolder){
        throw new ApiError(500, "Something went wrong while creating the folder");
    }

    const profilePicture = await Image.create({
        title: name + " Profile Picture",
        folderName,
        url: profilePicturePath
    });

    if(!profilePicture){
        throw new ApiError(500, "Something went wrong while creating the profile picture");
    }

    const organizer = await Organizer.create({
        name,
        email,
        mobile,
        profilePicture : profilePicture._id,
        folderName,
        password,
        address : address || ""
    });

    const mailSent = await sendVerificationMail("organizers", organizer._id, email);

    if(!mailSent){
        await Organizer.findByIdAndDelete(organizer._id);
        throw new ApiError(500, "Failed to send verification mail");
    }

    const createdOrganizer = await Organizer.findById(organizer._id).select(
        "-password -refreshToken"
    )

    if(!createdOrganizer){
        throw new ApiError(500, "Something went wrong while creating the user");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(201, createdOrganizer, "Organizer created successfully")
    );
});

const loginOrganizer = asyncHandler(async (req, res) => {

    // get organizer details from frontend
    const { email, mobile, password } = req.body;

    // check if email or mobile is provided
    if (!email && !mobile) {
        throw new ApiError(400, "Email or mobile is required");
    }

    // find the organizer with email or mobile
    const organizer = await Organizer.findOne({
        $or: [{ email }, { mobile }]
    });

    // check if organizer exists 
    if (!organizer) {
        throw new ApiError(404, "Organizer not found");
    }

    // check if password is correct
    const isPasswordCorrect = await organizer.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid organizer credentials");
    }

    if(!organizer.verified){
        throw new ApiError(402, "Organizer Email not verified");
    }

    // generate access and refresh token
    const { accessToken, refreshToken } = await generateAcessAndRefreshTokens(organizer._id);

    // save refresh token to the organizer
    organizer.refreshToken = refreshToken;
    await organizer.save({ validateBeforeSave: false });

    // send cookie
    const loggedInOrganizer = await Organizer.findById(organizer._id).select("-password -refreshToken");

    return res
        .status(200)
        .cookie("accessToken", accessToken, { options })
        .cookie("refreshToken", refreshToken, { options })
        .json(
            new ApiResponse(200,
                { organizer: loggedInOrganizer, accessToken, refreshToken },
                "Organizer logged in successfully")
        );
});

const logoutOrganizer = asyncHandler(async (req, res) => {
    await Organizer.findByIdAndUpdate(req.user?._id, 
        { 
            $unset: { refreshToken: 1 }
        },
        { new: true }
    );

    return res
    .status(200)
    .clearCookie("accessToken", {options})
    .clearCookie("refreshToken", {options})
    .json(
        new ApiResponse(200, {}, "Organizer logged out successfully")
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken || req.headers["x-refresh-token"];

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    const organizer = await Organizer.findById(decodedToken._id);

    if(!organizer){
        throw new ApiError(404, "Organizer not found");
    }

    if(incomingRefreshToken !== organizer?.refreshToken){
        throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } = await generateAcessAndRefreshTokens(organizer._id);

    organizer.refreshToken = refreshToken;
    await organizer.save({ validateBeforeSave: false });

    return res
    .status(200)
    .cookie("accessToken", accessToken, {options})
    .cookie("refreshToken", refreshToken, {options})
    .json(
        new ApiResponse(200, { accessToken, refreshToken }, "Token refreshed successfully")
    )
})

const updateOrganizerPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if(!oldPassword || !newPassword){
        throw new ApiError(400, "Old password and new password are required");
    }

    const organizer = await Organizer.findById(req.user?._id);
    if(!organizer){
        throw new ApiError(404, "Organizer not found");
    }

    const isPasswordCorrect = await organizer.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid old password");
    }
    
    organizer.password = newPassword;
    await organizer.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Password updated successfully")
    )

});

const getCurrentOrganizer = asyncHandler(async (req, res) => {
    const organizer = await Organizer.aggregate([
        {
            $match: { _id: req.user?._id }
        },
        {
            $lookup: {
                from: "images",
                localField: "profilePicture",
                foreignField: "_id",
                as: "profilePicture",
                pipeline: [
                    {
                        $project: {
                            title: 1,
                            url: 1,
                            _id: 0
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$profilePicture"
        },
        {
            $lookup: {
                from: "events",
                localField: "_id",
                foreignField: "createdBy",
                as: "events",
                pipeline: [
                    {
                        $lookup: {
                            from: "images",
                            localField: "image",
                            foreignField: "_id",
                            as: "image",
                            pipeline: [
                                {
                                    $project: {
                                        title: 1,
                                        url: 1,
                                        _id: 0
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $lookup: {
                            from : "images",
                            localField: "coverImage",
                            foreignField: "_id",
                            as: "coverImage",
                            pipeline: [
                                {
                                    $project: {
                                        title: 1,
                                        url: 1,
                                        _id: 0
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            description: 1,
                            startDate: 1,
                            endDate: 1,
                            location: 1,
                            date : 1,
                            time: 1,
                            image: 1,
                            coverImage: 1,
                            status: 1
                        }
                    },
                    
                ]
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0,
                folderName: 0,
            }
        }
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(200, organizer, "Current Organizer found successfully")
    )
});

const updateOrganizerDetails = asyncHandler(async (req, res) => {
    const { name, email, mobile, address } = req.body;
    if(!name || !email || !mobile || !address){
        throw new ApiError(400, "Name, Email, Mobile and Address are required");
    }

    const organizer = await Organizer.findByIdAndUpdate(req.user?._id, 
        {
            $set: { 
                name, 
                email,
                mobile,
                address,
                folderName
            }
        },
        { new: true }
    ).select("-password");

    if(!organizer){
        throw new ApiError(500, "Something went wrong while updating the organizer details");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, organizer, "Organizer details updated successfully")
    )
});

const updateProfilePicture = asyncHandler(async (req, res) => {
    const profilePicturePath = req.file?.path;
    if(!profilePicturePath){
        throw new ApiError(400, "Profile picture is required");
    }

    const profilePicture = await Image.create({
        title: req.user?.name + " Profile Picture",
        url: profilePicturePath
    });

    if(!profilePicture){
        throw new ApiError(500, "Something went wrong while uploading the profile picture");
    }

    const oldProfilePicture = req.user?.profilePicture;
    if(oldProfilePicture){
        await Image.findByIdAndDelete(oldProfilePicture);
    }

    const organizer = await Organizer.findByIdAndUpdate(req.user?._id,
        {
            $set: { profilePicture }
        },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(200, organizer, "Profile picture updated successfully")
    )
})

const deleteOrganizer = asyncHandler(async (req, res) => {
    const organizer = await Organizer.findById(req.user?._id);

    if (!organizer) {
        throw new ApiError(404, "Organizer not found");
    }

    const deletedOrganizer = await Organizer.findByIdAndDelete(req.user?._id);

    if (!deletedOrganizer) {
        throw new ApiError(500, "Something went wrong while deleting the organizer");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Organizer deleted successfully")
        );
});

const getEvents = asyncHandler(async (req, res) => {
    const events = await Organizer.aggregate([
        {
            $match: { _id: req.user?._id }
        },
        {
            $lookup: {
                from: "events",
                localField: "_id",
                foreignField: "createdBy",
                as: "events",
                pipeline: [
                    {
                        $lookup: {
                            from: "images",
                            localField: "image",
                            foreignField: "_id",
                            as: "image",
                            pipeline: [
                                {
                                    $project: {
                                        title: 1,
                                        url: 1,
                                        _id: 0
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $lookup: {
                            from : "images",
                            localField: "coverImage",
                            foreignField: "_id",
                            as: "coverImage",
                            pipeline: [
                                {
                                    $project: {
                                        title: 1,
                                        url: 1,
                                        _id: 0
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $project: {
                            __id: 0,
                            description: 0,
                            time: 0,
                            location: 0,
                            gallery: 0,
                            type: 0,
                            capacity: 0,
                            qrCode: 0,
                            attendees: 0,
                            createdBy: 0,
                            createdAt: 0,
                            updatedAt: 0,
                            __v: 0
                        }
                    },
                    
                ]
            }
        },
        {
            $project: {
                __id: 0,
                address: 0,
                password: 0,
                refreshToken: 0,
                createdAt: 0,
                updatedAt: 0,
                __v: 0,
                createdEvents: 0,
                folderName: 0,
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(200, events, "Events found successfully")
        );
});

export { 
    registerOrganizer, 
    loginOrganizer,
    logoutOrganizer,
    refreshAccessToken,
    updateOrganizerPassword,
    getCurrentOrganizer,
    updateOrganizerDetails,
    updateProfilePicture,
    deleteOrganizer,
    getEvents
}