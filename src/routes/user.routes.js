import { Router } from "express";
const router=Router();

import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

import {loginUser, logoutUser, refershAccessToken, registerUser} from "../controllers/user.controller.js"


// registering a user
router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser);

//secured route
router.route("/logout").post(verifyJWT,logoutUser);
router.route("/refresh-token").post(refershAccessToken)


export default router;