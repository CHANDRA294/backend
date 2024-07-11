const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const Payments = require('./models/Payments.js');
const Users = require('./models/Users.js');
const TableAudit = require('./models/TableAudit.js');
require('dotenv/config'); // Load environment variables

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from 'public' directory

// Session middleware
app.use(session({
    secret: '123', // Replace with process.env.SESSION_SECRET in production
    saveUninitialized: true,
    resave: false,
    cookie: {
        httpOnly: true,
        maxAge: 3600000 // 1 hour (replace with parseInt(process.env.SESSION_MAX_AGE) in production)
    }
}));

// Database connection
mongoose.connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Connected!');
}).catch((err) => {
    console.error('MongoDB Connection Error:', err);
});

// Routes

// Route to handle reservation generation and session management
app.post('/genTable', async(req, res) => {
    try {
        // Handle reservation logic and session data management
        var highTraffic = false;
        if (req.body.highTraffic === "on") {
            highTraffic = true;
        }
        req.session.highTraffic = highTraffic;

        const fname = req.body.fname;
        const lname = req.body.lname;
        const email = req.body.email;
        const phone = req.body.phone;
        const comment = req.body.comment;
        const totalGuest = req.body.totalGuest;
        const resDate = req.body.resDate;
        const timeFrame = req.body.timeFrame;

        // Logic to find available tables and update session
        // Replace with your actual logic for finding tables, setting session variables, etc.

        // Example: Save reservation details to MongoDB
        const newBooking = new TableAudit({
            totalGuests: totalGuest,
            resDate: resDate,
            timeFrame: timeFrame,
            fname: fname,
            lname: lname,
            email: email,
            phone: phone,
            comment: comment,
            // Add more fields as needed
        });

        await newBooking.save();
        console.log('New reservation added to TableAudit.');

        // Redirect to the next step
        res.redirect('/fee');
    } catch (err) {
        console.error('Error processing reservation:', err);
        res.status(500).redirect('/error-page'); // Redirect to error page on error
    }
});

// Route to handle guest reservation
app.post('/guest', async(req, res) => {
    req.session.guest = true;
    req.session.user = '';
    req.session.userID = '';
    res.redirect('/reserve');
});

// Route to handle user login
app.post('/login', async(req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    try {
        const user = await Users.findOne({ username: username });

        if (!user || password !== user.password) {
            console.log('Wrong username or password');
            res.redirect('/login-fail');
        } else {
            console.log('Login successful!');
            req.session.guest = false;
            req.session.user = username;
            req.session.userID = user._id;
            res.redirect('/reserve');
        }
    } catch (err) {
        console.error('Error logging in user:', err);
        res.status(500).redirect('/login-fail'); // Redirect to login failure page on error
    }
});

// Route to handle user registration
app.post('/register', async(req, res) => {
    const { name, email, username, password } = req.body;

    try {
        const existingUser = await Users.findOne({ username: username });

        if (existingUser) {
            console.log('User already exists');
            res.redirect('/register-fail');
        } else {
            const newUser = new Users({
                username: username,
                password: password,
                name: name,
                email: email,
                isGuest: false
            });

            await newUser.save();
            console.log('New user created:', newUser.username);
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).redirect('/register-fail'); // Redirect to registration failure page on error
    }
});

// Route to handle payment processing
app.post('/fee', async(req, res) => {
    const { paymentType, cardBrand, cardNumber, expDate, cardHolder, cvv, billingAddress, zipCode, dinerNum, mailingAddress, points } = req.body;

    try {
        const payment = new Payments({
            paymentType: paymentType,
            cardBrand: cardBrand,
            cardNumber: cardNumber,
            expDate: expDate,
            cardHolder: cardHolder,
            cvv: cvv,
            billingAddress: billingAddress,
            zipCode: zipCode,
            dinerNum: dinerNum,
            mailingAddress: mailingAddress,
            points: points,
            highTraffic: req.session.highTraffic
        });

        await payment.save();
        console.log('New payment created:', payment);

        // Perform additional actions after payment, like updating tables or audit trail
        // Redirect to thank you page or other appropriate page
        res.redirect('/thank-you');
    } catch (err) {
        console.error('Error processing payment:', err);
        res.status(500).redirect('/fee-fail'); // Redirect to payment failure page on error
    }
});

// Example route to retrieve reservation results
app.get('/results', async(req, res) => {
    try {
        const result = await TableAudit.findOne({ lastestUpdate: true });
        if (!result) {
            res.status(404).json({ error: 'No active reservation found' });
        } else {
            res.json(result);
        }
    } catch (err) {
        console.error('Error fetching reservation results:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
