import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { Organizer } from "../models/organizer.model.js";
import { verifyOrganizerMail } from "../utils/mailingUtils/verifyMail.js";

import { registerOrganizer, loginOrganizer, logoutOrganizer, refreshAccessToken, updateOrganizerPassword, getCurrentOrganizer, updateOrganizerDetails, updateProfilePicture, deleteOrganizer, getEvents } from "../controllers/organizer.controller.js";

const router = Router();

router.route("/register").post(
    upload.single("profilePicture"),
    registerOrganizer
);

router.route("/login").post(
    loginOrganizer
);

router.route("/verify/:id").get(
    verifyOrganizerMail
);

router.route("/logout").post(
    verifyJWT(Organizer),
    logoutOrganizer
);

router.route("/refresh-token").post(
    refreshAccessToken
);

router.route("/update-password").post(
    verifyJWT(Organizer),
    updateOrganizerPassword
);

router.route("/me").get(
    verifyJWT(Organizer),
    getCurrentOrganizer
);

router.route("/update-details").patch(
    verifyJWT(Organizer),
    updateOrganizerDetails
);

router.route("/update-profile-picture").patch(
    verifyJWT(Organizer),
    upload.single("profilePicture"),
    updateProfilePicture
);

router.route("/events").get(
    verifyJWT(Organizer),
    getEvents
);

router.route("/delete").delete(
    verifyJWT(Organizer),
    deleteOrganizer
);

export default router;
