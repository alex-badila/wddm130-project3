const express = require("express");
const path = require("path");
const {check, validationResult} = require('express-validator');
const mongoose = require("mongoose");
const session = require("express-session");
const fileUpload = require("express-fileupload");

const Page = mongoose.model("Page", {
    title: String,
    image: String,
    body: String
});

const Admin = mongoose.model("Admin", {
    username: String,
    password: String
});

const app = express();

app.use(fileUpload());

app.use(session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: true
}));

// Connection caching for serverless
let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    await mongoose.connect("mongodb+srv://alexbadila:Yo3kpaxy@cluster0.bwb3wky.mongodb.net/CMSWebsite");
    isConnected = true;
}

// app.get("/setup", async (req, res) => {
//     await connectDB();
//     const admin = new Admin({
//         username: "alex",
//         password: "Yo3kpaxy"
//     });
//     admin.save().then(data => {
//         res.send("Admin created: " + JSON.stringify(data));
//     }).catch(err => {
//         res.send("Error: " + err);
//     });
// });

app.use(express.urlencoded({extended: false}));
app.set("views", path.join(__dirname, "views"));
app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");

// Render the page for adding a new page if the user is logged in
app.get("/newPage", async (req, res) => {
    if(req.session.loggedIn) {
        res.render("newPage");
    }
    else {
        res.redirect("/login");
    }
});

// Process the form for making a new page
app.post("/processForm", [
    check("title", "Title is empty").notEmpty(),
    check("body", "Body is empty").notEmpty()
], async (req, res) => {
    const errors = validationResult(req);

    if (!req.files || !req.files.image) {
        return res.render("newPage", { errors: [{ msg: "Image is empty" }] });
    }

    if(errors.isEmpty()) {
        let title = req.body.title;
        let imageName = req.files.image.name;
        let image = req.files.image;
        let imagePath = "public/images/" + imageName;
        let body = req.body.body;

        image.mv(imagePath, function(err) {
            console.log(err);
        });

        let newPageInfo = {
            "title": title,
            "image": imageName,
            "body": body
        }

        await connectDB();
        let newPage = new Page({
            title: newPageInfo.title,
            image: newPageInfo.image,
            body: newPageInfo.body
        });

        newPage.save().then(data => {
            res.redirect("/");
        }).catch(err => {
            console.log("Data Saving Error!!!");
        });

    } else {
        res.render("newPage", {errors: errors.array()});
    }
});

// Render a specific page that has been created by the user
app.get("/page/:id", async (req, res) => {
    if(req.session.loggedIn) {
        await connectDB();
        const page = await Page.findById(req.params.id);
        res.render("page", { page: page });
    } else {
        res.redirect("/login");
    }
});

// Render the home page if the user is logged in
app.get("/", async (req, res) => {
    if(req.session.loggedIn) {
        await connectDB();
        const pages = await Page.find();  // Fetch all pages
        res.render("home", { data: pages, logged:{
                    name: req.session.user,
                    status: req.session.loggedIn
        }});  // Pass them as "data", along with the logged in status
    }
    else {
        res.redirect("/login");
    }
});

// Render the login page
app.get("/login", async (req, res) => {
    res.render("login");
});

// Take in the login information and validate it
// Go to the home page if it's correct
app.post("/login", [
    check("uname", "UserName Empty").notEmpty(),
    check("pass", "Password Empty").notEmpty()
], async (req, res) => {
    let errors = validationResult(req);

    if(errors.isEmpty())
    {
        await connectDB();
        Admin.findOne({ username: req.body.uname }).then((data) => {
            if (data === null || data.password !== req.body.pass) {
                res.render("login", { loginError: "Username or Password Incorrect" });
            } 
            else {
                req.session.loggedIn  = true;
                req.session.user = data.username;
                // res.render("home", {logged:{
                //     name: req.session.user ,
                //     status: req.session.loggedIn
                // }});
                res.redirect("/");
            }
        }).catch((err) => {
            console.log(err);
        });
    }
});

// Logs the user out of the session
app.get("/logout", async (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// Export for Vercel
module.exports = app;

// Only listen when running locally
if (process.env.NODE_ENV !== "production") {
    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}