import { Participant } from "../models/participant.model.js";
import { Event } from "../models/event.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { sendMail } from "../utils/mailingUtils/mailSender.js";
import { Organizer } from "../models/organizer.model.js";

const sendRegistrationMail = async (participant) => {
    const event = await Event.findById(participant.event);
    const user = await User.findById(participant.user);
    const organizer = await Organizer.findById(event.createdBy)

    const eventDate = new Date(event.date);
    const eventDateString = eventDate.toLocaleDateString();
    const eventTimeString = eventDate.toLocaleTimeString();

    const message = `Hello ${user.name},<br><br>You have successfully registered for the event ${event.name}.<br><br>Event Details:<br>Date: ${eventDateString}<br>Time: ${eventTimeString}<br>Venue: ${event.location}<br>City: ${event.city}<br>State: ${event.state}<br><br>Badge: ${participant.badge}<br>Preferences: ${participant.preferences}<br><br>Thank you for registering for the event. We look forward to seeing you there.<br><br>Regards,<br>${organizer.name}`;

    const mailOptions = {
        to: user.email,
        subject: `Registration for ${event.title} Successful`,
        html: message
    };

    const mailResponse = await sendMail(mailOptions);

    if(mailResponse.status !== 200){
        throw new ApiError(500, "Failed to send registration mail");
    }
}

const checkParticipant = asyncHandler(async (req, res, next) => {
    const { eventID } = req.params;
    if(!eventID){
        throw new ApiError(400, "Event ID is required");
    }

    const event = await Event.findById(eventID);

    if(!event){
        throw new ApiError(404, "Event not found");
    }

    if(!event.registrationsEnabled){
        throw new ApiError(400, "Registrations are closed for this event");
    }
    
    const user = await User.findById(req.user._id);
    if(!user){
        throw new ApiError(404, "User not found");
    }

    const participant = await Participant.findOne({
        user: user._id,
        event: event._id
    });

    if(!participant){
        throw new ApiError(404, "User not registered for event");
    }

    return res
    .status(200).json(
        new ApiResponse(200, participant, "Participant found")
    );

})

const registerForEvent = asyncHandler(async (req, res, next) => {
    const { eventID } = req.params;
    const { badge, preferences } = req.body;

    const event = await Event.findById(eventID);

    if(!event){
        throw new ApiError(404, "Event not found");
    }

    const user = await User.findById(req.user._id);

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const existingParticipant = await Participant.findOne(
        {user: user._id, event: event._id}
    );

    if(existingParticipant){
        throw new ApiError(400, "User already registered for event");
    }

    const participant = await Participant.create({
        user: user._id,
        event: event._id,
        badge,
        preferences
    });

    await event.registerParticipant(participant._id);

    user.eventHistory.push(event._id);
    await user.save({
        validateBeforeSave: false
    });

    await sendRegistrationMail(participant);

    const createdParticipant = await Participant.aggregate([
        {
            $match: {
                _id: participant._id
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
                pipeline: [
                    {
                        $project: {
                            password: 0,
                            eventHistory: 0,
                            refreshToken: 0,
                            createdAt: 0,
                            updatedAt: 0,
                            __v: 0
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$user"
        },
        {
            $lookup: {
                from: "events",
                localField: "event",
                foreignField: "_id",
                as: "event",
                pipeline: [
                    {
                        $project: {
                            image: 0,
                            coverImage: 0,
                            gallery: 0,
                            attendees: 0,
                            qrCode: 0,
                            type: 0,
                            capacity: 0,
                            createdAt: 0,
                            updatedAt: 0,
                            __v: 0
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$event"
        },
    ]);

    if(!createdParticipant){
        throw new ApiError(500, "Failed to register for event");
    }

    return res
    .status(201).json(
        new ApiResponse(201, createdParticipant, "Registered for event successfully")
    );
})

const updateDetails = asyncHandler(async (req, res, next) => {
    const { eventID } = req.params;
    const { badge, preferences } = req.body;

    const event = await Event.findById(eventID);

    if(!event){
        throw new ApiError(404, "Event not found");
    }

    const user = await User.findById(req.user._id);

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const participant = await Participant.findOneAndUpdate(
        {user: user._id, event: event._id},
        {badge, preferences},
        {new: true}
    );

    return res
    .status(200).json(
        new ApiResponse(200, participant, "Participant details updated successfully")
    );
})

const unregisterFromEvent = asyncHandler(async (req, res, next) => {
    const { eventID } = req.params;

    const event = await Event.findById(eventID);

    if(!event){
        throw new ApiError(404, "Event not found");
    }

    const user = await User.findById(req.user._id);

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const participant = await Participant.findOneAndDelete({
        user: user._id,
        event: event._id
    });

    if(!participant){
        throw new ApiError(404, "User not registered for event");
    }

    event.attendees = event.attendees.filter(
        attendee => attendee.toString() !== participant._id.toString()
    );

    await event.save({
        validateBeforeSave: false
    });

    user.eventHistory = user.eventHistory.filter(
        event => event.toString() !== event._id.toString()
    );

    await user.save({
        validateBeforeSave: false
    });

    return res
    .status(200).json(
        new ApiResponse(200, {}, "Unregistered from event successfully")
    );
})

const updateRSVPStatus = asyncHandler(async (req, res, next) => {
    const { eventID } = req.params;
    const { rsvpStatus } = req.body;

    const event = await Event.findById(eventID);

    if(!event){
        throw new ApiError(404, "Event not found");
    }

    const user = await User.findById(req.user._id);

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const participant = await Participant.findOneAndUpdate(
        {user: user._id, event: event._id},
        {rsvpStatus},
        {new: true}
    );

    return res
    .status(200).json(
        new ApiResponse(200, participant, "RSVP status updated successfully")
    );
})


export {
    registerForEvent,
    checkParticipant,
    updateDetails,
    unregisterFromEvent,
    updateRSVPStatus
}