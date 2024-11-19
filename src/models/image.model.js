import mongoose, {Schema} from "mongoose";
import { uploadFile, deleteFile } from "../utils/S3Utils.js";

const imageSchema = new Schema(
    {
        title: {
            type: String,
            required: true
        },
        folderName: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
)

imageSchema.pre('save', async function (next) {
    if (this.isNew) {
        const Location = await uploadFile(this.url, this.folderName);
        if (!Location) {
            throw new Error("Image upload failed");
        }
        this.url = Location;
    }
    next();
});

imageSchema.pre('findOneAndDelete', async function (next) {
    const docToDelete = await this.model.findOne(this.getQuery());
    if (docToDelete) {
        await deleteFile(docToDelete.url, docToDelete.folderName);
    }
    next();
});

export const Image = mongoose.model("Image", imageSchema)