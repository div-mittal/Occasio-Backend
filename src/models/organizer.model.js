import mongoose, { Schema } from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { Image } from "./image.model.js"
import { Event } from "./event.model.js"
import { deleteFolder } from "../utils/S3Utils.js"

const organizerSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        mobile: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        password: {
            type: String,
            required: [true, "Password is required"],
        },
        verified: {
            type: Boolean,
            default: false
        },
        address: {
            type: String
        },
        profilePicture: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Image"
        },
        folderName: {
            type: String,
            required: true
        },
        createdEvents: [
            {
                type: Schema.Types.ObjectId,
                ref: "Event"
            }
        ],
        refreshToken: {
            type: String,
        }
    },
    {
        timestamps: true
    }
)

organizerSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

organizerSchema.pre('findOneAndDelete', async function (next) {
    const organizer = await this.model.findOne(this.getQuery());
    if (organizer) {
        if(organizer.folderName) {
            await deleteFolder(organizer.folderName);
        }
        if (organizer.profilePicture) {
            await Image.findByIdAndDelete(organizer.profilePicture);
        }
        if(organizer.createdEvents) {
            for (const event of organizer.createdEvents) {
                await Event.findByIdAndDelete(event);
            }
        }
    }
    next();
});

organizerSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

organizerSchema.methods.generateAccessToken = function () {
    return jwt.sign({
        _id: this._id,
        email: this.email,
        mobile: this.mobile,
        name : this.name
    }, 
    process.env.ACCESS_TOKEN_SECRET, {
        
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    });
};

organizerSchema.methods.generateRefreshToken = function () {
    return jwt.sign({
        _id: this._id
    }, 
    process.env.REFRESH_TOKEN_SECRET, {
        
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    });
};

export const Organizer = mongoose.model("Organizer", organizerSchema)