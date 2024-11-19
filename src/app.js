import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

// routes import
import organizerRouter from "./routes/organizer.routes.js";
import eventRouter from "./routes/event.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({
    limit: "20kb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "20kb"
}));

app.use(express.static("public"));

app.use(cookieParser());

// routes declaration
app.use("/api/v1/organizers", organizerRouter);
app.use("/api/v1/events", eventRouter);
app.use("/api/v1/users", userRoutes);

export { app }