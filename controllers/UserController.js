const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

//helpers
const createUserToken = require("../helpers/create-user-token");
const getToken = require("../helpers/get-token");
const getUserByToken = require("../helpers/get-user-by-token");

module.exports = class UserController{
    static async register(req, res){
        
        const {name, email, phone, password, confirmpassword} = req.body;

        // Validations
        if(!name)               { res.status(422).json({ message: "O nome é obrigatório" }); return; }
        if(!email)              { res.status(422).json({ message: "O email é obrigatório" }); return; }
        if(!phone)              { res.status(422).json({ message: "O telefone é obrigatório" }); return; }
        if(!password)           { res.status(422).json({ message: "A senha é obrigatória" }); return; }
        if(!confirmpassword)    { res.status(422).json({ message: "A confirmação da senha é obrigatória" }); return; }
        if(confirmpassword !== password) { res.status(422).json({ message: "As senhas não conferem" }); return; }

        // Check if user exists
        const userExists = await User.findOne({email: email});
        if(userExists) { res.status(422).json({ message: "E-mail já está em uso. Por favor, utilize outro e-mail" }); return; }

        // Check valid e-mail

        //create a password
        const salt = await bcrypt.genSalt(12)
        const passwordHash = await bcrypt.hash(password, salt);

        //create user

        const user = new User({
            name,
            email,
            phone,
            password: passwordHash,
        })

        try {
            
            const newUser = await user.save()

            await createUserToken(newUser, req, res)
        } catch (error) {
            console.log("ERRO AO CRIAR USUARIO", error)
            res.status(500).json({message: error})
            
        }
    }

    static async login(req, res) {

        const { email, password } = req.body;

        if(!email)              { res.status(422).json({ message: "O email é obrigatório" }); return; }
        if(!password)           { res.status(422).json({ message: "A senha é obrigatória" }); return; }

        //check user exists
        const user = await User.findOne({email: email});
        if(!user) { res.status(422).json({ message: "Usuário ou senha incorretos." }); return; }
        
        //check if password match
        const checkPassword = await bcrypt.compare(password, user.password);
        if(!checkPassword) { res.status(422).json({ message: "Usuário ou senha incorretos.(2)" }); return; }

        await createUserToken(user, req, res);
    }

    static async checkUser(req, res) {

        let currentUser;

        if(req.headers.authorization){
            const token = getToken(req);
            const decoded = jwt.verify(token, "nossosecret");

            currentUser = await User.findById(decoded.id).select("-password");

        } else{
            currentUser = null;
        }

        res.status(200).send(currentUser);
    }

    static async getUserById(req, res) {

        const id = req.params.id;
    
        try {
            const user = await User.findById(id).select("-password");
            res.status(200).json({ user });
        } catch (error) {
            return res.status(422).json({ message: "Usuário não encontrado!" });
        }


    }

    static async editUser(req, res) {

        //check if user exists by token
        const token = getToken(req);
        const user = await getUserByToken(token);

        const {name, email, phone, password, confirmpassword} = req.body;

        if(req.file){
            user.image = req.file.filename;
        }

        // Validations
        if(!name)               { res.status(422).json({ message: "O nome é obrigatório" }); return; }
        user.name = name;

        if(!email)              { res.status(422).json({ message: "O email é obrigatório" }); return; }
        const userExists = await User.findOne({email: email});
        if(user.email !== email && userExists){
            return res.status(422).json({ message: "Utilize outro e-mail!" });
        }
        user.email = email;
        
        if(!phone)              { res.status(422).json({ message: "O telefone é obrigatório" }); return; }
        user.phone = phone;

        if(confirmpassword != password) {
            res.status(422).json({ message: "As senhas não conferem" });
            return; 
        } else if(password === confirmpassword && password != null){
            //create a password
            const salt = await bcrypt.genSalt(12)
            const passwordHash = await bcrypt.hash(password, salt);
            user.password = passwordHash;
        }


        try {
            await User.findOneAndUpdate(
                {_id: user._id},
                {$set: user},
                {new: true},
            );

            res.status(200).json({ message: "Usuário atualizado com sucesso!" });
        } catch (error) {
            return res.status(500).json({ message: "Usuário não encontrado!" });
        }
    }
}