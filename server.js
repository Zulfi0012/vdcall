const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const CryptoJS = require('crypto-js');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const secretKey = '1234';  // Encryption key

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from 'public' directory

let clients = {};
let users = {};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Register a new user
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.status(400).send('User already exists');
    }
    users[username] = { password };
    res.status(200).send('User registered');
});

// Add a contact for a user
app.post('/add-contact', (req, res) => {
    const { username, contact } = req.body;
    if (!users[username]) {
        return res.status(400).send('User not found');
    }
    if (!users[contact]) {
        return res.status(400).send('Contact not found');
    }
    if (!clients[username]) {
        return res.status(400).send('User not online');
    }
    clients[username].contacts = clients[username].contacts || [];
    clients[username].contacts.push(contact);
    res.status(200).send('Contact added');
});

// Handle WebRTC signaling
io.on('connection', (socket) => {
    console.log('a user connected');
    
    let username = null;
    
    socket.on('register', (name) => {
        username = name;
        clients[username] = clients[username] || { socket, contacts: [] };
        socket.emit('registration', { success: true });
    });

    socket.on('offer', (data) => {
        const { to, offer } = JSON.parse(CryptoJS.AES.decrypt(data, secretKey).toString(CryptoJS.enc.Utf8));
        if (clients[to]) {
            const encryptedOffer = CryptoJS.AES.encrypt(JSON.stringify({ from: username, offer }), secretKey).toString();
            clients[to].socket.emit('offer', encryptedOffer);
        }
    });

    socket.on('answer', (data) => {
        const { to, answer } = JSON.parse(CryptoJS.AES.decrypt(data, secretKey).toString(CryptoJS.enc.Utf8));
        if (clients[to]) {
            const encryptedAnswer = CryptoJS.AES.encrypt(JSON.stringify({ from: username, answer }), secretKey).toString();
            clients[to].socket.emit('answer', encryptedAnswer);
        }
    });

    socket.on('candidate', (data) => {
        const { to, candidate } = JSON.parse(CryptoJS.AES.decrypt(data, secretKey).toString(CryptoJS.enc.Utf8));
        if (clients[to]) {
            const encryptedCandidate = CryptoJS.AES.encrypt(JSON.stringify({ from: username, candidate }), secretKey).toString();
            clients[to].socket.emit('candidate', encryptedCandidate);
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        if (username) {
            delete clients[username];
        }
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});
