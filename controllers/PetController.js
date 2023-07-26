const Pet = require("../models/Pet");

const getToken = require("../helpers/get-token");
const getUserByToken = require("../helpers/get-user-by-token");
const ObjectId = require("mongoose").Types.ObjectId;

module.exports = class PetController {

    //create a pet
    static async create(req, res){

        const {name, age, weight, color} = req.body;
        const images = req.files
        const available = true;

        //images upload

        // validations
        if(!name) { res.status(422).json({ message: "O nome é obrigatório" }); return; }
        if(!age) { res.status(422).json({ message: "A idade é obrigatória" }); return; }
        if(!weight) { res.status(422).json({ message: "O peso é obrigatório" }); return; }
        if(!color) { res.status(422).json({ message: "A cor é obrigatória" }); return; }
        if(images.length === 0) { res.status(422).json({ message: "A imagem é obrigatória" }); return; }

        //get owner by token
        const token = getToken(req);
        const user = await getUserByToken(token);

        //create a pet

        const pet = new Pet({
            name,
            age,
            weight,
            color,
            available,
            images: [],
            user: {
                _id: user._id,
                name: user.name,
                image: user.image,
                phone: user.phone,
            }
        })

        images.map((image) => {
            pet.images.push(image.filename);
        })

        try {
            
            const newPet = await pet.save()

            res.status(201).json({ message: "Pet cadastrado com sucesso!", newPet})

        } catch (error) {
            console.log("ERRO AO CRIAR PET", error)
            res.status(500).json({message: error})
            
        }

    }

    static async getAll(req, res){
        const pets = await Pet.find().sort('-createdAt')

        res.status(200).json({pets: pets});
    }

    static async getAllUserPets(req, res){

        //get owner by token
        const token = getToken(req);
        const user = await getUserByToken(token);

        const pets = await Pet.find({'user._id':user._id}).sort('-createdAt')

        res.status(200).json({pets: pets});
    }

    static async getAllUserAdoptionsPets(req, res){

        //get owner by token
        const token = getToken(req);
        const user = await getUserByToken(token);

        const pets = await Pet.find({'adopter._id':user._id}).sort('-createdAt')

        res.status(200).json({pets: pets});
    }

    static async getPetById(req, res){

        const id = req.params.id;

        if(!ObjectId.isValid(id)){ res.status(422).json({ message: "ID inválido!" }); return; }

        const pet = await Pet.findOne({'_id':id});
        if(!pet){ res.status(404).json({ message: "Pet não encontrado!" }); return; }

        res.status(200).json({pets: pet});
    }

    static async removePetById(req, res){

        const id = req.params.id;

        if(!ObjectId.isValid(id)){ res.status(422).json({ message: "ID inválido!" }); return; }

        const pet = await Pet.findOne({'_id':id});
        if(!pet){ res.status(404).json({ message: "Pet não encontrado!" }); return; }

        if(!await PetController.checkIfPetOwner(req, pet)){ res.status(404).json({ message: "Não é possível deletar um pet que não é seu!" }); return; }

        try {
            await Pet.deleteOne({'_id':id});
            res.status(200).json({message: "Pet deletado com sucesso!"});
        } catch (error) {
            res.status(401).json({message: "Ocorreu um erro ao deletar o pet!"});
        }
    }

    static async updatePetById(req, res){

        const id = req.params.id;
        const {name, age, weight, color, available} = req.body;
        const images = req.files;

        if(!ObjectId.isValid(id)){ res.status(422).json({ message: "ID inválido!" }); return; }

        const pet = await Pet.findOne({'_id':id});
        if(!pet){ res.status(404).json({ message: "Pet não encontrado!" }); return; }

        const updatedData = {};

        if(!await PetController.checkIfPetOwner(req, pet)){ res.status(404).json({ message: "Não é possível editar um pet que não é seu!" }); return; }

        if(!name) { res.status(422).json({ message: "O nome é obrigatório" }); return; } else {updatedData.name = name;}
        if(!age) { res.status(422).json({ message: "A idade é obrigatória" }); return; } else {updatedData.age = age;}
        if(!weight) { res.status(422).json({ message: "O peso é obrigatório" }); return; } else {updatedData.weight = weight;}
        if(!color) { res.status(422).json({ message: "A cor é obrigatória" }); return; } else {updatedData.color = color;}
        if(available) { updatedData.available = available; }
        if(images.length === 0) {
            res.status(422).json({ message: "A imagem é obrigatória" });
            return; 
        } else {
            updatedData.images = [];
            images.map((image) => {
                updatedData.images.push(image.filename);
            })
        }

        try {
            await Pet.findByIdAndUpdate({_id: id}, updatedData);
            res.status(200).json({message: "Pet atualizado com sucesso!"});
        } catch (error) {
            res.status(401).json({message: "Ocorreu um erro ao atualizar o pet!"});
        }
    }

    static async schedule(req, res){

        const token = getToken(req);
        const user = await getUserByToken(token);

        const id = req.params.id;

        if(!ObjectId.isValid(id)){ res.status(422).json({ message: "ID inválido!" }); return; }

        const pet = await Pet.findOne({'_id':id});
        if(!pet){ res.status(404).json({ message: "Pet não encontrado!" }); return; }

        //get owner by token
        if(await PetController.checkIfPetOwner(req, pet)){ res.status(404).json({ message: "Não é possível agendar visita para seu próprio pet!" }); return; }

        //check if user has scheduled a visit
        if(pet.adopter){
            if(pet.adopter._id.equals(user._id)){
                res.status(404).json({ message: "Você já agendou uma visita para este pet!" });
                return;
            }
        }

        //add adopter pet
        pet.adopter = {
            _id: user._id,
            name: user.name,
            image: user.image,
        }

        try {
            await Pet.findByIdAndUpdate(id, pet);
            res.status(200).json({message: "Visita marcada com sucesso!"});
        } catch (error) {
            res.status(401).json({message: "Ocorreu um erro ao marcar a visita ao pet! " + error.message});
        }

    }

    static async concludeAdoption(req, res){

        const token = getToken(req);
        const user = await getUserByToken(token);

        const id = req.params.id;

        if(!ObjectId.isValid(id)){ res.status(422).json({ message: "ID inválido!" }); return; }

        const pet = await Pet.findOne({'_id':id});
        if(!pet){ res.status(404).json({ message: "Pet não encontrado!" }); return; }

        if(!await PetController.checkIfPetOwner(req, pet)){ res.status(404).json({ message: "Não é possível dizer que um pet que não é seu foi adotado!" }); return; }


        pet.available = false;

        try {
            await Pet.findByIdAndUpdate(id, pet);
            res.status(200).json({message: "Pet adotado com sucesso!"});
        } catch (error) {
            res.status(401).json({message: "Ocorreu um erro ao adotar o pet! " + error.message});
        }

    }

    static async checkIfPetOwner(req, pet){
        //get owner by token
        const token = getToken(req);
        const user = await getUserByToken(token);
        console.log("TESTE", pet.user._id.equals(user._id));
        if(pet && pet.user._id.equals(user._id)){
            return true; 
        }
        return false;
    }
    
}