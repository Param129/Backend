import express from "express";
const app=express();
import cookieParser from "cookie-parser";
import cors from "cors";



// All configurations
app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials:true
}));
app.use(express.json({limit:"20kb"}));//configuration to accept data in json format
app.use(express.urlencoded({extended:true,limit:"20kb"}));//configuration to accept data from url
app.use(express.static("public"));
app.use(cookieParser());






export {app};