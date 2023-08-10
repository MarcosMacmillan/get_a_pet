const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getUserById } = require("../controllers/UserController");

//get user by jwt token
const getuserByToken = async (token) => {

    if(!token){
        return res.status(401).json({message: "Acesso Negado! (TK3)"});
    }

    const decoded = jwt.verify(token, "nossosecret");

    const userId = decoded.id;

    const user = await User.findOne({_id: userId});

    return user;
}

module.exports = getuserByToken;