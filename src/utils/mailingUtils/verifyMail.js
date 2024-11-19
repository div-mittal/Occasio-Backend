import { User } from "../../models/user.model.js";
import { Organizer } from "../../models/organizer.model.js";
import { ApiResponse } from "../ApiResponse.js";
import { ApiError } from "../ApiError.js";


const verifyMail = (model) => async (req, res, next) => {
    const { id } = req.params;
    try {
        const user = await model.findById(id);
        if (!user) {
            return res.status(400).json({ message: "Invalid Verification Link" });
        }
        user.verified = true;
        await user.save({ validateBeforeSave: false });

        res.setHeader("Content-Type", "text/html");
        res.write(`<h1>Email Verified</h1><br>
            <p>Your email has been successfully verified. You can now login to your account.</p><br>
            <a href="${process.env.FRONTEND_URL}/login">Go to Login</a>`);
    }
    catch (error) {
        throw new ApiError(500, "Error verifying email");
    }
}

// Usage
export const verifyUserMail = verifyMail(User);
export const verifyOrganizerMail = verifyMail(Organizer);