import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config();

connectDB()
.then(() => {

    app.get("/", (req, res) => {
        res.send("Hello World");
    });
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port http://localhost:${process.env.PORT}/`);
    });
})
.catch((error) => {
    console.log("MongoDB connection error",error);
    process.exit(1);
});
