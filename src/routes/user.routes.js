import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { User } from "../models/user.model.js";
import { verifyUserMail } from "../utils/mailingUtils/verifyMail.js";

import { registerUser, loginUser, logoutUser, refreshAccessToken, updateUserPassword, updateUserDetails, getAttendedEvents } from "../controllers/user.controller.js";

const router = Router();

router.route("/register").post(
    registerUser
)

router.route("/verify/:id").get(
    verifyUserMail
)

router.route("/login").post(
    loginUser
)

router.route("/logout").post(
    verifyJWT(User),
    logoutUser
)

router.route("/refresh-token").post(
    refreshAccessToken
)

router.route("/update-password").post(
    verifyJWT(User),
    updateUserPassword
)

router.route("/update-details").patch(
    verifyJWT(User),
    updateUserDetails
)

router.route("/get-events").get(
    verifyJWT(User),
    getAttendedEvents
)

export default router;