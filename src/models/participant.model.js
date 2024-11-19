import mongoose, {Schema} from "mongoose";
import qrcode from "qrcode";

const participantSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        event: {
            type: Schema.Types.ObjectId,
            ref: "Event"
        },
        rsvpStatus: {
            type: String,
            enum: ["going", "not-going", "maybe", "checked-in"],
            default: "not-going"
        },
        badge: {
            type: String,
            default: "none"
        },
        preferences: {
            type: String
        },
        qrCode: {
            type: String
        }
    },
    {
        timestamps: true
    }
)

participantSchema.pre("save", async function(next){
    this.qrCode = await qrcode.toDataURL(`${this._id}`)
    .then((url) => {
        return url;
    })
    .catch((err) => {
        throw new Error("QR Code generation failed");
    })
    next();
})

export const Participant = mongoose.model("Participant", participantSchema)